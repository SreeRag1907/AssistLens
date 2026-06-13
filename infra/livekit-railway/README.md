# Self-hosted LiveKit on Railway (TCP-only)

Railway does not expose UDP, so WebRTC media uses a **TCP proxy on port 7882**.
Signaling (WebSocket) uses the public HTTPS domain on port **7880**.

This satisfies hackathon rules: media routes through **your own** LiveKit container, not a third-party video API.

## 1. Deploy the service

In Railway, create a service from this repo with root directory:

```
infra/livekit-railway
```

Or connect the repo and set **Root Directory** to `infra/livekit-railway` in service settings.

## 2. Environment variables

| Variable | Value |
| --- | --- |
| `LIVEKIT_KEYS` | `devkey: devsecretdevsecretdevsecretdevse` (match Render API keys) |
| `WEBHOOK_URL` | `https://assistlens-api.onrender.com/api/webhooks/livekit` |
| `LIVEKIT_NODE_IP_MODE` | `proxy` (default) or `auto` |

Railway injects `PORT` and, after you add the TCP proxy (step 4), `RAILWAY_TCP_PROXY_*` automatically.

## 3. HTTP domain (signaling)

1. Service → **Settings → Networking**
2. **Generate Domain** (or use your custom domain)
3. Set **Target port** to **7880**

Note the URL, e.g. `https://assistlens-production.up.railway.app`

## 4. TCP proxy (required for video)

1. Same **Networking** page → **TCP Proxy**
2. Application port: **7882**
3. Railway shows something like `shuttle.proxy.rlwy.net:15140` — save this
4. **Redeploy** the service (TCP proxy env vars are injected on deploy)

## 5. Verify startup logs

After redeploy, open **Deploy Logs**. You should see:

```
Railway TCP proxy: shuttle.proxy.rlwy.net:15140 → container:7882
iptables redirect configured   (or haproxy started)
=== Starting LiveKit ===
  Force TCP: true
```

If you see `RAILWAY_TCP_PROXY_DOMAIN not set`, the TCP proxy was not added or you need to redeploy.

## 6. Update Render API

In Render → `assistlens-api` → Environment:

```env
LIVEKIT_URL=https://YOUR-RAILWAY-LIVEKIT-DOMAIN.up.railway.app
PUBLIC_LIVEKIT_URL=wss://YOUR-RAILWAY-LIVEKIT-DOMAIN.up.railway.app
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecretdevsecretdevsecretdevse
```

Redeploy the API service.

## 7. Test end-to-end

1. Open `https://assist-lens.vercel.app`
2. **Create a new session** (do not reuse ended sessions)
3. Agent joins on laptop, customer opens invite link on phone
4. Confirm video/audio on both sides

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `410 Gone` on agent-token | Session ended — create a new one |
| `could not establish pc connection` | Add TCP proxy on **7882** and redeploy LiveKit |
| Webhook errors | `WEBHOOK_URL` must match Render API; `WEBHOOK_API_KEY` must match `LIVEKIT_API_KEY` |
| Signaling fails | Check `PUBLIC_LIVEKIT_URL` uses `wss://` and matches Railway domain |

## Local development

For local Docker with UDP, use the root `docker-compose.yml` and `infra/livekit.yaml` instead of this folder.
