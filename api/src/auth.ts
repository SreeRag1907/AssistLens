import jwt from 'jsonwebtoken';
import { config } from './config.js';
import type { InviteClaims, StaffClaims } from './types.js';

export function signStaffToken(claims: StaffClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '12h' });
}

/** @deprecated use signStaffToken */
export const signAgentToken = signStaffToken;

export function verifyStaffToken(token: string): StaffClaims {
  return jwt.verify(token, config.jwtSecret) as StaffClaims;
}

/** @deprecated use verifyStaffToken */
export const verifyAgentToken = verifyStaffToken;

export function signInviteToken(claims: InviteClaims): string {
  return jwt.sign(claims, config.inviteSecret, { expiresIn: config.inviteTtlSeconds });
}

export function verifyInviteToken(token: string): InviteClaims {
  return jwt.verify(token, config.inviteSecret) as InviteClaims;
}

export function bearer(header?: string): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value;
}
