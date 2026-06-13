import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  jwtSecret: required('JWT_SECRET', 'dev-jwt-secret'),
  inviteSecret: required('INVITE_SECRET', 'dev-invite-secret'),

  agentEmail: required('AGENT_EMAIL', 'agent@assistlens.dev'),
  agentPassword: required('AGENT_PASSWORD', 'demo-agent-pass'),

  databaseUrl: required('DATABASE_URL', 'postgres://assistlens:assistlens@localhost:5432/assistlens'),

  livekit: {
    apiKey: required('LIVEKIT_API_KEY', 'devkey'),
    apiSecret: required('LIVEKIT_API_SECRET', 'devsecretdevsecretdevsecretdevse'),
    url: required('LIVEKIT_URL', 'http://localhost:7880'),
    publicUrl: required('PUBLIC_LIVEKIT_URL', 'ws://localhost:7880'),
  },

  publicWebOrigin: required('PUBLIC_WEB_ORIGIN', 'http://localhost:5173'),

  s3: {
    // Host-reachable MinIO URL (API reads/writes, presigned URLs).
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    // Egress runs in Docker Compose — use the internal MinIO hostname, never localhost.
    egressEndpoint: process.env.S3_EGRESS_ENDPOINT ?? 'http://minio:9000',
    accessKey: process.env.S3_ACCESS_KEY ?? 'assistlens',
    secretKey: process.env.S3_SECRET_KEY ?? 'assistlens-minio',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.MINIO_BUCKET ?? 'recordings',
    filesBucket: process.env.FILES_BUCKET ?? 'files',
  },

  reconnectGraceSeconds: Number(process.env.RECONNECT_GRACE_SECONDS ?? 30),
  inviteTtlSeconds: Number(process.env.INVITE_TTL_SECONDS ?? 86400),
};

export type AppConfig = typeof config;
