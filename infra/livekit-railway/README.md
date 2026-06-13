# LiveKit on Railway (TCP-only)

Deploy with **Root Directory:** `infra/livekit-railway`

Full setup (video + MinIO + Redis + Egress + Render env): **[`../railway/README.md`](../railway/README.md)**

Quick requirements:
- Public domain → port **7880**
- TCP proxy → port **7882** → redeploy
- Env: `LIVEKIT_KEYS`, `WEBHOOK_URL`, `REDIS_URL` (for recording)
