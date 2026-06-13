import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { migrate, seedAgent } from './db.js';
import { sweepExpiredGrace } from './presence.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { joinRoutes } from './routes/join.js';
import { messageRoutes } from './routes/messages.js';
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
  await app.register(webhookRoutes);
  await app.register(metricsRoutes);

  await migrate();
  await seedAgent();
  app.log.info('migrations applied + seed agent ready');

  // Finalize "left" once a participant's reconnect grace window elapses.
  // The grace timer lives in participants.grace_until; this sweep is the
  // worker that turns an expired window into an authoritative 'left' event.
  const sweep = setInterval(() => {
    sweepExpiredGrace().catch((err) => app.log.error({ err }, 'grace sweep failed'));
  }, 5000);
  sweep.unref();

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
