FROM minio/mc:latest AS mc
FROM minio/minio:latest

COPY --from=mc /bin/mc /usr/local/bin/mc
COPY --chmod=755 entrypoint.sh /entrypoint.sh

EXPOSE 9000 9001

VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
