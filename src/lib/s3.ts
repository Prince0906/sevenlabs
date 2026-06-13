import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

// S3 stores recorded answers for the PARKED Speaking Coach ONLY — the live
// interview panel never writes to S3 (it derives delivery metrics in-memory).
// So AWS config is OPTIONAL: the client is built lazily, and only a coach path
// that actually calls these helpers requires AWS_*/S3_BUCKET_NAME to be set.
let _client: S3Client | null = null;

function s3(): { client: S3Client; bucket: string } {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME } = env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET_NAME) {
    throw new Error(
      "S3 is not configured — set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and " +
        "S3_BUCKET_NAME. (Only the parked Speaking Coach uses S3; the interview " +
        "panel does not, so this is unset by default.)"
    );
  }
  _client ??= new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      ...(env.AWS_SESSION_TOKEN && { sessionToken: env.AWS_SESSION_TOKEN }),
    },
  });
  return { client: _client, bucket: S3_BUCKET_NAME };
}

/**
 * Upload audio buffer to S3 (Speaking Coach only).
 */
export async function uploadAudio(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "audio/wav"
) {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

/**
 * Get a pre-signed URL for downloading audio (1 hour expiry; Speaking Coach only).
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600) {
  const { client, bucket } = s3();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return awsGetSignedUrl(client, command, { expiresIn });
}

/**
 * Delete an object from S3 (Speaking Coach only).
 */
export async function deleteObject(key: string) {
  const { client, bucket } = s3();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
