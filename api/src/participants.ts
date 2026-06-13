import { query } from './db.js';
import {
  hasOpenParticipant,
  isReconnectable,
  openParticipant,
  reopenParticipant,
} from './presence.js';
import type { Role } from './types.js';

async function logEvent(
  sessionId: string,
  type: string,
  identity: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await query(`INSERT INTO events (session_id, type, identity, metadata) VALUES ($1, $2, $3, $4)`, [
    sessionId,
    type,
    identity,
    metadata ? JSON.stringify(metadata) : null,
  ]);
}

/** Register a participant when they receive a LiveKit token (API fallback if webhooks lag). */
export async function registerParticipantJoin(
  sessionId: string,
  role: Role,
  identity: string,
  displayName: string | null,
): Promise<void> {
  if (await isReconnectable(sessionId, identity)) {
    await reopenParticipant(sessionId, identity);
    await logEvent(sessionId, 'reconnected', identity, { role, source: 'api' });
    return;
  }

  if (await hasOpenParticipant(sessionId, identity)) {
    await logEvent(sessionId, 'duplicate_join', identity, { role, source: 'api' });
    return;
  }

  await openParticipant(sessionId, role, identity, displayName);
  await logEvent(sessionId, 'joined', identity, { role, source: 'api' });
}
