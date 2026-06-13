# LiveKit on Railway (TCP-only)

Deploy with **Root Directory:** `infra/livekit-railway`

Full setup (video + MinIO + Redis + Egress + Render env): **[`../railway/README.md`](../railway/README.md)**

Quick requirements:
- **Settings → Root Directory:** `infra/livekit-railway` (required — otherwise LiveKit ignores `REDIS_URL`)
- **Settings → Build:** Dockerfile (not the stock `livekit/livekit-server` image alone)
- Public domain → port **7880**
- TCP proxy → port **7882** → redeploy
- Env: `LIVEKIT_KEYS`, `WEBHOOK_URL`, `REDIS_URL` (for recording)

After deploy, logs **must** include:
```
=== AssistLens livekit-railway entrypoint ===
Redis enabled: redis.railway.internal:6379
=== LiveKit config ===
redis:
  address: ...
```

If you only see `using single-node routing` and **no** lines above, Railway is not running this Dockerfile. Either fix Root Directory and redeploy, **or** add LiveKit-native vars manually:

```env
LIVEKIT_REDIS_ADDRESS=redis.railway.internal:6379
LIVEKIT_REDIS_USERNAME=default
LIVEKIT_REDIS_PASSWORD=<same password as in REDIS_URL>
```
