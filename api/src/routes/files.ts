import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { resolveParticipant } from '../guards.js';
import { uploadBuffer, presignGet, getObjectStream, filesBucket, ensureBuckets } from '../s3.js';
import type { ChatFileRow } from '../types.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  // Upload a file attachment during (or after) a call.
  app.post('/api/sessions/:id/files', async (req, reply) => {
    const { id } = req.params as { id: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

    const data = await req.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!data) {
      return reply.code(400).send({ error: 'no_file', message: 'No file provided.' });
    }

    const contentType = data.mimetype;
    if (!ALLOWED_TYPES.has(contentType)) {
      return reply.code(415).send({
        error: 'unsupported_type',
        message: 'File type not allowed. Allowed: images, PDF, Word, Excel, text.',
      });
    }

    const fileName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const objectKey = `${id}/${randomUUID()}-${fileName}`;

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.byteLength > MAX_FILE_SIZE) {
      return reply.code(413).send({ error: 'too_large', message: 'File exceeds 20 MB limit.' });
    }

    try {
      await ensureBuckets();
      await uploadBuffer(filesBucket, objectKey, buffer, contentType);
    } catch (err) {
      req.log.error({ err }, 'file upload to S3 failed');
      return reply.code(503).send({
        error: 'storage_unavailable',
        message: 'File storage is not available. Make sure MinIO is running (docker compose up).',
      });
    }

    const res = await query<ChatFileRow>(
      `INSERT INTO chat_files (session_id, sender_identity, sender_name, file_name, file_size, content_type, object_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, participant.identity, participant.name, fileName, buffer.byteLength, contentType, objectKey],
    );
    return reply.code(201).send({ file: res.rows[0] });
  });

  // List file attachments for a session.
  app.get('/api/sessions/:id/files', async (req, reply) => {
    const { id } = req.params as { id: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

    const res = await query<ChatFileRow>(
      'SELECT * FROM chat_files WHERE session_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { files: res.rows };
  });

  // Get a presigned download URL for a file (1-hour expiry).
  app.get('/api/sessions/:id/files/:fid/url', async (req, reply) => {
    const { id, fid } = req.params as { id: string; fid: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

    const res = await query<ChatFileRow>(
      'SELECT * FROM chat_files WHERE id = $1 AND session_id = $2',
      [fid, id],
    );
    const file = res.rows[0];
    if (!file) {
      return reply.code(404).send({ error: 'not_found', message: 'File not found.' });
    }

    const url = await presignGet(filesBucket, file.object_key, 3600);
    return { url, file };
  });

  // Stream a file through the API (reliable download with auth).
  app.get('/api/sessions/:id/files/:fid/download', async (req, reply) => {
    const { id, fid } = req.params as { id: string; fid: string };
    const participant = await resolveParticipant(req, reply, id);
    if (!participant) return;

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
      req.log.error({ err }, 'file download from S3 failed');
      return reply.code(404).send({ error: 'file_missing', message: 'File not found in storage.' });
    }
  });
}
