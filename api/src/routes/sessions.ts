import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { signInviteToken } from '../auth.js';
import { requireAgent } from '../guards.js';
import { closeAllParticipants } from '../presence.js';
import { isRecordingAvailable, mintAccessToken, closeRoom, startRoomRecording, stopRecording } from '../livekit.js';
import type { SessionRow, ParticipantRow, EventRow, RecordingRow } from '../types.js';

const createSchema = z.object({ title: z.string().max(200).optional() });

function inviteUrl(token: string): string {
  return `${config.publicWebOrigin}/join?token=${encodeURIComponent(token)}`;
}

// A fresh, scoped, expiring customer invite for a session. Tokens are not
// persisted — we re-mint on demand so the agent can re-share at any time.
function makeInvite(session: SessionRow): { token: string; url: string } {
  const token = signInviteToken({
    sid: session.id,
    room: session.room_name,
    role: 'customer',
    name: 'Customer',
  });
  return { token, url: inviteUrl(token) };
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // Create a session (agent only) and return a shareable customer invite link.
  app.post('/api/sessions', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;

    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Invalid session payload.' });
    }

    const roomName = `room_${randomUUID()}`;
    const res = await query<SessionRow>(
      `INSERT INTO sessions (agent_id, room_name, title)
       VALUES ($1, $2, $3) RETURNING *`,
      [agent.agentId, roomName, parsed.data.title ?? null],
    );
    const session = res.rows[0];
    await query(`INSERT INTO events (session_id, type, identity) VALUES ($1, 'session_created', $2)`, [
      session.id,
      agent.identity,
    ]);

    return reply.code(201).send({
      session,
      invite: makeInvite(session),
    });
  });

  // Re-mint a shareable customer invite link for an existing (active) session.
  app.get('/api/sessions/:id/invite', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1 AND agent_id = $2', [
      id,
      agent.agentId,
    ]);
    const session = sRes.rows[0];
    if (!session) return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    if (session.status === 'ended') {
      return reply
        .code(410)
        .send({ error: 'session_ended', message: 'This session has ended — its link can no longer be used.' });
    }
    return makeInvite(session);
  });

  // List the agent's sessions with computed durations + live counts.
  app.get('/api/sessions', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const res = await query(
      `SELECT s.*,
              (SELECT count(*) FROM participants p WHERE p.session_id = s.id) AS participant_count,
              (SELECT count(*) FROM participants p WHERE p.session_id = s.id AND p.left_at IS NULL) AS live_count
       FROM sessions s
       WHERE s.agent_id = $1
       ORDER BY s.created_at DESC`,
      [agent.agentId],
    );
    return { sessions: res.rows };
  });

  // Full detail for one session (participants, events, chat count, recordings).
  app.get('/api/sessions/:id', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1 AND agent_id = $2', [
      id,
      agent.agentId,
    ]);
    const session = sRes.rows[0];
    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    }

    const [participants, events, recordings] = await Promise.all([
      query<ParticipantRow>('SELECT * FROM participants WHERE session_id = $1 ORDER BY joined_at', [id]),
      query<EventRow>('SELECT * FROM events WHERE session_id = $1 ORDER BY created_at', [id]),
      query<RecordingRow>('SELECT * FROM recordings WHERE session_id = $1 ORDER BY created_at', [id]),
    ]);

    return {
      session,
      participants: participants.rows,
      events: events.rows,
      recordings: recordings.rows,
    };
  });

  // Whether the LiveKit Egress service is running (needed for call recording).
  app.get('/api/recording/status', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const available = await isRecordingAvailable();
    return {
      available,
      hint: available
        ? undefined
        : 'Start the recording stack: docker compose -f docker-compose.recording.yml up',
    };
  });

  // Mint a LiveKit access token so the agent can join their own room.
  app.get('/api/sessions/:id/agent-token', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1 AND agent_id = $2', [
      id,
      agent.agentId,
    ]);
    const session = sRes.rows[0];
    if (!session) return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    if (session.status === 'ended') {
      return reply.code(410).send({ error: 'session_ended', message: 'This session has already ended.' });
    }

    const token = await mintAccessToken({
      room: session.room_name,
      identity: agent.identity,
      name: agent.email,
      role: 'agent',
    });
    return { url: config.livekit.publicUrl, token, identity: agent.identity, roomName: session.room_name };
  });

  // End a session (agent only) — closes all media connections cleanly.
  app.post('/api/sessions/:id/end', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1 AND agent_id = $2', [
      id,
      agent.agentId,
    ]);
    const session = sRes.rows[0];
    if (!session) return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });

    await closeRoom(session.room_name);
    await query(
      `UPDATE sessions SET status = 'ended', ended_at = now(), ended_by = $2
       WHERE id = $1 AND status = 'active'`,
      [id, agent.identity],
    );
    await closeAllParticipants(id);
    await query(`INSERT INTO events (session_id, type, identity) VALUES ($1, 'session_ended', $2)`, [
      id,
      agent.identity,
    ]);

    return { ok: true };
  });

  // ── Recording (bonus) ──────────────────────────────────────────────────
  app.post('/api/sessions/:id/recording/start', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const sRes = await query<SessionRow>('SELECT * FROM sessions WHERE id = $1 AND agent_id = $2', [
      id,
      agent.agentId,
    ]);
    const session = sRes.rows[0];
    if (!session) return reply.code(404).send({ error: 'not_found', message: 'Session not found.' });
    if (session.status === 'ended') {
      return reply.code(410).send({ error: 'session_ended', message: 'Session already ended.' });
    }

    try {
      const { egressId, objectKey } = await startRoomRecording(session.room_name);
      const rec = await query<RecordingRow>(
        `INSERT INTO recordings (session_id, egress_id, status, object_key)
         VALUES ($1, $2, 'in_progress', $3) RETURNING *`,
        [id, egressId, objectKey],
      );
      await query(`INSERT INTO events (session_id, type, identity) VALUES ($1, 'recording_started', $2)`, [
        id,
        agent.identity,
      ]);
      return { recording: rec.rows[0] };
    } catch (err) {
      req.log.error({ err }, 'failed to start recording');
      return reply
        .code(503)
        .send({ error: 'recording_unavailable', message: 'Recording service is not available.' });
    }
  });

  app.post('/api/sessions/:id/recording/stop', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };

    const recRes = await query<RecordingRow>(
      `SELECT r.* FROM recordings r
       JOIN sessions s ON s.id = r.session_id
       WHERE r.session_id = $1 AND s.agent_id = $2 AND r.status = 'in_progress'
       ORDER BY r.created_at DESC LIMIT 1`,
      [id, agent.agentId],
    );
    const rec = recRes.rows[0];
    if (!rec || !rec.egress_id) {
      return reply.code(404).send({ error: 'not_recording', message: 'No active recording to stop.' });
    }

    try {
      await stopRecording(rec.egress_id);
    } catch (err) {
      req.log.error({ err }, 'failed to stop recording');
    }
    await query(`UPDATE recordings SET status = 'processing', updated_at = now() WHERE id = $1`, [rec.id]);
    await query(`INSERT INTO events (session_id, type, identity) VALUES ($1, 'recording_stopped', $2)`, [
      id,
      agent.identity,
    ]);
    return { ok: true };
  });

  // Stream a finished recording through the API (avoids presigned-URL blank-tab issues).
  app.get('/api/sessions/:id/recording/:rid/download', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id, rid } = req.params as { id: string; rid: string };
    const recRes = await query<RecordingRow>(
      `SELECT r.* FROM recordings r JOIN sessions s ON s.id = r.session_id
       WHERE r.id = $1 AND r.session_id = $2 AND s.agent_id = $3`,
      [rid, id, agent.agentId],
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
        .send({ error: 'processing', message: 'Recording is still processing, please try again shortly.' });
    }

    const { objectExists, getObjectStream, recordingsBucket } = await import('../s3.js');
    const exists = await objectExists(recordingsBucket, rec.object_key);
    if (!exists) {
      await query(`UPDATE recordings SET status = 'processing', updated_at = now() WHERE id = $1`, [rec.id]);
      return reply
        .code(404)
        .send({
          error: 'file_missing',
          message: 'Recording file not found in storage. Please record again with Docker running.',
        });
    }

    const obj = await getObjectStream(recordingsBucket, rec.object_key);
    const fileName = rec.object_key.split('/').pop() ?? 'recording.mp4';
    reply.header('Content-Type', obj.ContentType ?? 'video/mp4');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    if (obj.ContentLength) reply.header('Content-Length', obj.ContentLength);
    return reply.send(obj.Body);
  });

  // Presigned download URL for a finished recording.
  app.get('/api/sessions/:id/recording/:rid/url', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id, rid } = req.params as { id: string; rid: string };
    const recRes = await query<RecordingRow>(
      `SELECT r.* FROM recordings r JOIN sessions s ON s.id = r.session_id
       WHERE r.id = $1 AND r.session_id = $2 AND s.agent_id = $3`,
      [rid, id, agent.agentId],
    );
    const rec = recRes.rows[0];
    if (!rec || !rec.object_key) {
      return reply.code(404).send({ error: 'not_ready', message: 'Recording is not ready yet.' });
    }
    if (rec.status === 'failed') {
      return reply.code(410).send({ error: 'recording_failed', message: 'Recording failed to process.' });
    }
    if (rec.status !== 'ready') {
      return reply.code(202).send({ error: 'processing', message: 'Recording is still processing, please try again shortly.' });
    }

    const { objectExists, presignGet, recordingsBucket } = await import('../s3.js');
    const exists = await objectExists(recordingsBucket, rec.object_key);
    if (!exists) {
      await query(`UPDATE recordings SET status = 'processing', updated_at = now() WHERE id = $1`, [rec.id]);
      return reply
        .code(202)
        .send({ error: 'processing', message: 'Recording file is still being written. Please try again in a moment.' });
    }

    const url = await presignGet(recordingsBucket, rec.object_key, 3600);
    return { url };
  });

  // List recordings for a session with current status (used for status polling).
  app.get('/api/sessions/:id/recordings', async (req, reply) => {
    const agent = await requireAgent(req, reply);
    if (!agent) return;
    const { id } = req.params as { id: string };
    const owns = await query('SELECT 1 FROM sessions WHERE id = $1 AND agent_id = $2', [id, agent.agentId]);
    if ((owns.rowCount ?? 0) === 0) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const res = await query<RecordingRow>(
      'SELECT * FROM recordings WHERE session_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { recordings: res.rows };
  });
}
