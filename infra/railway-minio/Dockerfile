FROM minio/mc:latest AS mc
FROM minio/minio:latest

COPY --from=mc /usr/bin/mc /usr/local/bin/mc
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 9000 9001

VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
