import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { verifyInviteToken } from '../auth.js';
import { mintAccessToken } from '../livekit.js';
import { hasOpenParticipant } from '../presence.js';
import type { SessionRow, RecordingRow } from '../types.js';

const joinSchema = z.object({
  token: z.string().min(1),
  name: z.string().max(80).optional(),
});

export async function joinRoutes(app: FastifyInstance): Promise<void> {
  // Customer join — the invite token is the only credential required.
  app.post('/api/join', async (req, reply) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'A valid invite is required.' });
    }

    let invite;
    try {
      invite = verifyInviteToken(parsed.data.token);
    } catch {
      return reply.code(401).send({
        error: 'invalid_invite',
        message: 'This invite link is invalid or has expired. Please ask your support agent for a new link.',
      });
    }

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [invite.sid]);
    const session = sRes.rows[0];
    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'This support session no longer exists.' });
    }
    if (session.status === 'ended') {
      return reply.code(410).send({
        error: 'session_ended',
        message: 'This support session has already ended.',
      });
    }

    const identity = `customer-${invite.sid}`;
    const displayName = parsed.data.name?.trim() || invite.name || 'Customer';

    // Duplicate-join detection: same invite already connected elsewhere.
    const duplicate = await hasOpenParticipant(session.id, identity);

    const token = await mintAccessToken({
      room: session.room_name,
      identity,
      name: displayName,
      role: 'customer',
    });

    // Surface recording status so the customer can be shown a consent banner.
    const recRes = await query<RecordingRow>(
      `SELECT * FROM recordings WHERE session_id = $1 AND status = 'in_progress' LIMIT 1`,
      [invite.sid],
    );

    return {
      url: config.livekit.publicUrl,
      token,
      identity,
      displayName,
      sessionId: session.id,
      roomName: session.room_name,
      recording: recRes.rowCount ? 'in_progress' : 'idle',
      duplicate,
    };
  });

  // Lightweight pre-flight so the customer page can show a friendly error
  // before requesting camera/mic permissions.
  app.get('/api/invite/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    try {
      const invite = verifyInviteToken(token);
      const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [invite.sid]);
      const session = sRes.rows[0];
      if (!session) return reply.code(404).send({ valid: false, reason: 'not_found' });
      if (session.status === 'ended') return reply.code(410).send({ valid: false, reason: 'ended' });
      return { valid: true, sessionTitle: session.title ?? 'Video support session' };
    } catch {
      return reply.code(401).send({ valid: false, reason: 'invalid' });
    }
  });
}
