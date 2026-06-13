#!/bin/bash
set -euo pipefail

echo "=== AssistLens livekit-railway entrypoint ==="
echo "LiveKit does NOT read REDIS_URL — this script writes redis: into livekit.yaml"
echo ""

# Railway TCP-only LiveKit bootstrap.
# Signaling: Railway HTTP proxy → container PORT (default 7880).
# Media: Railway TCP proxy → container 7882 → iptables/haproxy → LiveKit ICE TCP.

if [ -z "${LIVEKIT_KEYS:-}" ]; then
  echo "ERROR: LIVEKIT_KEYS is not set (example: \"devkey: your-secret\")"
  exit 1
fi

TCP_PROXY_DOMAIN="${RAILWAY_TCP_PROXY_DOMAIN:-}"
TCP_PROXY_PORT="${RAILWAY_TCP_PROXY_PORT:-}"
TCP_APP_PORT="${RAILWAY_TCP_APPLICATION_PORT:-7882}"
SIGNAL_PORT="${PORT:-7880}"
WEBHOOK_URL="${WEBHOOK_URL:-https://assistlens-api.onrender.com/api/webhooks/livekit}"
WEBHOOK_API_KEY="${WEBHOOK_API_KEY:-$(echo "${LIVEKIT_KEYS}" | cut -d':' -f1 | xargs)}"
NODE_IP_MODE="${LIVEKIT_NODE_IP_MODE:-proxy}"
NODE_IP=""
USE_EXTERNAL_IP="false"
ICE_TCP_PORT="7881"
LOG_LEVEL="${LIVEKIT_LOG_LEVEL:-info}"
FORCE_TCP="false"
PORT_RANGE_START="50000"
PORT_RANGE_END="50100"
TURN_ENABLED="true"

if [ -n "$TCP_PROXY_DOMAIN" ] && [ -n "$TCP_PROXY_PORT" ]; then
  echo "Railway TCP proxy: ${TCP_PROXY_DOMAIN}:${TCP_PROXY_PORT} → container:${TCP_APP_PORT}"
  FORCE_TCP="true"
  TURN_ENABLED="false"
  PORT_RANGE_START="0"
  PORT_RANGE_END="0"
  ICE_TCP_PORT="$TCP_PROXY_PORT"

  if [ "$NODE_IP_MODE" = "auto" ]; then
    USE_EXTERNAL_IP="true"
    echo "Node IP mode: auto (use_external_ip=true)"
  else
    RESOLVED_IP=$(getent ahostsv4 "$TCP_PROXY_DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)
    if [ -z "$RESOLVED_IP" ]; then
      RESOLVED_IP=$(getent hosts "$TCP_PROXY_DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || true)
    fi
    if [ -n "$RESOLVED_IP" ]; then
      NODE_IP="$RESOLVED_IP"
      echo "Resolved ${TCP_PROXY_DOMAIN} → ${NODE_IP}"
    else
      echo "WARNING: Could not resolve ${TCP_PROXY_DOMAIN}; falling back to use_external_ip"
      USE_EXTERNAL_IP="true"
    fi
  fi

  if [ "$TCP_APP_PORT" != "$ICE_TCP_PORT" ]; then
    echo "Setting up redirect: ${TCP_APP_PORT} → ${ICE_TCP_PORT}"
    if iptables -t nat -A PREROUTING -p tcp --dport "${TCP_APP_PORT}" -j REDIRECT --to-port "${ICE_TCP_PORT}" 2>/dev/null; then
      echo "iptables redirect configured"
    else
      echo "iptables redirect failed, falling back to haproxy"
      cat > /tmp/haproxy.cfg <<HACFG
global
  log stdout format raw local0 info

defaults
  mode tcp
  timeout connect 5s
  timeout client 300s
  timeout server 300s
  log global
  option tcplog

listen ice_forwarder
  bind 0.0.0.0:${TCP_APP_PORT}
  server livekit 127.0.0.1:${ICE_TCP_PORT}
HACFG
      haproxy -f /tmp/haproxy.cfg -D
      echo "haproxy started"
    fi
  else
    echo "TCP application port matches ICE port; no forwarder needed"
  fi
else
  echo "WARNING: RAILWAY_TCP_PROXY_DOMAIN / RAILWAY_TCP_PROXY_PORT not set."
  echo "WebRTC media will fail on Railway until you add a TCP proxy for port 7882 and redeploy."
  USE_EXTERNAL_IP="true"
fi

REDIS_YAML=""
if [ -n "${REDIS_URL:-}" ]; then
  REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -n 's|redis://[^:]*:\([^@]*\)@.*|\1|p')
  REDIS_USERNAME=$(echo "$REDIS_URL" | sed -n 's|redis://\([^:]*\):.*|\1|p')
  REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://[^@]*@\(.*\)|\1|p')
  if [ -z "$REDIS_ADDRESS" ]; then
    REDIS_ADDRESS=$(echo "$REDIS_URL" | sed -n 's|redis://\(.*\)|\1|p')
    REDIS_PASSWORD=""
    REDIS_USERNAME=""
  fi
  echo "Redis enabled: ${REDIS_ADDRESS} (required for Egress recording)"
  REDIS_YAML="redis:
  address: ${REDIS_ADDRESS}"
  if [ -n "${REDIS_USERNAME:-}" ] && [ "$REDIS_USERNAME" != "$REDIS_PASSWORD" ]; then
    REDIS_YAML="${REDIS_YAML}
  username: ${REDIS_USERNAME}"
  fi
  if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_YAML="${REDIS_YAML}
  password: ${REDIS_PASSWORD}"
  fi
  # LiveKit also accepts native env vars (works if yaml is ignored).
  export LIVEKIT_REDIS_ADDRESS="${REDIS_ADDRESS}"
  if [ -n "${REDIS_USERNAME:-}" ] && [ "$REDIS_USERNAME" != "$REDIS_PASSWORD" ]; then
    export LIVEKIT_REDIS_USERNAME="${REDIS_USERNAME}"
  fi
  if [ -n "$REDIS_PASSWORD" ]; then
    export LIVEKIT_REDIS_PASSWORD="${REDIS_PASSWORD}"
  fi
else
  echo "ERROR: REDIS_URL is not set on livekit-server."
  echo "       Recording requires Redis on BOTH livekit-server and egress."
  echo "       In Railway: livekit-server → Variables → REDIS_URL = \${{Redis.REDIS_URL}}"
  echo "       Then redeploy livekit-server and confirm logs show: Redis enabled: ..."
  exit 1
fi

cat > /etc/livekit.yaml <<EOF
port: ${SIGNAL_PORT}
bind_addresses:
  - "0.0.0.0"

rtc:
  tcp_port: ${ICE_TCP_PORT}
  port_range_start: ${PORT_RANGE_START}
  port_range_end: ${PORT_RANGE_END}
  use_external_ip: ${USE_EXTERNAL_IP}
  force_tcp: ${FORCE_TCP}
  use_ice_lite: false
  enable_loopback_candidate: false

turn:
  enabled: ${TURN_ENABLED}
  udp_port: 7882

${REDIS_YAML}

webhook:
  api_key: ${WEBHOOK_API_KEY}
  urls:
    - ${WEBHOOK_URL}

logging:
  level: ${LOG_LEVEL}
EOF

echo ""
echo "=== LiveKit config ==="
cat /etc/livekit.yaml
echo ""
echo "=== Starting LiveKit ==="
echo "  Signaling port: ${SIGNAL_PORT}"
echo "  ICE TCP port: ${ICE_TCP_PORT}"
echo "  Force TCP: ${FORCE_TCP}"
echo "  Webhook: ${WEBHOOK_URL}"
echo "  TCP proxy: ${TCP_PROXY_DOMAIN:-none}:${TCP_PROXY_PORT:-none} → ${TCP_APP_PORT}"
echo ""

if [ -n "$NODE_IP" ]; then
  exec livekit-server --config /etc/livekit.yaml --node-ip "$NODE_IP"
else
  exec livekit-server --config /etc/livekit.yaml
fi
