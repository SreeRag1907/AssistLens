#!/bin/bash
set -euo pipefail

# Generate egress.yaml from env and start LiveKit Egress on Railway.
# Connects to LiveKit + Redis + MinIO over Railway private networking.
#
# IMPORTANT: Room composite uses Chrome + PulseAudio. The upstream image starts
# pulse in build/egress/entrypoint.sh — we must do the same before launching egress.

if [ -z "${LIVEKIT_API_KEY:-}" ] || [ -z "${LIVEKIT_API_SECRET:-}" ]; then
  if [ -n "${LIVEKIT_KEYS:-}" ]; then
    LIVEKIT_API_KEY=$(echo "${LIVEKIT_KEYS}" | cut -d':' -f1 | xargs)
    LIVEKIT_API_SECRET=$(echo "${LIVEKIT_KEYS}" | cut -d':' -f2- | xargs)
  else
    echo "ERROR: set LIVEKIT_API_KEY + LIVEKIT_API_SECRET (or LIVEKIT_KEYS)"
    exit 1
  fi
fi

LIVEKIT_WS_URL="${LIVEKIT_WS_URL:-ws://livekit-server.railway.internal:7880}"
LOG_LEVEL="${EGRESS_LOG_LEVEL:-info}"

S3_ACCESS_KEY="${S3_ACCESS_KEY:-${MINIO_ROOT_USER:-assistlens}}"
S3_SECRET_KEY="${S3_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-assistlens-minio}}"
S3_ENDPOINT="${S3_EGRESS_ENDPOINT:-http://minio.railway.internal:9000}"
S3_BUCKET="${MINIO_BUCKET:-recordings}"
S3_REGION="${S3_REGION:-us-east-1}"

S3_HOST=$(echo "$S3_ENDPOINT" | sed -n 's|https\?://\([^:/]*\).*|\1|p')
if [ -n "$S3_HOST" ] && ! getent ahostsv4 "$S3_HOST" >/dev/null 2>&1 && ! getent hosts "$S3_HOST" >/dev/null 2>&1; then
  echo "ERROR: Cannot resolve MinIO host '${S3_HOST}' from this container."
  echo "       Railway private DNS is {service-name}.railway.internal"
  echo "       Fix: rename your MinIO service to exactly 'minio' (Settings → Service name), OR set:"
  echo "         S3_EGRESS_ENDPOINT=http://<your-minio-service-name>.railway.internal:9000"
  echo "       on BOTH egress and Render (S3_EGRESS_ENDPOINT)."
  exit 1
fi

REDIS_ADDRESS="${REDIS_ADDRESS:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_USERNAME="${REDIS_USERNAME:-}"

if [ -n "${REDIS_URL:-}" ]; then
  # redis://user:pass@host:6379  or  redis://:pass@host:6379  or  redis://host:6379
  if echo "$REDIS_URL" | grep -q '@'; then
    REDIS_USERNAME=$(echo "$REDIS_URL" | sed -n 's|redis://\([^:]*\):.*|\1|p')
    REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -n 's|redis://[^:]*:\([^@]*\)@.*|\1|p')
    REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://[^@]*@\(.*\)|\1|p')
  else
    REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://\(.*\)|\1|p')
  fi
fi

if [ -z "$REDIS_ADDRESS" ]; then
  echo "ERROR: REDIS_URL or REDIS_ADDRESS is required for Egress"
  exit 1
fi

REDIS_YAML="  address: ${REDIS_ADDRESS}"
if [ -n "$REDIS_USERNAME" ] && [ "$REDIS_USERNAME" != "$REDIS_PASSWORD" ]; then
  REDIS_YAML="${REDIS_YAML}
  username: ${REDIS_USERNAME}"
fi
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_YAML="${REDIS_YAML}
  password: ${REDIS_PASSWORD}"
fi

# ws:// internal URLs require insecure: true (LiveKit docs).
INSECURE="${EGRESS_INSECURE:-true}"
# Railway has no --cap-add SYS_ADMIN; keep Chrome sandbox off (default, set explicitly).
CHROME_SANDBOX="${EGRESS_ENABLE_CHROME_SANDBOX:-false}"
# Default room composite wants 4 CPU; Railway plans are smaller — lower all costs.
ROOM_COMPOSITE_CPU="${EGRESS_ROOM_COMPOSITE_CPU:-0.5}"
WEB_CPU="${EGRESS_WEB_CPU:-0.5}"
PARTICIPANT_CPU="${EGRESS_PARTICIPANT_CPU:-0.5}"
TRACK_COMPOSITE_CPU="${EGRESS_TRACK_COMPOSITE_CPU:-0.5}"
TRACK_CPU="${EGRESS_TRACK_CPU:-0.25}"
MAX_CPU_UTIL="${EGRESS_MAX_CPU_UTILIZATION:-0.9}"
HEALTH_PORT="${EGRESS_HEALTH_PORT:-8081}"

EGRESS_CONFIG="/tmp/egress.yaml"

cat > "${EGRESS_CONFIG}" <<EOF
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ${LIVEKIT_WS_URL}
insecure: ${INSECURE}
enable_chrome_sandbox: ${CHROME_SANDBOX}
health_port: ${HEALTH_PORT}
redis:
${REDIS_YAML}
cpu_cost:
  room_composite_cpu_cost: ${ROOM_COMPOSITE_CPU}
  web_cpu_cost: ${WEB_CPU}
  participant_cpu_cost: ${PARTICIPANT_CPU}
  track_composite_cpu_cost: ${TRACK_COMPOSITE_CPU}
  track_cpu_cost: ${TRACK_CPU}
  max_cpu_utilization: ${MAX_CPU_UTIL}
s3:
  access_key: ${S3_ACCESS_KEY}
  secret: ${S3_SECRET_KEY}
  region: ${S3_REGION}
  endpoint: ${S3_ENDPOINT}
  bucket: ${S3_BUCKET}
  force_path_style: true
logging:
  level: ${LOG_LEVEL}
EOF

echo "=== Egress config ==="
cat "${EGRESS_CONFIG}"
echo ""
echo "=== Starting LiveKit Egress ==="
echo "  LiveKit: ${LIVEKIT_WS_URL}"
echo "  Redis: ${REDIS_ADDRESS}"
echo "  S3: ${S3_ENDPOINT}/${S3_BUCKET}"
echo ""

export EGRESS_CONFIG_FILE="${EGRESS_CONFIG}"

# Delegate to the official image entrypoint (starts PulseAudio + Xvfb, then egress).
if [ -x /entrypoint.sh ]; then
  echo "Handing off to /entrypoint.sh (PulseAudio + Chrome stack)..."
  exec /entrypoint.sh
fi

echo "WARNING: /entrypoint.sh missing — starting egress directly (recording may fail)"
exec /tini -- egress
