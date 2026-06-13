# Railway full stack — LiveKit + MinIO + Redis + Egress

Self-hosted video, chat files, and call recording on Railway (hackathon-compliant — your containers, not Twilio/Daily).

## Architecture

```mermaid
flowchart LR
  subgraph vercel [Vercel]
    web[Web app]
  end
  subgraph render [Render]
    api[Fastify API]
  end
  subgraph railway [Railway project]
    lk[livekit-server]
    minio[minio]
    redis[(Redis)]
    egress[egress]
  end
  pg[(Supabase Postgres)]

  web --> api
  api --> pg
  api -->|tokens + record API| lk
  web <-->|WebRTC| lk
  api -->|file upload/download| minio
  lk --> redis
  egress --> redis
  egress -->|ws| lk
  egress -->|MP4 upload| minio
  lk -->|webhooks| api
```

| Service | Root directory | Public URL? |
| --- | --- | --- |
| `livekit-server` | `infra/livekit-railway` | Yes — HTTPS domain + TCP proxy 7882 |
| `minio` | `infra/railway-minio` | Yes — HTTPS on port 9000 |
| `redis` | Railway Redis template | No — private only |
| `egress` | `infra/railway-egress` | No — private only |

---

## Prerequisites

- Railway project with **livekit-server** already working (video calls OK)
- Render API + Vercel web deployed
- Same LiveKit keys everywhere: `devkey` / `devsecretdevsecretdevsecretdevse` (or your own)

**Rename note:** Internal hostnames use your Railway **service names**. If you name services differently, update `LIVEKIT_WS_URL` and `S3_EGRESS_ENDPOINT` accordingly. Defaults assume:

- `livekit-server`
- `minio`
- `redis` (from Railway Redis plugin)

---

## Step 1 — Redis

1. Railway project → **+ New** → **Database** → **Add Redis**
2. Wait until Redis is running
3. Open the Redis service → **Variables** → copy **`REDIS_URL`**
   - Example: `redis://default:password@redis.railway.internal:6379`

You will attach this to **livekit-server** and **egress**.

---

## Step 2 — MinIO (files + recording storage)

1. **+ New** → **GitHub Repo** → same repo
2. **Settings → Service name:** `minio` (important for internal DNS)
3. **Root Directory:** `infra/railway-minio`
4. **Networking → Generate Domain** → target port **9000**
5. **Volumes → Add volume** → mount path **`/data`**
6. **Variables:**

```env
MINIO_ROOT_USER=assistlens
MINIO_ROOT_PASSWORD=choose-a-long-random-secret
FILES_BUCKET=files
MINIO_BUCKET=recordings
```

7. **Deploy** → note public URL, e.g. `https://minio-production-xxxx.up.railway.app`

---

## Step 3 — Update livekit-server (add Redis)

**Important:** `REDIS_URL` alone does nothing unless LiveKit reads it. Our Dockerfile entrypoint converts it into `livekit.yaml`. If deploy logs do **not** show `=== AssistLens livekit-railway entrypoint ===`, fix **Settings → Root Directory** to `infra/livekit-railway` and redeploy.

1. Open **livekit-server** → **Settings** → confirm **Root Directory** = `infra/livekit-railway`
2. **Variables** → add:

```env
REDIS_URL=${{Redis.REDIS_URL}}
```

Use Railway variable reference: click **Add Reference** → select your Redis service → `REDIS_URL`.

Or paste the full `redis://...` URL manually.

**Quick fix without redeploying Dockerfile:** add these three vars (LiveKit reads them natively):

```env
LIVEKIT_REDIS_ADDRESS=redis.railway.internal:6379
LIVEKIT_REDIS_USERNAME=default
LIVEKIT_REDIS_PASSWORD=<password from REDIS_URL>
```

2. Keep existing vars:

```env
LIVEKIT_KEYS=devkey: devsecretdevsecretdevsecretdevse
WEBHOOK_URL=https://assistlens-api.onrender.com/api/webhooks/livekit
LIVEKIT_NODE_IP_MODE=proxy
```

3. Confirm **TCP proxy on 7882** still exists → **Redeploy livekit-server**

4. Check **livekit-server** deploy logs — you **must** see:

```
Redis enabled: redis.railway.internal:6379
```

If you see `ERROR: REDIS_URL is not set on livekit-server`, the variable is missing — recording will fail with `egress not connected (redis required)`.

5. Open **livekit-server** deploy logs and confirm the generated config includes a `redis:` block (not empty).

---

## Step 4 — Egress (recording)

1. **+ New** → **GitHub Repo** → same repo
2. **Service name:** `egress`
3. **Root Directory:** `infra/railway-egress`
4. **No public domain needed** (private service only)
5. **Variables:**

```env
LIVEKIT_KEYS=devkey: devsecretdevsecretdevsecretdevse
LIVEKIT_WS_URL=ws://livekit-server.railway.internal:7880
REDIS_URL=${{Redis.REDIS_URL}}
S3_ACCESS_KEY=assistlens
S3_SECRET_KEY=<same as MINIO_ROOT_PASSWORD>
S3_EGRESS_ENDPOINT=http://minio.railway.internal:9000
MINIO_BUCKET=recordings
S3_REGION=us-east-1
```

6. **Deploy** → check logs:

```
Starting LiveKit Egress
  LiveKit: ws://livekit-server.railway.internal:7880
  S3: http://minio.railway.internal:9000/recordings
```

7. **Settings → Resources:** give egress at least **1 vCPU / 1 GB RAM** (2 vCPU recommended for room composite).

The entrypoint sets `insecure: true` (required for `ws://`) and lowers `room_composite_cpu_cost` so 1-vCPU Railway plans accept jobs.

---

## Step 5 — Render API environment

```env
# LiveKit (existing)
LIVEKIT_URL=https://livekit-server-production-xxxx.up.railway.app
PUBLIC_LIVEKIT_URL=wss://livekit-server-production-xxxx.up.railway.app
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecretdevsecretdevsecretdevse

# MinIO — public URL for API file upload/download
S3_ENDPOINT=https://minio-production-xxxx.up.railway.app
# Internal URL sent to Egress workers (must match minio.railway.internal)
S3_EGRESS_ENDPOINT=http://minio.railway.internal:9000
S3_ACCESS_KEY=assistlens
S3_SECRET_KEY=<same as MINIO_ROOT_PASSWORD>
S3_REGION=us-east-1
MINIO_BUCKET=recordings
FILES_BUCKET=files

# Enable record button when Egress + Redis are deployed on Railway
RECORDING_ENABLED=true
```

**Important:** `S3_ENDPOINT` = public HTTPS (Render → MinIO). `S3_EGRESS_ENDPOINT` = private HTTP (Egress → MinIO).

Redeploy Render.

---

## Step 6 — Test end-to-end

1. **New session** on Vercel (never reuse ended sessions)
2. Agent + customer join → video works
3. **Upload a file** in chat → should succeed (MinIO)
4. Agent clicks **Record** → wait ~10s → stop recording
5. Session detail → recording status **ready** → download MP4

Check Render logs if recording fails: `isRecordingAvailable` calls LiveKit Egress API on `LIVEKIT_URL`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **`egress not connected (redis required)`** | **livekit-server** missing `REDIS_URL`. Add `${{Redis.REDIS_URL}}` to livekit-server (not just egress) and redeploy. |
| **`no response from servers`** on Record | Usually same as above — livekit-server cannot see egress workers without shared Redis. |
| File upload fails | `S3_ENDPOINT` must be MinIO **public** HTTPS URL; keys must match |
| Record button grey / unavailable | Egress not running or Redis missing on livekit-server; redeploy both |
| Recording stuck `processing` | Check egress logs; verify `S3_EGRESS_ENDPOINT` is internal MinIO URL |
| `could not establish pc connection` | TCP proxy 7882 on livekit-server |
| No participants in history | Redeploy Render API (participant API fallback) + verify webhooks |
| Files lost after MinIO redeploy | Add **Volume** at `/data` on minio service |
| Internal DNS fails | Service names must be exactly `livekit-server`, `minio`, `redis` OR update env URLs |

---

## Cost

All services can run on Railway usage-based billing. For a hackathon demo, keep one instance each. Redis + MinIO + Egress + LiveKit ≈ a few dollars if left running 24/7.

---

## Local dev (optional)

Full stack on laptop:

```powershell
docker compose up -d
```

Use `infra/livekit.yaml` + local MinIO — same code paths, different hosts.

---

## Folder reference

| Path | Purpose |
| --- | --- |
| [`livekit-railway/`](../livekit-railway/) | LiveKit SFU + TCP proxy bootstrap |
| [`railway-minio/`](../railway-minio/) | MinIO S3 storage |
| [`railway-egress/`](../railway-egress/) | LiveKit Egress recorder |
