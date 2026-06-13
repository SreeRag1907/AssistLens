import {
  AccessToken,
  EgressClient,
  RoomServiceClient,
  WebhookReceiver,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'livekit-server-sdk';
import { config } from './config.js';
import { ensureBuckets } from './s3.js';
import type { Role } from './types.js';

const { apiKey, apiSecret, url } = config.livekit;

export const roomService = new RoomServiceClient(url, apiKey, apiSecret);
export const egressClient = new EgressClient(url, apiKey, apiSecret);
export const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

interface MintArgs {
  room: string;
  identity: string;
  name?: string;
  role: Role;
}

// Role enforcement at the media layer: the agent gets room-admin rights
// (can end the room, manage participants); the customer can only publish
// and subscribe. This is the same access-control story as the invite token.
export async function mintAccessToken({ room, identity, name, role }: MintArgs): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: '12h',
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: role === 'agent',
    roomCreate: false,
  });
  return at.toJwt();
}

export async function closeRoom(room: string): Promise<void> {
  try {
    await roomService.deleteRoom(room);
  } catch {
    // Room may already be gone — ending is idempotent from our side.
  }
}

function egressErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return 'Recording service is not available.';
}

export async function startRoomRecording(room: string): Promise<{ egressId: string; objectKey: string }> {
  await ensureBuckets();
  const objectKey = `${room}/${Date.now()}.mp4`;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: objectKey,
    output: {
      case: 's3',
      value: new S3Upload({
        accessKey: config.s3.accessKey,
        secret: config.s3.secretKey,
        region: config.s3.region,
        // Egress shares LiveKit's network; MinIO stays on the compose network as `minio`.
        endpoint: config.s3.egressEndpoint,
        bucket: config.s3.bucket,
        forcePathStyle: true,
      }),
    },
  });

  try {
    const info = await egressClient.startRoomCompositeEgress(room, { file: output });
    return { egressId: info.egressId, objectKey };
  } catch (err) {
    const detail = egressErrorMessage(err);
    const hint =
      /egress|no response|unavailable|not found/i.test(detail)
        ? ' Redeploy Railway egress (latest entrypoint) and confirm REDIS_URL on livekit-server + egress. Egress logs should show PulseAudio started and service ready.'
        : '';
    throw new Error(`${detail}${hint}`);
  }
}

export async function stopRecording(egressId: string): Promise<void> {
  await egressClient.stopEgress(egressId);
}

let recordingAvailableCache: { value: boolean; expires: number } | null = null;
const RECORDING_CACHE_MS = 10_000;

export interface RecordingStatus {
  available: boolean;
  detail?: string;
}

/** True when LiveKit Egress API is reachable. Cached 10s. */
export async function getRecordingStatus(): Promise<RecordingStatus> {
  const now = Date.now();
  if (recordingAvailableCache && now < recordingAvailableCache.expires) {
    return { available: recordingAvailableCache.value };
  }
  try {
    await egressClient.listEgress();
    recordingAvailableCache = { value: true, expires: now + RECORDING_CACHE_MS };
    return { available: true };
  } catch (err) {
    const detail = egressErrorMessage(err);
    const available = config.recordingEnabled;
    recordingAvailableCache = { value: available, expires: now + RECORDING_CACHE_MS };
    return {
      available,
      detail: available
        ? undefined
        : detail || 'Could not reach LiveKit Egress API. Deploy egress on Railway and set REDIS_URL on livekit-server.',
    };
  }
}

export async function isRecordingAvailable(): Promise<boolean> {
  return (await getRecordingStatus()).available;
}
