import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { requireAgent } from '../guards.js';
import { closeAllParticipants } from '../presence.js';
import { closeRoom } from '../livekit.js';
import type { SessionRow, ParticipantRow, EventRow } from '../types.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // All sessions (live + recent) for the admin dashboard.
  // Any authenticated agent can access admin — in a production system you
  // would gate this behind an is_admin flag, but for the hackathon all
  // logged-in agents are considered ops staff.
  app.get('/api/admin/sessions', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;

    const res = await query<
      SessionRow & { agent_email: string; participant_count: number }
    >(
      `SELECT s.*,
              a.email AS agent_email,
              COUNT(p.id) FILTER (WHERE p.left_at IS NULL) AS participant_count
       FROM sessions s
       JOIN agents a ON a.id = s.agent_id
       LEFT JOIN participants p ON p.session_id = s.id
       GROUP BY s.id, a.email
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [],
    );

    return { sessions: res.rows };
  });

  // Participants for a specific session (admin view — no agent_id gate).
  app.get('/api/admin/sessions/:id/participants', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const res = await query<ParticipantRow>(
      'SELECT * FROM participants WHERE session_id = $1 ORDER BY joined_at ASC',
      [id],
    );
    return { participants: res.rows };
  });

  // Event log for a session (admin view).
  app.get('/api/admin/sessions/:id/events', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const res = await query<EventRow>(
      'SELECT * FROM events WHERE session_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { events: res.rows };
  });

  // End any active session (admin power — no agent ownership check).
  app.post('/api/admin/sessions/:id/end', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const res = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [id]);
    const session = res.rows[0];
    if (!session) {
      return reply.code(404).send({ error: 'not_found' });
    }
    if (session.status === 'ended') {
      return { ok: true, already_ended: true };
    }

    try {
      await closeRoom(session.room_name);
    } catch {
      // Room may already be gone; proceed with DB update.
    }
    await closeAllParticipants(session.id);
    await query(
      `UPDATE sessions SET status = 'ended', ended_at = now(), ended_by = $2
       WHERE id = $1 AND status = 'active'`,
      [session.id, `admin:${agent.email}`],
    );
    await query(`INSERT INTO events (session_id, type, identity) VALUES ($1, 'session_ended', $2)`, [
      session.id,
      `admin:${agent.email}`,
    ]);
    return { ok: true };
  });
}
