import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { signStaffToken } from '../auth.js';
import type { AgentRow } from '../types.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Agent login — support agents only (not admins).
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Email and password are required.' });
    }
    const { email, password } = parsed.data;
    const res = await query<AgentRow>('SELECT * FROM agents WHERE email = $1', [email]);
    const user = res.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Incorrect email or password.' });
    }
    if (user.is_admin) {
      return reply.code(403).send({
        error: 'admin_account',
        message: 'This account is for admin access. Sign in at /admin/login instead.',
      });
    }
    const token = signStaffToken({ sub: user.id, email: user.email, role: 'agent' });
    return { token, agent: { id: user.id, email: user.email } };
  });

  // Admin login — operations dashboard only.
  app.post('/api/auth/admin/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Email and password are required.' });
    }
    const { email, password } = parsed.data;
    const res = await query<AgentRow>('SELECT * FROM agents WHERE email = $1 AND is_admin = true', [email]);
    const user = res.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Incorrect admin email or password.' });
    }
    const token = signStaffToken({ sub: user.id, email: user.email, role: 'admin' });
    return { token, admin: { id: user.id, email: user.email } };
  });
}
