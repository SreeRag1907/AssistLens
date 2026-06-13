export type Role = 'agent' | 'customer';

export interface SessionSummary {
  id: string;
  agent_id: string;
  agent_email?: string;
  room_name: string;
  title: string | null;
  status: 'active' | 'ended';
  created_at: string;
  ended_at: string | null;
  ended_by: string | null;
  participant_count?: string | number;
  live_count?: string | number;
}

export interface ChatFile {
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

export interface ParticipantRecord {
  id: string;
  session_id: string;
  role: Role;
  identity: string;
  display_name: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface EventRecord {
  id: string;
  session_id: string;
  type: string;
  identity: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RecordingRecord {
  id: string;
  session_id: string;
  status: 'in_progress' | 'processing' | 'ready' | 'failed';
  object_key: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_identity: string;
  sender_role: Role;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export interface JoinInfo {
  url: string;
  token: string;
  identity: string;
  displayName: string;
  sessionId: string;
  roomName: string;
  recording: 'in_progress' | 'idle';
  duplicate: boolean;
}

export interface AgentTokenInfo {
  url: string;
  token: string;
  identity: string;
  roomName: string;
}

// Data-channel payloads exchanged peer-to-peer through the SFU.
export type DataPayload =
  | { type: 'chat'; id: string; body: string; name: string; role: Role; ts: string }
  | { type: 'recording'; status: 'in_progress' | 'idle' };
