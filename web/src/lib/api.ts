import type {
  AgentTokenInfo,
  ChatFile,
  ChatMessage,
  EventRecord,
  JoinInfo,
  ParticipantRecord,
  RecordingRecord,
  SessionSummary,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

const TOKEN_KEY = 'assistlens.agent.token';
const ADMIN_TOKEN_KEY = 'assistlens.admin.token';

export function getAgentToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAgentToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAgentToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
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

export function adminLogin(email: string, password: string) {
  return request<{ token: string; admin: { id: string; email: string } }>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ── Agent: sessions ─────────────────────────────────────────────────────────
export function createSession(token: string, title?: string) {
  return request<{ session: SessionSummary; invite: { code: string; url: string } }>('/sessions', {
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
    messages?: ChatMessage[];
    files?: ChatFile[];
  }>(`/sessions/${id}`, { token });
}

export function getAgentToken_(token: string, id: string) {
  return request<AgentTokenInfo>(`/sessions/${id}/agent-token`, { token });
}

export function getInvite(token: string, id: string) {
  return request<{ code: string; url: string }>(`/sessions/${id}/invite`, { token });
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
export function stopRecording(token: string, id: string, recordingId?: string) {
  return request<{ ok: true; already_stopped?: boolean }>(`/sessions/${id}/recording/stop`, {
    method: 'POST',
    token,
    body: JSON.stringify(recordingId ? { recordingId } : {}),
  });
}
export function getRecordingUrl(token: string, id: string, rid: string) {
  return request<{ url: string }>(`/sessions/${id}/recording/${rid}/url`, { token });
}

async function saveBlobDownload(res: Response, fileName: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Download failed.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a recording as a file save (proxied through API — no blank tabs). */
export async function downloadRecording(token: string, sessionId: string, rid: string, fileName = 'recording.mp4') {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/recording/${rid}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await saveBlobDownload(res, fileName);
}

/** Download a shared chat file (proxied through API). */
export async function downloadFile(token: string, sessionId: string, fileId: string, fileName: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await saveBlobDownload(res, fileName);
}

export function getRecordingStatus(token: string) {
  return request<{ available: boolean; hint?: string }>('/recording/status', { token });
}

export function listRecordings(token: string, sessionId: string) {
  return request<{ recordings: RecordingRecord[] }>(`/sessions/${sessionId}/recordings`, { token });
}

// ── File sharing ─────────────────────────────────────────────────────────────
export async function uploadFile(authToken: string, sessionId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Upload failed.');
  return data as { file: ChatFile };
}

export function listFiles(authToken: string, sessionId: string) {
  return request<{ files: ChatFile[] }>(`/sessions/${sessionId}/files`, { token: authToken });
}

export function getFileUrl(authToken: string, sessionId: string, fileId: string) {
  return request<{ url: string; file: ChatFile }>(`/sessions/${sessionId}/files/${fileId}/url`, {
    token: authToken,
  });
}

// ── Admin dashboard ───────────────────────────────────────────────────────────
export function adminListSessions(token: string) {
  return request<{ sessions: SessionSummary[] }>('/admin/sessions', { token });
}

export function adminGetParticipants(token: string, id: string) {
  return request<{ participants: ParticipantRecord[] }>(`/admin/sessions/${id}/participants`, { token });
}

export function adminGetEvents(token: string, id: string) {
  return request<{ events: EventRecord[] }>(`/admin/sessions/${id}/events`, { token });
}

export function adminGetSessionDetail(token: string, id: string) {
  return request<{ participants: ParticipantRecord[]; events: EventRecord[] }>(
    `/admin/sessions/${id}/detail`,
    { token },
  );
}

export function adminEndSession(token: string, id: string) {
  return request<{ ok: boolean }>(`/admin/sessions/${id}/end`, { method: 'POST', token });
}

// ── Customer join ────────────────────────────────────────────────────────────
export function checkInviteByCode(code: string) {
  return request<{ valid: boolean; sessionTitle?: string; reason?: string; code?: string }>(
    `/invite/${encodeURIComponent(code)}`,
  );
}

export function checkInvite(inviteToken: string) {
  return request<{ valid: boolean; sessionTitle?: string; reason?: string }>(
    `/invite?token=${encodeURIComponent(inviteToken)}`,
  );
}

export function joinByCode(code: string, name?: string) {
  return request<JoinInfo>('/join', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  });
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
