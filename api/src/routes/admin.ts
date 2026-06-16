import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { requireAdmin } from '../guards.js';
import { closeAllParticipants } from '../presence.js';
import { closeRoom, stopRecording } from '../livekit.js';
import { reconcileStaleRecordings } from '../recordings.js';
import { inviteUrl } from '../inviteCode.js';
import { getObjectStream, objectExists, recordingsBucket, filesBucket } from '../s3.js';
import type {
  SessionRow,
  ParticipantRow,
  EventRow,
  RecordingRow,
  ChatMessageRow,
  ChatFileRow,
} from '../types.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/sessions', async (req, reply) => {
    const agent = await requireAdmin(req, reply);
    if (!agent) return;

    const res = await query<
      SessionRow & { agent_email: string; participant_count: number; live_count: number }
    >(
      `SELECT s.*,
              a.email AS agent_email,
              COUNT(p.id) FILTER (WHERE p.identity NOT LIKE 'EG_%')::int AS participant_count,
              COUNT(p.id) FILTER (WHERE p.left_at IS NULL AND p.identity NOT LIKE 'EG_%')::int AS live_count
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

  app.get('/api/admin/sessions/:id/participants', async (req, reply) => {
    const agent = await requireAdmin(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const res = await query<ParticipantRow>(
      'SELECT * FROM participants WHERE session_id = $1 AND identity NOT LIKE \'EG_%\' ORDER BY joined_at ASC',
      [id],
    );
    return { participants: res.rows };
  });

  // Full session detail — same breadth as agent session view, cross-agent.
  app.get('/api/admin/sessions/:id/detail', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow & { agent_email: string }>(
      `SELECT s.*, a.email AS agent_email
       FROM sessions s
       JOIN agents a ON a.id = s.agent_id
       WHERE s.id = $1`,
      [id],
    );
    const session = sRes.rows[0];
    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    }

    await reconcileStaleRecordings(id);

    const [participants, events, recordings, messages, chatFiles] = await Promise.all([
      query<ParticipantRow>(
        'SELECT * FROM participants WHERE session_id = $1 AND identity NOT LIKE \'EG_%\' ORDER BY joined_at ASC',
        [id],
      ),
      query<EventRow>(
        `SELECT * FROM (
           SELECT * FROM events WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200
         ) e ORDER BY created_at ASC`,
        [id],
      ),
      query<RecordingRow>('SELECT * FROM recordings WHERE session_id = $1 ORDER BY created_at ASC', [id]),
      query<ChatMessageRow>(
        'SELECT id, sender_identity, sender_role, sender_name, body, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [id],
      ),
      query<ChatFileRow>(
        'SELECT id, session_id, sender_identity, sender_name, file_name, file_size, content_type, object_key, created_at FROM chat_files WHERE session_id = $1 ORDER BY created_at ASC',
        [id],
      ),
    ]);

    const invite = session.invite_code ? { code: session.invite_code, url: inviteUrl(session.invite_code) } : null;

    return {
      session,
      participants: participants.rows,
      events: events.rows,
      recordings: recordings.rows,
      messages: messages.rows,
      files: chatFiles.rows,
      invite,
    };
  });

  app.get('/api/admin/sessions/:id/events', async (req, reply) => {
    const agent = await requireAdmin(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const res = await query<EventRow>(
      `SELECT * FROM (
         SELECT * FROM events WHERE session_id = $1 ORDER BY created_at DESC LIMIT 100
       ) e ORDER BY created_at ASC`,
      [id],
    );
    return { events: res.rows };
  });

  app.get('/api/admin/sessions/:id/recordings', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { id } = req.params as { id: string };

    const exists = await query('SELECT 1 FROM sessions WHERE id = $1', [id]);
    if ((exists.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    }

    await reconcileStaleRecordings(id);
    const res = await query<RecordingRow>(
      'SELECT * FROM recordings WHERE session_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { recordings: res.rows };
  });

  app.get('/api/admin/sessions/:id/recording/:rid/download', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { id, rid } = req.params as { id: string; rid: string };

    const recRes = await query<RecordingRow>(
      'SELECT * FROM recordings WHERE id = $1 AND session_id = $2',
      [rid, id],
    );
    const rec = recRes.rows[0];
    if (!rec || !rec.object_key) {
      return reply.code(404).send({ error: 'not_ready', message: 'Recording is not ready yet.' });
    }
    if (rec.status === 'failed') {
      return reply.code(410).send({ error: 'recording_failed', message: 'Recording failed to process.' });
    }
    if (rec.status !== 'ready') {
      return reply
        .code(202)
        .send({ error: 'processing', message: 'Recording is still processing — wait until status shows Ready.' });
    }

    const exists = await objectExists(recordingsBucket, rec.object_key);
    if (!exists) {
      await query(`UPDATE recordings SET status = 'failed', updated_at = now() WHERE id = $1`, [rec.id]);
      return reply.code(404).send({
        error: 'file_missing',
        message: 'Recording file not found in storage.',
      });
    }

    const obj = await getObjectStream(recordingsBucket, rec.object_key);
    const fileName = rec.object_key.split('/').pop() ?? 'recording.mp4';
    reply.header('Content-Type', obj.ContentType ?? 'video/mp4');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    if (obj.ContentLength) reply.header('Content-Length', obj.ContentLength);
    return reply.send(obj.Body);
  });

  app.get('/api/admin/sessions/:id/files/:fid/download', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { id, fid } = req.params as { id: string; fid: string };

    const res = await query<ChatFileRow>(
      'SELECT * FROM chat_files WHERE id = $1 AND session_id = $2',
      [fid, id],
    );
    const file = res.rows[0];
    if (!file) {
      return reply.code(404).send({ error: 'not_found', message: 'File not found.' });
    }

    try {
      const obj = await getObjectStream(filesBucket, file.object_key);
      reply.header('Content-Type', obj.ContentType ?? file.content_type);
      reply.header('Content-Disposition', `attachment; filename="${file.file_name}"`);
      if (obj.ContentLength) reply.header('Content-Length', obj.ContentLength);
      return reply.send(obj.Body);
    } catch (err) {
      req.log.error({ err }, 'admin file download failed');
      return reply.code(404).send({ error: 'file_missing', message: 'File not found in storage.' });
    }
  });

  app.post('/api/admin/sessions/:id/end', async (req, reply) => {
    const agent = await requireAdmin(req, reply);
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

    const recRes = await query<{ id: string; egress_id: string | null }>(
      `SELECT id, egress_id FROM recordings WHERE session_id = $1 AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`,
      [session.id],
    );
    const activeRec = recRes.rows[0];
    if (activeRec?.egress_id) {
      try {
        await stopRecording(activeRec.egress_id);
        await query(`UPDATE recordings SET status = 'processing', updated_at = now() WHERE id = $1`, [activeRec.id]);
        await new Promise((r) => setTimeout(r, 3000));
      } catch {
        /* proceed with session end */
      }
    }

    try {
      await closeRoom(session.room_name);
    } catch {
      /* Room may already be gone */
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
