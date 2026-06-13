import type { FastifyInstance } from 'fastify';
import { renderMetrics, registry } from '../metrics.js';

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return renderMetrics();
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
}
