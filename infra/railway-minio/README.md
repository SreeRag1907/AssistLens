# MinIO on Railway

## Option A — Docker Image (recommended if GitHub build keeps failing)

No Dockerfile build. Railway pulls the official image directly.

1. **Delete** the broken `minio` GitHub service (or rename it)
2. **+ New** → **Docker Image** (or **Empty Service** → change source to Docker Image)
3. **Image:** `minio/minio:latest`
4. **Service name:** `minio`
5. **Settings → Deploy → Custom Start Command:**
   ```
   server /data --console-address :9001
   ```
6. **Settings → Networking** → Generate Domain → port **9000**
7. **Variables:**
   ```env
   MINIO_ROOT_USER=assistlens
   MINIO_ROOT_PASSWORD=MyAssistLensSecret2026
   ```
8. **Ctrl+K** → **Add Volume** → service `minio` → mount **`/data`**
9. Optional: `RAILWAY_RUN_UID=0`
10. **Deploy**

---

## Option B — GitHub (Dockerfile in this folder)

**Root Directory:** `infra/railway-minio` — **no leading `/`**

If Details shows `/infra/railway-minio`, remove the slash and redeploy.

Variables same as Option A. Volume mount `/data`.

Full stack guide: [`../railway/README.md`](../railway/README.md)
