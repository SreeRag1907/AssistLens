import { Registry, Gauge, Counter, collectDefaultMetrics } from 'prom-client';
import { countActiveSessions, countConnectedParticipants } from './presence.js';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const activeSessions = new Gauge({
  name: 'assistlens_active_sessions',
  help: 'Number of currently active support sessions',
  registers: [registry],
});

const connectedParticipants = new Gauge({
  name: 'assistlens_connected_participants',
  help: 'Number of participants currently connected across all sessions',
  registers: [registry],
});

export const errorsTotal = new Counter({
  name: 'assistlens_errors_total',
  help: 'Total number of API errors',
  labelNames: ['route'] as const,
  registers: [registry],
});

export async function renderMetrics(): Promise<string> {
  // Refresh live gauges from Postgres at scrape time.
  activeSessions.set(await countActiveSessions());
  connectedParticipants.set(await countConnectedParticipants());
  return registry.metrics();
}
