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
