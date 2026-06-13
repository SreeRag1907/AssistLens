import { query } from './db.js';
import { objectExists, recordingsBucket } from './s3.js';
import type { RecordingRow } from './types.js';

const STALE_PROCESSING_MS = 5 * 60 * 1000;
const STALE_IN_PROGRESS_MS = 10 * 60 * 1000;

/** Reconcile recording rows against S3 — fixes stuck processing after Docker/MinIO resets. */
export async function reconcileStaleRecordings(sessionId?: string): Promise<void> {
  const params: string[] = [];
  const sessionClause = sessionId ? `AND session_id = $1` : '';
  if (sessionId) params.push(sessionId);

  const res = await query<RecordingRow>(
    `SELECT * FROM recordings
     WHERE status IN ('processing', 'ready', 'in_progress')
       AND updated_at < now() - interval '90 seconds'
       ${sessionClause}`,
    params,
  );

  for (const rec of res.rows) {
    const ageMs = Date.now() - new Date(rec.updated_at).getTime();

    if (!rec.object_key) {
      if (rec.status === 'in_progress' && ageMs > STALE_IN_PROGRESS_MS) {
        await query(`UPDATE recordings SET status = 'failed', updated_at = now() WHERE id = $1`, [rec.id]);
      }
      continue;
    }

    const exists = await objectExists(recordingsBucket, rec.object_key);
    if (exists) {
      if (rec.status === 'processing') {
        await query(`UPDATE recordings SET status = 'ready', updated_at = now() WHERE id = $1`, [rec.id]);
      }
      continue;
    }

    if (rec.status === 'in_progress') {
      if (ageMs > STALE_IN_PROGRESS_MS) {
        await query(`UPDATE recordings SET status = 'failed', updated_at = now() WHERE id = $1`, [rec.id]);
      }
      continue;
    }

    if (rec.status === 'ready' || ageMs > STALE_PROCESSING_MS) {
      await query(`UPDATE recordings SET status = 'failed', updated_at = now() WHERE id = $1`, [rec.id]);
    }
  }
}
