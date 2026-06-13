import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { resolveParticipant } from '../guards.js';
import type { ChatMessageRow } from '../types.js';

const postSchema = z.object({ body: z.string().min(1).max(4000) });

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  // Persist a chat message. Realtime delivery happens over the LiveKit data
  // channel; this endpoint is the durable record so history survives the call.
  app.post('/api/sessions/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Message body is required.' });
    }

    const res = await query<ChatMessageRow>(
      `INSERT INTO chat_messages (session_id, sender_identity, sender_role, sender_name, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, participant.identity, participant.role, participant.name, parsed.data.body],
    );
    return reply.code(201).send({ message: res.rows[0] });
  });

  // Retrieve chat history for the session record (during or after the call).
  app.get('/api/sessions/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

    const res = await query<ChatMessageRow>(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { messages: res.rows };
  });
}
