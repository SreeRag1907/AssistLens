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

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Self-service signup for support agents (not admins).
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid registration details.';
      return reply.code(400).send({ error: 'bad_request', message: msg });
    }
    const { email, password } = parsed.data;

    const existing = await query<AgentRow>('SELECT * FROM agents WHERE email = $1', [email]);
    const taken = existing.rows[0];
    if (taken) {
      const message = taken.is_admin
        ? 'This email is reserved for admin access. Use a different work email or contact your administrator.'
        : 'An account with this email already exists. Sign in instead.';
      return reply.code(409).send({ error: 'email_in_use', message });
    }

    const hash = await bcrypt.hash(password, 10);
    const res = await query<Pick<AgentRow, 'id' | 'email'>>(
      `INSERT INTO agents (email, password_hash, is_admin)
       VALUES ($1, $2, false)
       RETURNING id, email`,
      [email, hash],
    );
    const user = res.rows[0]!;
    const token = signStaffToken({ sub: user.id, email: user.email, role: 'agent' });
    return reply.code(201).send({ token, agent: { id: user.id, email: user.email } });
  });

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
