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

export async function startRoomRecording(room: string): Promise<{ egressId: string; objectKey: string }> {
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
        endpoint: config.s3.endpoint,
        bucket: config.s3.bucket,
        forcePathStyle: true,
      }),
    },
  });

  const info = await egressClient.startRoomCompositeEgress(room, { file: output });
  return { egressId: info.egressId, objectKey };
}

export async function stopRecording(egressId: string): Promise<void> {
  await egressClient.stopEgress(egressId);
}

/** True when LiveKit Egress is reachable (recording stack running). */
export async function isRecordingAvailable(): Promise<boolean> {
  try {
    await egressClient.listEgress();
    return true;
  } catch {
    return false;
  }
}
