# MinIO on Railway

Deploy with **Root Directory:** `infra/railway-minio` (no leading `/`)

Uses the official `minio/minio` image. Buckets are created automatically by the Render API on first upload.

Full setup: **[`../railway/README.md`](../railway/README.md)**

**Required variables** (Railway → minio → Variables):

```env
MINIO_ROOT_USER=assistlens
MINIO_ROOT_PASSWORD=choose-a-long-secret
```

Optional (defaults match API):

```env
FILES_BUCKET=files
MINIO_BUCKET=recordings
```
