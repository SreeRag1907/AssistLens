import type {
  AgentTokenInfo,
  ChatMessage,
  EventRecord,
  JoinInfo,
  ParticipantRecord,
  RecordingRecord,
  SessionSummary,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

const TOKEN_KEY = 'assistlens.agent.token';

export function getAgentToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAgentToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAgentToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Request failed.');
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export function login(email: string, password: string) {
  return request<{ token: string; agent: { id: string; email: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ── Agent: sessions ─────────────────────────────────────────────────────────
export function createSession(token: string, title?: string) {
  return request<{ session: SessionSummary; invite: { token: string; url: string } }>('/sessions', {
    method: 'POST',
    token,
    body: JSON.stringify({ title }),
  });
}

export function listSessions(token: string) {
  return request<{ sessions: SessionSummary[] }>('/sessions', { token });
}

export function getSession(token: string, id: string) {
  return request<{
    session: SessionSummary;
    participants: ParticipantRecord[];
    events: EventRecord[];
    recordings: RecordingRecord[];
  }>(`/sessions/${id}`, { token });
}

export function getAgentToken_(token: string, id: string) {
  return request<AgentTokenInfo>(`/sessions/${id}/agent-token`, { token });
}

export function endSession(token: string, id: string) {
  return request<{ ok: true }>(`/sessions/${id}/end`, { method: 'POST', token });
}

export function startRecording(token: string, id: string) {
  return request<{ recording: RecordingRecord }>(`/sessions/${id}/recording/start`, {
    method: 'POST',
    token,
  });
}
export function stopRecording(token: string, id: string) {
  return request<{ ok: true }>(`/sessions/${id}/recording/stop`, { method: 'POST', token });
}
export function getRecordingUrl(token: string, id: string, rid: string) {
  return request<{ url: string }>(`/sessions/${id}/recording/${rid}/url`, { token });
}

// ── Customer join ────────────────────────────────────────────────────────────
export function checkInvite(inviteToken: string) {
  return request<{ valid: boolean; sessionTitle?: string; reason?: string }>(
    `/invite?token=${encodeURIComponent(inviteToken)}`,
  );
}
export function join(inviteToken: string, name?: string) {
  return request<JoinInfo>('/join', {
    method: 'POST',
    body: JSON.stringify({ token: inviteToken, name }),
  });
}

// ── Chat persistence (works for agent token or invite token) ─────────────────
export function postMessage(authToken: string, sessionId: string, body: string) {
  return request<{ message: ChatMessage }>(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({ body }),
  });
}
export function getMessages(authToken: string, sessionId: string) {
  return request<{ messages: ChatMessage[] }>(`/sessions/${sessionId}/messages`, { token: authToken });
}
