import type { FastifyReply, FastifyRequest } from 'fastify';
import { bearer, verifyStaffToken, verifyInviteToken } from './auth.js';
import { query } from './db.js';
import type { Role, StaffClaims } from './types.js';

export interface AgentContext {
  agentId: string;
  email: string;
  identity: string;
}

export interface AdminContext {
  adminId: string;
  email: string;
}

export interface ParticipantContext {
  role: Role;
  identity: string;
  name: string;
  sessionId: string;
}

function verifyRole(token: string, role: StaffClaims['role']): StaffClaims | null {
  try {
    const claims = verifyStaffToken(token);
    if (claims.role !== role) return null;
    return claims;
  } catch {
    return null;
  }
}

// Guard for agent-only actions (create/end session, recording control).
export async function requireAgent(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<AgentContext | null> {
  const token = bearer(req.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'auth_required', message: 'Agent authentication required.' });
    return null;
  }
  const claims = verifyRole(token, 'agent');
  if (!claims) {
    reply.code(403).send({ error: 'forbidden', message: 'Agent access required. Use the agent login.' });
    return null;
  }
  return { agentId: claims.sub, email: claims.email, identity: `agent-${claims.sub}` };
}

// Guard for admin dashboard — separate login, separate JWT role.
export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<AdminContext | null> {
  const token = bearer(req.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'auth_required', message: 'Admin authentication required.' });
    return null;
  }
  const claims = verifyRole(token, 'admin');
  if (!claims) {
    reply.code(403).send({ error: 'forbidden', message: 'Admin access required. Use the admin login.' });
    return null;
  }
  return { adminId: claims.sub, email: claims.email };
}

export async function resolveParticipant(
  req: FastifyRequest,
  reply: FastifyReply,
  sessionId: string,
): Promise<ParticipantContext | null> {
  const token = bearer(req.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'auth_required', message: 'Authentication required.' });
    return null;
  }

  try {
    const claims = verifyStaffToken(token);
    if (claims.role === 'agent') {
      const owns = await query(
        'SELECT 1 FROM sessions WHERE id = $1 AND agent_id = $2',
        [sessionId, claims.sub],
      );
      if (owns.rowCount === 0) {
        reply.code(403).send({ error: 'forbidden', message: 'You do not have access to this session.' });
        return null;
      }
      return { role: 'agent', identity: `agent-${claims.sub}`, name: claims.email, sessionId };
    }
  } catch {
    /* fall through to invite token */
  }

  try {
    const invite = verifyInviteToken(token);
    if (invite.sid !== sessionId) {
      reply.code(403).send({ error: 'forbidden', message: 'This invite is not valid for this session.' });
      return null;
    }
    return {
      role: 'customer',
      identity: `customer-${invite.sid}`,
      name: invite.name ?? 'Customer',
      sessionId,
    };
  } catch {
    reply.code(401).send({ error: 'invalid_token', message: 'Invalid or expired credentials.' });
    return null;
  }
}
