import type { FastifyReply, FastifyRequest } from 'fastify';
import { bearer, verifyAgentToken, verifyInviteToken } from './auth.js';
import { query } from './db.js';
import type { AgentClaims, Role } from './types.js';

export interface AgentContext {
  agentId: string;
  email: string;
  identity: string;
}

export interface ParticipantContext {
  role: Role;
  identity: string;
  name: string;
  sessionId: string;
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
  try {
    const claims = verifyAgentToken(token) as AgentClaims;
    return { agentId: claims.sub, email: claims.email, identity: `agent-${claims.sub}` };
  } catch {
    reply.code(401).send({ error: 'invalid_token', message: 'Your session has expired. Please log in again.' });
    return null;
  }
}

// Resolves either an agent (via JWT) or a customer (via invite token) and
// confirms they are authorized for the given session. Used for chat where
// both roles participate.
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

  // Try agent first.
  try {
    const claims = verifyAgentToken(token) as AgentClaims;
    const owns = await query(
      'SELECT 1 FROM sessions WHERE id = $1 AND agent_id = $2',
      [sessionId, claims.sub],
    );
    if (owns.rowCount === 0) {
      reply.code(403).send({ error: 'forbidden', message: 'You do not have access to this session.' });
      return null;
    }
    return { role: 'agent', identity: `agent-${claims.sub}`, name: claims.email, sessionId };
  } catch {
    // fall through to invite token
  }

  // Try customer invite token.
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
