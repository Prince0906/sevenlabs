import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    ...(env.AWS_SESSION_TOKEN && { sessionToken: env.AWS_SESSION_TOKEN }),
  },
});

/**
 * Upload audio buffer to S3.
 */
export async function uploadAudio(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "audio/wav"
) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

/**
 * Get a pre-signed URL for downloading audio (1 hour expiry).
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Pre-signed BYTE-RANGE GET for a per-finding clip of the single session
 * recording — the Range is baked into the SigV4 signature, so no ffmpeg / no
 * extra objects (SYSTEM_DESIGN §12). Time→byte is linear under CBR capture.
 */
export async function getSignedClipUrl(
  key: string,
  startByte: number,
  endByte: number,
  expiresIn: number = 3600
) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    Range: `bytes=${Math.max(0, Math.floor(startByte))}-${Math.max(0, Math.floor(endByte))}`,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}

/** Mock-session S3 key layout (transcript always; audio opt-in only). */
export function mockTranscriptKey(userId: string, sessionId: string): string {
  return `mock/${userId}/${sessionId}/transcript.json`;
}
export function mockAudioKey(userId: string, sessionId: string): string {
  return `mock/${userId}/${sessionId}/session.webm`;
}

/**
 * Delete an object from S3.
 */
export async function deleteObject(key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })
  );
}
