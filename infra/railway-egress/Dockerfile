FROM livekit/egress:latest

# Base image filesystem is read-only for RUN chmod — set mode at copy time.
COPY --chmod=755 entrypoint.sh /railway-entrypoint.sh

ENTRYPOINT ["/railway-entrypoint.sh"]
