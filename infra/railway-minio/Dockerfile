FROM minio/minio:latest

EXPOSE 9000 9001

VOLUME ["/data"]

# Buckets are auto-created by the Render API (ensureBuckets in s3.ts) on first upload.
CMD ["minio", "server", "/data", "--console-address", ":9001"]
