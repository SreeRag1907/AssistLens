export type Role = 'agent' | 'customer';

export type RecordingStatus = 'in_progress' | 'processing' | 'ready' | 'failed';
export type SessionStatus = 'active' | 'ended';

export interface AgentRow {
  id: string;
  email: string;
  password_hash: string;
}

export interface SessionRow {
  id: string;
  agent_id: string;
  room_name: string;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  ended_at: string | null;
  ended_by: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  role: Role;
  identity: string;
  display_name: string | null;
  joined_at: string;
  left_at: string | null;
  grace_until: string | null;
}

export interface EventRow {
  id: string;
  session_id: string;
  type: string;
  identity: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  sender_identity: string;
  sender_role: Role;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export interface RecordingRow {
  id: string;
  session_id: string;
  egress_id: string | null;
  status: RecordingStatus;
  object_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatFileRow {
  id: string;
  session_id: string;
  sender_identity: string;
  sender_name: string | null;
  file_name: string;
  file_size: number;
  content_type: string;
  object_key: string;
  created_at: string;
}

// JWT payload for an authenticated agent.
export interface AgentClaims {
  sub: string;
  email: string;
  role: 'agent';
}

// Signed invite token payload — the access-control primitive for customers.
export interface InviteClaims {
  sid: string; // session id
  room: string; // livekit room name
  role: 'customer';
  name?: string;
}
