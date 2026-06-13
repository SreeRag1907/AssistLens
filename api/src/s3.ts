import {
  S3Client,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';

export const s3 = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
});

export const recordingsBucket = config.s3.bucket;
export const filesBucket = config.s3.filesBucket;

async function bucketExists(bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

/** Create recordings + files buckets if they don't exist yet. */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of [recordingsBucket, filesBucket]) {
    if (await bucketExists(bucket)) continue;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function uploadBuffer(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }),
  );
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function presignGet(bucket: string, key: string, expiry = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiry });
}

/** Stream an object body from S3 (for proxied downloads). */
export async function getObjectStream(bucket: string, key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res;
}
