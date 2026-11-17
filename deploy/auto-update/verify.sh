#!/usr/bin/env bash
# Isolated Linux CI only. All test services/data are disposable; no NAS is contacted.
set -euo pipefail
test -n "${RUNNER_TEMP:-}"
project=island-autoupdate-ci
folder=$(mktemp -d "$RUNNER_TEMP/island-auto.XXXXXX")
compose="$folder/docker-compose.yaml"
repository=localhost:5051/island-auto
original_db=$(docker inspect --format '{{.Id}}' island-db)
cleanup() {
  docker compose -p "$project" -f "$compose" down --volumes 2>/dev/null || true
  docker rm -f island-auto-registry 2>/dev/null || true
}
trap cleanup EXIT
docker run -d --name island-auto-registry -p 127.0.0.1:5051:5000 registry:2
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:5051/v2/; then break; fi
  sleep 1
done
cat > "$folder/healthy.Dockerfile" <<'EOF'
FROM island-web:ci
ARG MARKER
LABEL cc.northblue.island.test-version=$MARKER
HEALTHCHECK --interval=1s --timeout=3s --start-period=1s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
EOF
docker build --builder default -f "$folder/healthy.Dockerfile" --build-arg MARKER=old -t "$repository:initial" "$folder"
docker push "$repository:initial"
old=$(docker image inspect "$repository:initial" --format '{{index .RepoDigests 0}}')
cat > "$compose" <<EOF
services:
  web:
    image: $old
    environment:
      DATABASE_URL: 'postgresql://island_app:ci-only-password@island-db:5432/unnamed_island'
      APP_ORIGIN: 'http://192.168.4.82:3080'
      PUBLIC_ORIGIN: 'https://unnamed-island.northblue.cc'
      ISLAND_SHARED_PASSWORD: 'ci-only-shared-password'
      ISLAND_SESSION_SECRET: 'ci-only-session-secret-at-least-32-characters'
    networks: [data]
networks:
  data:
    external: true
    name: island-ci
EOF
chmod 600 "$compose"
docker compose -p "$project" -f "$compose" up --wait --wait-timeout 40
docker build --builder default -f "$folder/healthy.Dockerfile" --build-arg MARKER=new -t "$repository:nas-stable" "$folder"
docker push "$repository:nas-stable"
candidate=$(docker image inspect "$repository:nas-stable" --format '{{index .RepoDigests 0}}')
check() {
  docker run --rm --network none \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$folder:$folder" -v "$folder/state:/state" \
    -e COMPOSE_FILE="$compose" -e PROJECT_NAME="$project" -e SERVICE_NAME=web \
    -e CHANNEL_IMAGE="$repository:nas-stable" -e AUTO_UPDATE_ENABLED=true \
    -e HEALTH_TIMEOUT_SECONDS=15 island-updater:ci --once
}
mkdir -p "$folder/state"
check
grep -Fq "$candidate" "$compose"
id=$(docker compose -p "$project" -f "$compose" ps -q web)
test "$(docker inspect --format '{{.State.Health.Status}}' "$id")" = healthy
test "$(docker inspect --format '{{.Config.Image}}' "$id")" = "$candidate"
check # Same digest must not recreate a healthy Web.
test "$(docker compose -p "$project" -f "$compose" ps -q web)" = "$id"
cat > "$folder/broken.Dockerfile" <<'EOF'
FROM island-web:ci
LABEL cc.northblue.island.test-version=unhealthy
HEALTHCHECK --interval=1s --timeout=1s --start-period=0s --retries=1 CMD exit 1
EOF
docker build --builder default -f "$folder/broken.Dockerfile" -t "$repository:nas-stable" "$folder"
docker push "$repository:nas-stable"
check # Bad candidate must restore the previous digest and healthy Web.
grep -Fq "$candidate" "$compose"
id=$(docker compose -p "$project" -f "$compose" ps -q web)
test "$(docker inspect --format '{{.State.Health.Status}}' "$id")" = healthy
test "$(docker inspect --format '{{.Config.Image}}' "$id")" = "$candidate"
test -f "$folder/state/failed.json"
test ! -f "$folder/state/pending.json"
check # Rejected digest stays quarantined; no restart loop.
test "$(docker compose -p "$project" -f "$compose" ps -q web)" = "$id"
test "$(docker inspect --format '{{.Id}}' island-db)" = "$original_db"
echo 'PASS: automatic digest replacement, healthy no-op, unhealthy rollback, quarantine; database unchanged'
