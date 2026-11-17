import json
from pathlib import Path
import tempfile
import unittest
from updater import CONTRACT, Docker, UpdateError, Updater, atomic_write, replace_image

REPO = "ghcr.io/northblue/unnamed-island"
OLD = REPO + "@sha256:" + "a" * 64
NEW = REPO + "@sha256:" + "b" * 64
BASE = "c" * 64


def image(digest, identifier, contract=BASE):
    return {"Id": identifier, "RepoDigests": [digest], "Architecture": "amd64", "Os": "linux",
            "Config": {"Labels": {CONTRACT: contract}, "Healthcheck": {"Test": ["CMD", "check"]}}}


class FakeDocker:
    project, service = "unnamed-island", "web"

    def __init__(self, path):
        self.path = path
        self.old = image(OLD, "old-id")
        self.new = image(NEW, "new-id")
        self.reference, self.identifier = OLD, "old-id"
        self.is_healthy = True
        self.up_calls = []
        self.fail_candidate = False
        self.fail_rollback = False

    def configuration(self):
        reference = next(line.strip().split(": ", 1)[1] for line in self.path.read_text().splitlines() if line.strip().startswith("image:"))
        return {"services": {"web": {"image": reference, "environment": {"PRIVATE_PASSWORD": "test-private-value"}}}}

    def current(self):
        return {"Image": self.identifier, "Config": {"Image": self.reference, "Env": ["PRIVATE_PASSWORD=test-private-value"]},
                "State": {"Running": True, "Health": {"Status": "healthy" if self.is_healthy else "unhealthy"}}}

    def image(self, identifier):
        return self.old if identifier == "old-id" else self.new

    def candidate(self, channel):
        return self.new

    def up(self):
        reference = self.configuration()["services"]["web"]["image"]
        self.up_calls.append(reference)
        self.reference = reference
        self.identifier = "old-id" if reference == OLD else "new-id"
        if (reference == NEW and self.fail_candidate) or (reference == OLD and self.fail_rollback):
            self.is_healthy = False
            raise UpdateError("Synthetic health failure")
        self.is_healthy = True


class UpdaterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.compose = self.root / "docker-compose.yaml"
        self.source = "# Keep private values exactly as written\nservices:\n  web:\n    image: " + OLD + "\n    environment:\n      PRIVATE_PASSWORD: 'test-private-value$with-quotes'\nnetworks:\n  data: {}\n"
        self.compose.write_text(self.source)
        self.driver = FakeDocker(self.compose)
        self.messages = []
        self.updater = Updater(self.driver, self.compose, self.root / "state", REPO + ":nas-stable", log=self.messages.append)

    def test_only_image_line_changes_and_other_services_are_preserved(self):
        self.assertEqual(replace_image(self.source, "web", NEW).replace(NEW, OLD), self.source)
        with self.assertRaises(UpdateError):
            replace_image(self.source, "database", NEW)
        with self.assertRaises(UpdateError):
            replace_image(self.source.replace("    image:", "      image:"), "web", NEW)

    def test_healthy_update_is_pinned_private_and_leaves_no_journal(self):
        self.assertEqual(self.updater.check(), "updated")
        self.assertEqual(self.compose.read_text(), self.source.replace(OLD, NEW))
        self.assertEqual(self.compose.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.driver.up_calls, [NEW])
        self.assertFalse(self.updater.pending.exists())
        self.assertEqual((self.updater.state / "compose.previous.yaml").read_text(), self.source)
        self.assertTrue(all("test-private-value" not in message for message in self.messages))

    def test_unhealthy_candidate_rolls_back_and_is_not_retried_forever(self):
        self.driver.fail_candidate = True
        self.assertEqual(self.updater.check(), "rolled-back")
        self.assertEqual(self.compose.read_text(), self.source)
        self.assertEqual(self.driver.up_calls, [NEW, OLD])
        self.assertEqual(self.updater.check(), "blocked")
        self.assertEqual(self.driver.up_calls, [NEW, OLD])

    def test_interruption_and_failed_recovery_leave_a_durable_journal(self):
        self.driver.fail_candidate = True
        self.driver.fail_rollback = True
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.assertTrue(self.updater.pending.exists())
        self.driver.fail_rollback = False
        self.assertEqual(self.updater.check(), "rolled-back")
        self.assertFalse(self.updater.pending.exists())

    def test_schema_changes_or_bootstrap_missing_never_replace_web(self):
        self.driver.new["Config"]["Labels"][CONTRACT] = "d" * 64
        self.assertEqual(self.updater.check(), "schema-blocked")
        self.assertEqual(self.driver.up_calls, [])
        self.driver.old["Config"]["Labels"] = {}
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.assertEqual(self.compose.read_text(), self.source)

    def test_pull_failure_and_concurrent_config_edit_do_not_overwrite_settings(self):
        def unavailable(channel):
            raise UpdateError("Registry unavailable")
        self.driver.candidate = unavailable
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.assertEqual(self.compose.read_text(), self.source)
        def changed(channel):
            self.compose.write_text(self.source + "# GUI changed this while pulling\n")
            return self.driver.new
        self.driver.candidate = changed
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.assertIn("GUI changed", self.compose.read_text())
        self.assertEqual(self.driver.up_calls, [])

    def test_check_only_and_bad_health_do_not_recreate_containers(self):
        self.updater.enabled = False
        self.assertEqual(self.updater.check(), "available")
        self.assertEqual(self.driver.up_calls, [])
        self.driver.is_healthy = False
        with self.assertRaises(UpdateError):
            self.updater.check()

    def test_interrupted_journal_does_not_overwrite_new_manual_configuration(self):
        self.driver.fail_candidate = True
        self.driver.fail_rollback = True
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.compose.write_text(self.source + "# edited after failure\n")
        self.driver.fail_rollback = False
        with self.assertRaises(UpdateError):
            self.updater.check()
        self.assertIn("edited after failure", self.compose.read_text())

    def test_crlf_and_private_quoting_survive_a_real_update(self):
        self.compose.write_bytes(self.source.replace("\n", "\r\n").encode())
        self.assertEqual(self.updater.check(), "updated")
        self.assertEqual(self.compose.read_bytes(), self.source.replace(OLD, NEW).replace("\n", "\r\n").encode())

    def test_recovery_after_journal_write_before_compose_replacement(self):
        record = {"compose": str(self.compose), "project": self.driver.project, "service": "web",
                  "original": self.source, "before": self.source, "after": self.source.replace(OLD, NEW),
                  "previous": OLD, "candidate": NEW}
        atomic_write(self.updater.pending, json.dumps(record))
        self.assertEqual(self.updater.check(), "rolled-back")
        self.assertEqual(self.compose.read_text(), self.source)
        self.assertFalse(self.updater.pending.exists())

    def test_docker_up_is_scoped_without_dependencies_builds_or_pulls(self):
        docker = Docker("unnamed-island", self.compose, "web", 20)
        calls = []
        docker.run = lambda args, timeout: calls.append(args)
        docker.up()
        self.assertEqual(calls[0][-1], "web")
        for flag in ["--no-deps", "--no-build", "--wait", "--pull"]:
            self.assertIn(flag, calls[0])
        for forbidden in ["down", "prune", "--remove-orphans", "--renew-anon-volumes"]:
            self.assertNotIn(forbidden, calls[0])


if __name__ == "__main__":
    unittest.main()
