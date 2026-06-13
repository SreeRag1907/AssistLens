import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { query } from './db.js';

// Unambiguous alphabet (no 0/O, 1/l/I).
const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

export function inviteUrl(code: string): string {
  return `${config.publicWebOrigin}/j/${code}`;
}

/** Ensure every session has a unique short invite code. */
export async function backfillInviteCodes(): Promise<void> {
  const res = await query<{ id: string }>('SELECT id FROM sessions WHERE invite_code IS NULL');
  for (const row of res.rows) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      try {
        await query('UPDATE sessions SET invite_code = $1 WHERE id = $2', [code, row.id]);
        break;
      } catch {
        /* unique violation — retry */
      }
    }
  }
}
