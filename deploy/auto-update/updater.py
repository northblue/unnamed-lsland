"""One-project Compose updater. Never migrate data, prune images or update itself."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

CONTRACT = "cc.northblue.island.storage-contract"


class UpdateError(Exception):
    pass


def atomic_write(path, text):
    """Compose snapshots contain private environment values; never log their content."""
    path = Path(path)
    previous_stat = path.stat() if path.exists() else None
    fd, temporary = tempfile.mkstemp(prefix=".island-update-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        if previous_stat and os.geteuid() == 0:
            os.chown(temporary, previous_stat.st_uid, previous_stat.st_gid)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def replace_image(text, service, image):
    # Preserve all quoting/comments/passwords. Refuse unfamiliar layouts rather than
    # rewriting YAML or interpolating credentials into a generated replacement file.
    if not re.fullmatch(r"[A-Za-z0-9._:/-]+@sha256:[0-9a-f]{64}", image):
        raise UpdateError("Expected an immutable image digest")
    lines = text.splitlines(keepends=True)
    in_services = False
    in_target = False
    replaced = 0
    for index, line in enumerate(lines):
        if re.match(r"^services:\s*(?:#.*)?$", line.rstrip()):
            in_services = True
        elif line.strip() and not line.startswith((" ", "#")):
            in_services = False
            in_target = False
        if in_services and re.match(r"^  [A-Za-z0-9_-]+:", line):
            in_target = bool(re.match(r"^  " + re.escape(service) + r":\s*(?:#.*)?$", line.rstrip()))
        if in_target and re.match(r"^    image:", line):
            ending = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
            lines[index] = "    image: " + image + ending
            replaced += 1
    if replaced != 1:
        raise UpdateError("Expected exactly one literal image line in the target service")
    return "".join(lines)


class Docker:
    def __init__(self, project, compose, service, wait=180):
        self.project, self.compose, self.service, self.wait = project, str(compose), service, wait

    def run(self, args, timeout=600):
        try:
            result = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout,
                                    env={**os.environ, "COMPOSE_ANSI": "never"})
        except (OSError, subprocess.TimeoutExpired):
            raise UpdateError("Docker command unavailable or timed out") from None
        if result.returncode:
            # Docker/Compose errors can contain the private environment. Deliberately
            # report only the operation name; keep detailed inspection in the NAS UI.
            raise UpdateError("Docker operation failed: " + args[0])
        return result.stdout

    def compose_command(self, *args):
        return ["compose", "--project-name", self.project, "--file", self.compose, *args]

    def configuration(self):
        return json.loads(self.run(self.compose_command("config", "--format", "json")))

    def current(self):
        ids = self.run(["ps", "-q", "--filter", "label=com.docker.compose.project=" + self.project,
                        "--filter", "label=com.docker.compose.service=" + self.service]).split()
        if len(ids) != 1:
            raise UpdateError("Expected exactly one running target container")
        container = json.loads(self.run(["inspect", ids[0]]))[0]
        labels = container["Config"].get("Labels") or {}
        if labels.get("com.docker.compose.project") != self.project or labels.get("com.docker.compose.service") != self.service:
            raise UpdateError("Target labels do not match")
        return container

    def image(self, reference):
        return json.loads(self.run(["image", "inspect", reference]))[0]

    def candidate(self, channel):
        self.run(["pull", "--platform", "linux/amd64", channel])
        image = self.image(channel)
        if image.get("Architecture") != "amd64" or image.get("Os") != "linux":
            raise UpdateError("Candidate is not linux/amd64")
        return image

    def up(self):
        self.run(self.compose_command("up", "--no-deps", "--no-build", "--pull", "never",
                                      "--wait", "--wait-timeout", str(self.wait), self.service), self.wait + 60)


def healthy(container):
    return container.get("State", {}).get("Running") is True and container["State"].get("Health", {}).get("Status") == "healthy"


def digest_for(image, repository):
    values = [value for value in image.get("RepoDigests", [])
              if re.fullmatch(re.escape(repository) + r"@sha256:[0-9a-f]{64}", value)]
    if len(values) != 1:
        raise UpdateError("Cannot identify the image's immutable repository digest")
    return values[0]


class Updater:
    def __init__(self, docker, compose, state, channel, enabled=True, log=print):
        self.docker, self.compose, self.state = docker, Path(compose), Path(state)
        self.channel, self.enabled, self.log = channel, enabled, log
        if not re.fullmatch(r"[A-Za-z0-9._:/-]+:[A-Za-z0-9._-]+", channel) or "@" in channel:
            raise UpdateError("Invalid update channel")
        self.repository = channel.rsplit(":", 1)[0]
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.pending = self.state / "pending.json"
        self.failed = self.state / "failed.json"

    def recover(self):
        record = json.loads(self.pending.read_text())
        if record["compose"] != str(self.compose) or record["project"] != self.docker.project or record["service"] != self.docker.service:
            raise UpdateError("Recovery journal belongs to another project")
        if self.compose.read_bytes().decode('utf-8') not in [record["before"], record["after"], record.get("original")]:
            raise UpdateError("Compose changed externally; review pending recovery before updating")
        atomic_write(self.compose, record["before"])
        self.docker.up()
        container = self.docker.current()
        if not healthy(container) or container["Config"]["Image"] != record["previous"]:
            raise UpdateError("Rollback did not restore a healthy previous version")
        atomic_write(self.failed, json.dumps({"image": record["candidate"]}))
        self.pending.unlink()
        self.log("ROLLED BACK: previous Web is healthy; failed digest is blocked")
        return "rolled-back"

    def check(self):
        if self.pending.exists():
            return self.recover()
        original = self.compose.read_bytes().decode('utf-8')
        configuration = self.docker.configuration()
        if self.compose.read_bytes().decode('utf-8') != original:
            raise UpdateError("Compose changed while checking configuration")
        service = configuration.get("services", {}).get(self.docker.service)
        if not service or service.get("build"):
            raise UpdateError("Target must be an image-only Compose service")
        current = self.docker.current()
        if not healthy(current):
            raise UpdateError("Current Web must be healthy before an automatic update")
        if service.get("image") != current["Config"]["Image"]:
            raise UpdateError("Saved Compose and running image differ; deploy the saved config first")
        environment = dict(item.split("=", 1) for item in current["Config"].get("Env", []) if "=" in item)
        if any(environment.get(key) != str(value) for key, value in service.get("environment", {}).items() if value is not None):
            raise UpdateError("Saved Compose and running environment differ; deploy the saved config first")
        previous_image = self.docker.image(current["Image"])
        previous = digest_for(previous_image, self.repository)
        baseline = (previous_image.get("Config", {}).get("Labels") or {}).get(CONTRACT, "")
        if not re.fullmatch(r"[0-9a-f]{64}", baseline):
            raise UpdateError("Install the bootstrap Web image once before enabling auto updates")
        image = self.docker.candidate(self.channel)
        candidate = digest_for(image, self.repository)
        if image["Id"] == previous_image["Id"]:
            self.log("UP TO DATE: " + previous)
            return "unchanged"
        contract = (image.get("Config", {}).get("Labels") or {}).get(CONTRACT)
        if contract != baseline:
            self.log("MANUAL MIGRATION REQUIRED: storage contract changed; Web was not replaced")
            return "schema-blocked"
        health = image.get("Config", {}).get("Healthcheck", {}).get("Test", [])
        if not health or health[0] == "NONE":
            raise UpdateError("Candidate must define a health check")
        if self.failed.exists() and json.loads(self.failed.read_text()).get("image") == candidate:
            self.log("SKIPPED: this digest failed before; wait for a new release or explicitly retry")
            return "blocked"
        if not self.enabled:
            self.log("CHECK ONLY: available " + candidate)
            return "available"
        before = replace_image(original, self.docker.service, previous)
        after = replace_image(original, self.docker.service, candidate)
        if self.compose.read_bytes().decode('utf-8') != original:
            raise UpdateError("Compose changed during pull; no update was applied")
        record = {"compose": str(self.compose), "project": self.docker.project, "service": self.docker.service,
                  "original": original, "before": before, "after": after, "previous": previous, "candidate": candidate}
        atomic_write(self.state / "compose.previous.yaml", before)
        atomic_write(self.pending, json.dumps(record))
        atomic_write(self.compose, after)
        try:
            self.docker.up()
            current = self.docker.current()
            if not healthy(current) or current["Config"]["Image"] != candidate:
                raise UpdateError("Candidate did not become healthy")
        except Exception:
            # Recovery is durable: if interrupted here the next run repeats rollback.
            return self.recover()
        self.pending.unlink()
        self.log("UPDATED: healthy " + candidate)
        return "updated"


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--retry", action="store_true")
    args = parser.parse_args()
    compose = Path(os.environ.get("COMPOSE_FILE", "/volume2/docker/apps/unnamed-island/docker-compose.yaml"))
    project = os.environ.get("PROJECT_NAME", "unnamed-island")
    service = os.environ.get("SERVICE_NAME", "web")
    if not compose.is_absolute() or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", project) or not re.fullmatch(r"[A-Za-z0-9_-]+", service):
        raise UpdateError("Invalid Compose path/project/service")
    state = Path(os.environ.get("STATE_DIR", "/state"))
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    interval = max(60, int(os.environ.get("CHECK_INTERVAL_SECONDS", "300")))
    driver = Docker(project, compose, service, max(10, int(os.environ.get("HEALTH_TIMEOUT_SECONDS", "180"))))
    updater = Updater(driver, compose, state, os.environ.get("CHANNEL_IMAGE", "ghcr.io/northblue/unnamed-island:nas-stable"),
                      os.environ.get("AUTO_UPDATE_ENABLED", "false") == "true", lambda line: print(line, flush=True))
    while True:
        try:
            with (state / "update.lock").open("w") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                if args.retry:
                    updater.failed.unlink(missing_ok=True)
                    print("Failed digest block cleared; the next check may retry", flush=True)
                    return
                updater.check()
        except BlockingIOError:
            print("SKIPPED: another update check is running", flush=True)
        except Exception as error:
            # Unexpected exceptions are type-only to avoid accidental secret output.
            print("CHECK FAILED: " + (str(error) if isinstance(error, UpdateError) else type(error).__name__), flush=True)
            if args.once:
                raise SystemExit(1)
        if args.once:
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
