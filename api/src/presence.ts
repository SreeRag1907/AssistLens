import { query } from './db.js';

// Presence, reconnect-grace, and live counts are all derived from the
// participants table now (no Redis). "Present" == an open row (left_at IS NULL).

export async function hasOpenParticipant(sessionId: string, identity: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM participants WHERE session_id = $1 AND identity = $2 AND left_at IS NULL LIMIT 1`,
    [sessionId, identity],
  );
  return (res.rowCount ?? 0) > 0;
}

// True if the identity dropped recently and is still inside the grace window.
export async function isReconnectable(sessionId: string, identity: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM participants
     WHERE session_id = $1 AND identity = $2
       AND left_at IS NOT NULL AND grace_until IS NOT NULL AND grace_until > now()
     LIMIT 1`,
    [sessionId, identity],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function reopenParticipant(sessionId: string, identity: string): Promise<void> {
  await query(
    `UPDATE participants SET left_at = NULL, grace_until = NULL
     WHERE id = (
       SELECT id FROM participants
       WHERE session_id = $1 AND identity = $2 AND left_at IS NOT NULL
       ORDER BY joined_at DESC LIMIT 1
     )`,
    [sessionId, identity],
  );
}

export async function openParticipant(
  sessionId: string,
  role: string,
  identity: string,
  displayName: string | null,
): Promise<void> {
  await query(
    `INSERT INTO participants (session_id, role, identity, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, identity) WHERE (left_at IS NULL) DO NOTHING`,
    [sessionId, role, identity, displayName],
  );
}

// Stamp the drop and open the grace window (the grace timer lives in the row).
export async function closeParticipantWithGrace(
  sessionId: string,
  identity: string,
  graceSeconds: number,
): Promise<void> {
  await query(
    `UPDATE participants
     SET left_at = now(), grace_until = now() + ($3 || ' seconds')::interval
     WHERE session_id = $1 AND identity = $2 AND left_at IS NULL`,
    [sessionId, identity, String(graceSeconds)],
  );
}

export async function closeAllParticipants(sessionId: string): Promise<void> {
  await query(`UPDATE participants SET left_at = now(), grace_until = NULL WHERE session_id = $1 AND left_at IS NULL`, [
    sessionId,
  ]);
}

// Finalize anyone whose grace window has elapsed: log a 'left' event once and
// clear grace_until so we don't emit it again. Returns rows finalized.
export async function sweepExpiredGrace(): Promise<number> {
  const expired = await query<{ session_id: string; identity: string }>(
    `UPDATE participants
     SET grace_until = NULL
     WHERE left_at IS NOT NULL AND grace_until IS NOT NULL AND grace_until <= now()
     RETURNING session_id, identity`,
  );
  for (const row of expired.rows) {
    await query(
      `INSERT INTO events (session_id, type, identity, metadata)
       VALUES ($1, 'left', $2, $3)`,
      [row.session_id, row.identity, JSON.stringify({ reason: 'grace_window_expired' })],
    );
  }
  return expired.rowCount ?? 0;
}

export async function countActiveSessions(): Promise<number> {
  const res = await query<{ c: string }>(`SELECT count(*)::int AS c FROM sessions WHERE status = 'active'`);
  return Number(res.rows[0]?.c ?? 0);
}

export async function countConnectedParticipants(): Promise<number> {
  const res = await query<{ c: string }>(
    `SELECT count(*)::int AS c
     FROM participants p JOIN sessions s ON s.id = p.session_id
     WHERE p.left_at IS NULL AND s.status = 'active'`,
  );
  return Number(res.rows[0]?.c ?? 0);
}
