import jwt from 'jsonwebtoken';
import { config } from './config.js';
import type { AgentClaims, InviteClaims } from './types.js';

export function signAgentToken(claims: AgentClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '12h' });
}

export function verifyAgentToken(token: string): AgentClaims {
  return jwt.verify(token, config.jwtSecret) as AgentClaims;
}

// Scoped, expiring signed invite token — the customer access-control primitive.
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
