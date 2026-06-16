# AssistLens — Submission README

**Real-time visual customer support** with self-hosted LiveKit (no third-party video API, no app install).

---

## Demo access

| | URL |
| --- | --- |
| **Live app** | `https://assist-lens.vercel.app/
| **Source code** | https://github.com/SreeRag1907/AssistLens |

### Login credentials

| Role | URL | Email | Password |
| --- | --- | --- | --- |
| **Agent** | `/` (home) | `agent@assistlens.dev` | `demo-agent-pass` |
| **Admin** | `/admin/login` | `admin@assistlens.dev` | `demo-admin-pass` |
| **Customer** | `/j/{code}` | *No login* — use invite link from agent |

> Production passwords are set via Render env vars (`AGENT_PASSWORD`, `ADMIN_PASSWORD`). If login fails, check Render → Environment.

---

## Quick setup (local)

### Prerequisites

- Node.js 20+
- Docker Desktop
- Supabase Postgres (free tier)

### Steps

```bash
git clone https://github.com/SreeRag1907/AssistLens.git
cd AssistLens

cp api/.env.example api/.env
# Edit api/.env — set DATABASE_URL to Supabase connection string

docker compose up -d          # LiveKit, Redis, MinIO, Egress

cd api && npm install && npm run dev    # http://localhost:8080
cd web && npm install && npm run dev    # http://localhost:5173
```

1. Sign in as **agent** at http://localhost:5173
2. **Create session** → share invite link
3. Open link in another browser → **Join now**

Full details: [`README.md`](../../README.md) in repo root.

---

## Production deployment

| Component | Host |
| --- | --- |
| Web | Vercel (`web/`) |
| API | Render (`api/`) |
| Postgres | Supabase |
| LiveKit + MinIO + Redis + Egress | Railway — see [`infra/railway/README.md`](../../infra/railway/README.md) |

Set `VITE_API_BASE` on Vercel, `RECORDING_ENABLED=true` on Render when Egress is deployed.

---

## ✨ Features implemented

Everything the problem statement asked for — plus a full bonus stack we run in production.

### ✅ Required (core platform)

| | Feature |
| --- | --- |
| 🎫 | **Agent session management** — create, join, end, and review support sessions |
| 🔗 | **Customer join via link** — no account, no app install; short URLs like `/j/xk9m2pqa` |
| 🖥️ | **Self-hosted SFU media** — LiveKit on Railway (server-routed WebRTC, **not P2P**, **not** Twilio/Daily) |
| 🎥 | **Audio & video** — full duplex A/V with mute, camera, and mobile flip |
| 💬 | **In-call chat** — real-time messages over LiveKit data channels + Postgres history |
| 🔐 | **Role-based access** — signed invite tokens for customers; JWT for agents & admins |

### 🚀 Bonus (above & beyond)

| | Feature |
| --- | --- |
| ⏺️ | **Call recording** — LiveKit Egress → MinIO; download MP4 from session detail |
| 📎 | **Chat file sharing** — images, PDFs, docs (≤20 MB) stored in MinIO |
| 🔄 | **Reconnect grace** — 30s window; customer can drop and rejoin without breaking the session |
| 📊 | **Admin dashboard** — all sessions, participants, event logs, force-end |
| 📈 | **Prometheus metrics** — `/api/metrics` + health check |
| 🚪 | **Pre-join lobby** — camera/mic preview before entering the call |
| 🌙 | **Dark / light theme** — across agent, admin, and customer UIs |
| 📱 | **Mobile camera flip** — front/back camera on phones |

---

## Known limitations

1. **Recording** — Requires Railway **Redis + Egress + MinIO** with matching env vars on Render (`S3_EGRESS_ENDPOINT`, `RECORDING_ENABLED=true`). First recording after cold start may take ~30–90s to process.

2. **HTTPS required** — Camera/microphone only work on `https://` or `localhost` (browser policy).

3. **Railway cold starts** — LiveKit/Egress on free/usage tiers may sleep; first call after idle can take 10–30s to connect.

4. **Email invites** — Branded invite is copied to clipboard + Gmail opens; browsers cannot auto-paste HTML into Gmail (security). Server-side email (Resend/SMTP) not included.

5. **Single-region** — No multi-region SFU; optimized for hackathon demo scale.

6. **File size** — Chat uploads limited to **20 MB** per file.

7. **Invite scope** — Anyone with the invite link joins as customer until the session ends.

8. **Admin vs agent** — Separate JWTs; admins monitor all sessions but use a different login.

---

## Architecture

Self-hosted **LiveKit SFU** on Railway routes all WebRTC media (not P2P). Fastify API on Render handles auth, sessions, webhooks, and MinIO file/recording storage. React SPA on Vercel.

Diagram and sequence flows: [`docs/architecture.md`](../architecture.md) and [`credentials-and-architecture.md`](./credentials-and-architecture.md).

---

## Health & metrics

- API health: `GET /api/health`
- Prometheus: `GET /api/metrics`

---

## License

Hackathon submission — see repository owner.
