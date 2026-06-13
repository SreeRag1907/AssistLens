FROM minio/minio:latest

EXPOSE 9000 9001

# Entrypoint is /usr/bin/docker-entrypoint.sh — pass subcommand only.
CMD ["server", "/data", "--console-address", ":9001"]
