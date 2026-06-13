import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { signAgentToken } from '../auth.js';
import type { AgentRow } from '../types.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Email and password are required.' });
    }
    const { email, password } = parsed.data;
    const res = await query<AgentRow>('SELECT * FROM agents WHERE email = $1', [email]);
    const agent = res.rows[0];
    if (!agent || !(await bcrypt.compare(password, agent.password_hash))) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Incorrect email or password.' });
    }
    const token = signAgentToken({ sub: agent.id, email: agent.email, role: 'agent' });
    return { token, agent: { id: agent.id, email: agent.email } };
  });
}
