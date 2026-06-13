import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { config } from '../config.js';
import { webhookReceiver } from '../livekit.js';
import {
  hasOpenParticipant,
  isReconnectable,
  reopenParticipant,
  openParticipant,
  closeParticipantWithGrace,
  closeAllParticipants,
} from '../presence.js';
import type { SessionRow, Role } from '../types.js';

function roleFromIdentity(identity: string): Role {
  return identity.startsWith('agent') ? 'agent' : 'customer';
}

async function sessionByRoom(room: string): Promise<SessionRow | null> {
  const res = await query<SessionRow>('SELECT * FROM sessions WHERE room_name = $1', [room]);
  return res.rows[0] ?? null;
}

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

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/webhooks/livekit', async (req, reply) => {
    const auth = req.headers.authorization;
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    let event;
    try {
      event = await webhookReceiver.receive(raw, auth);
    } catch (err) {
      req.log.warn({ err }, 'rejected livekit webhook (bad signature)');
      return reply.code(401).send({ error: 'invalid_signature' });
    }

    const roomName = event.room?.name;
    const identity = event.participant?.identity;

    try {
      switch (event.event) {
        case 'participant_joined': {
          if (!roomName || !identity) break;
          const session = await sessionByRoom(roomName);
          if (!session) break;
          const role = roleFromIdentity(identity);
          const name = event.participant?.name ?? null;

          if (await isReconnectable(session.id, identity)) {
            // Reconnect within the grace window — re-open the prior row,
            // do NOT treat as a fresh join (others were never notified).
            await reopenParticipant(session.id, identity);
            await logEvent(session.id, 'reconnected', identity, { role });
            break;
          }

          if (await hasOpenParticipant(session.id, identity)) {
            // Same identity already considered present — duplicate join.
            await logEvent(session.id, 'duplicate_join', identity, { role });
          } else {
            await openParticipant(session.id, role, identity, name);
            await logEvent(session.id, 'joined', identity, { role });
          }
          break;
        }

        case 'participant_left': {
          if (!roomName || !identity) break;
          const session = await sessionByRoom(roomName);
          if (!session) break;
          // Stamp the drop and open the grace window (the timer lives in the row).
          await closeParticipantWithGrace(session.id, identity, config.reconnectGraceSeconds);
          await logEvent(session.id, 'disconnected', identity, {
            grace_seconds: config.reconnectGraceSeconds,
          });
          break;
        }

        case 'room_finished': {
          if (!roomName) break;
          const session = await sessionByRoom(roomName);
          if (!session) break;
          await closeAllParticipants(session.id);
          await query(
            `UPDATE sessions SET status = 'ended', ended_at = COALESCE(ended_at, now())
             WHERE id = $1 AND status = 'active'`,
            [session.id],
          );
          await logEvent(session.id, 'room_finished', null);
          break;
        }

        case 'egress_started':
        case 'egress_updated':
        case 'egress_ended': {
          const info = event.egressInfo;
          if (!info) break;
          const recRes = await query<{ session_id: string }>(
            `SELECT session_id FROM recordings WHERE egress_id = $1`,
            [info.egressId],
          );
          const sessionId = recRes.rows[0]?.session_id;
          if (!sessionId) break;

          if (event.event === 'egress_ended') {
            // EGRESS_COMPLETE = 3, EGRESS_FAILED = 4 in the enum.
            const failed = info.status === 4;
            const fileKey = info.fileResults?.[0]?.filename ?? null;
            await query(
              `UPDATE recordings SET status = $2, object_key = COALESCE($3, object_key), updated_at = now()
               WHERE egress_id = $1`,
              [info.egressId, failed ? 'failed' : 'ready', fileKey],
            );
            await logEvent(sessionId, failed ? 'recording_failed' : 'recording_ready', null);
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      req.log.error({ err, event: event.event }, 'error handling webhook');
    }

    return reply.send({ ok: true });
  });
}
