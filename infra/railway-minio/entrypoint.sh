#!/bin/sh
set -eu

MINIO_ROOT_USER="${MINIO_ROOT_USER:-assistlens}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-assistlens-minio}"
FILES_BUCKET="${FILES_BUCKET:-files}"
RECORDINGS_BUCKET="${MINIO_BUCKET:-recordings}"

# Start MinIO in background, create buckets, keep running in foreground.
minio server /data --console-address ":9001" &
MINIO_PID=$!

echo "Waiting for MinIO..."
for i in $(seq 1 30); do
  if mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null; then
    break
  fi
  sleep 1
done

mc mb -p "local/${FILES_BUCKET}" 2>/dev/null || true
mc mb -p "local/${RECORDINGS_BUCKET}" 2>/dev/null || true
echo "Buckets ready: ${FILES_BUCKET}, ${RECORDINGS_BUCKET}"

wait $MINIO_PID
