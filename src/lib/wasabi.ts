import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const wasabiClient = new S3Client({
  region: process.env.WASABI_REGION!,
  endpoint: process.env.WASABI_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.WASABI_BUCKET_NAME!;

export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType: string) {
  await wasabiClient.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    wasabiClient,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

export async function deleteFile(key: string) {
  await wasabiClient.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function listFiles(prefix?: string) {
  const response = await wasabiClient.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return response.Contents ?? [];
}
