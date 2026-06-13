import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { signInviteToken, verifyInviteToken } from '../auth.js';
import { mintAccessToken } from '../livekit.js';
import { hasOpenParticipant } from '../presence.js';
import { registerParticipantJoin } from '../participants.js';
import type { SessionRow, RecordingRow } from '../types.js';

const joinSchema = z.object({
  code: z.string().min(4).max(12).optional(),
  token: z.string().min(1).optional(),
  name: z.string().max(80).optional(),
});

async function sessionByCode(code: string): Promise<SessionRow | null> {
  const res = await query<SessionRow>(
    'SELECT * FROM sessions WHERE LOWER(invite_code) = LOWER($1)',
    [code.trim()],
  );
  return res.rows[0] ?? null;
}

async function buildJoinResponse(session: SessionRow, displayName: string) {
  const identity = `customer-${session.id}`;
  const duplicate = await hasOpenParticipant(session.id, identity);

  await registerParticipantJoin(session.id, 'customer', identity, displayName);

  const livekitToken = await mintAccessToken({
    room: session.room_name,
    identity,
    name: displayName,
    role: 'customer',
  });

  const inviteToken = signInviteToken({
    sid: session.id,
    room: session.room_name,
    role: 'customer',
    name: displayName,
  });

  const recRes = await query<RecordingRow>(
    `SELECT * FROM recordings WHERE session_id = $1 AND status = 'in_progress' LIMIT 1`,
    [session.id],
  );

  return {
    url: config.livekit.publicUrl,
    token: livekitToken,
    inviteToken,
    identity,
    displayName,
    sessionId: session.id,
    roomName: session.room_name,
    recording: recRes.rowCount ? ('in_progress' as const) : ('idle' as const),
    duplicate,
  };
}

export async function joinRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/join', async (req, reply) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'A valid invite is required.' });
    }

    let session: SessionRow | null = null;
    let defaultName = 'Customer';

    if (parsed.data.code) {
      session = await sessionByCode(parsed.data.code);
      if (!session) {
        return reply.code(404).send({ error: 'not_found', message: 'This invite link is not valid.' });
      }
    } else if (parsed.data.token) {
      try {
        const invite = verifyInviteToken(parsed.data.token);
        const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [invite.sid]);
        session = sRes.rows[0] ?? null;
        defaultName = invite.name ?? 'Customer';
      } catch {
        return reply.code(401).send({
          error: 'invalid_invite',
          message: 'This invite link is invalid or has expired. Please ask your support agent for a new link.',
        });
      }
    } else {
      return reply.code(400).send({ error: 'bad_request', message: 'Invite code or token is required.' });
    }

    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'This support session no longer exists.' });
    }

    if (session.status === 'ended') {
      return reply.code(410).send({
        error: 'session_ended',
        message: 'This support session has already ended.',
      });
    }

    const displayName = parsed.data.name?.trim() || defaultName;
    return buildJoinResponse(session, displayName);
  });

  // Pre-flight by short code: GET /api/invite/xk9m2pqa
  app.get('/api/invite/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const session = await sessionByCode(code);
    if (!session) return { valid: false, reason: 'not_found' };
    if (session.status === 'ended') return reply.code(410).send({ valid: false, reason: 'ended' });
    return { valid: true, sessionTitle: session.title ?? 'Video support session', code: session.invite_code };
  });

  // Legacy: GET /api/invite?token=jwt
  app.get('/api/invite', async (req, reply) => {
    const token = (req.query as { token?: string }).token;
    if (!token) {
      return reply.code(400).send({ valid: false, reason: 'missing', message: 'Invite token is required.' });
    }
    try {
      const invite = verifyInviteToken(token);
      const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [invite.sid]);
      const session = sRes.rows[0];
      if (!session) return reply.code(404).send({ valid: false, reason: 'not_found' });
      if (session.status === 'ended') return reply.code(410).send({ valid: false, reason: 'ended' });
      return {
        valid: true,
        sessionTitle: session.title ?? 'Video support session',
        code: session.invite_code,
      };
    } catch {
      return reply.code(401).send({
        valid: false,
        reason: 'invalid',
        message: 'This invite link is invalid or has expired. Please ask your support agent for a new link.',
      });
    }
  });
}
