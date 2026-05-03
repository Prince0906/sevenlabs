import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload audio buffer to R2
 */
export async function uploadAudio(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "audio/wav"
) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

/**
 * Get a pre-signed URL for downloading audio (1 hour expiry)
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600) {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete an object from R2
 */
export async function deleteObject(key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    })
  );
}
