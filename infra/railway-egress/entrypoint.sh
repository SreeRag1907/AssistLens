#!/bin/bash
set -euo pipefail

# Generate egress.yaml from env and start LiveKit Egress on Railway.
# Connects to LiveKit + Redis + MinIO over Railway private networking.

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

REDIS_ADDRESS="${REDIS_ADDRESS:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

if [ -n "${REDIS_URL:-}" ]; then
  REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -n 's|redis://[^:]*:\([^@]*\)@.*|\1|p')
  REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://[^@]*@\(.*\)|\1|p')
  if [ -z "$REDIS_ADDRESS" ]; then
    REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://\(.*\)|\1|p')
    REDIS_PASSWORD=""
  fi
fi

if [ -z "$REDIS_ADDRESS" ]; then
  echo "ERROR: REDIS_URL or REDIS_ADDRESS is required for Egress"
  exit 1
fi

REDIS_YAML="  address: ${REDIS_ADDRESS}"
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_YAML="${REDIS_YAML}
  password: ${REDIS_PASSWORD}"
fi

EGRESS_CONFIG="/tmp/egress.yaml"

cat > "${EGRESS_CONFIG}" <<EOF
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ${LIVEKIT_WS_URL}
redis:
${REDIS_YAML}
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
exec /tini -- egress
