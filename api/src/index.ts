import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { migrate, seedAgent } from './db.js';
import { ensureBuckets } from './s3.js';
import { sweepExpiredGrace } from './presence.js';
import { reconcileStaleRecordings } from './recordings.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { joinRoutes } from './routes/join.js';
import { messageRoutes } from './routes/messages.js';
import { fileRoutes } from './routes/files.js';
import { adminRoutes } from './routes/admin.js';
import { webhookRoutes } from './routes/webhooks.js';
import { metricsRoutes } from './routes/metrics.js';
import { errorsTotal } from './metrics.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: config.nodeEnv === 'production' ? 'info' : 'debug' },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.nodeEnv === 'production' ? [config.publicWebOrigin] : true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  });

  // LiveKit webhooks arrive as application/webhook+json and must be read raw
  // so the HMAC signature can be verified against the exact bytes.
  app.addContentTypeParser(
    'application/webhook+json',
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  app.setErrorHandler((err, req, reply) => {
    errorsTotal.inc({ route: req.routeOptions?.url ?? 'unknown' });
    req.log.error({ err }, 'unhandled error');
    reply.code(err.statusCode ?? 500).send({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  });

  await app.register(authRoutes);
  await app.register(sessionRoutes);
  await app.register(joinRoutes);
  await app.register(messageRoutes);
  await app.register(fileRoutes);
  await app.register(adminRoutes);
  await app.register(webhookRoutes);
  await app.register(metricsRoutes);

  await migrate();
  await seedAgent();
  try {
    await ensureBuckets();
    app.log.info('S3 buckets ready');
  } catch (err) {
    app.log.warn({ err }, 'S3 bucket init failed — file upload/recording may not work until MinIO is running');
  }
  app.log.info('migrations applied + seed agent ready');

  reconcileStaleRecordings().catch((err) => app.log.warn({ err }, 'initial recording reconcile failed'));

  // Finalize "left" once a participant's reconnect grace window elapses.
  // The grace timer lives in participants.grace_until; this sweep is the
  // worker that turns an expired window into an authoritative 'left' event.
  const sweep = setInterval(() => {
    sweepExpiredGrace().catch((err) => app.log.error({ err }, 'grace sweep failed'));
  }, 5000);
  sweep.unref();

  const recordingSweep = setInterval(() => {
    reconcileStaleRecordings().catch((err) => app.log.error({ err }, 'recording reconcile failed'));
  }, 60_000);
  recordingSweep.unref();

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
