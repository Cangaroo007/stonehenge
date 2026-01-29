/**
 * Cloudflare R2 Storage Module
 *
 * This module handles file uploads and downloads to/from Cloudflare R2.
 * Uses AWS S3 SDK with R2 endpoint configuration.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Build R2 endpoint from either R2_ENDPOINT or R2_ACCOUNT_ID
function getR2Endpoint(): string | null {
  if (process.env.R2_ENDPOINT) {
    return process.env.R2_ENDPOINT;
  }
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  return null;
}

// Initialize S3 client for R2 (only if credentials are configured)
function getR2Client(): S3Client | null {
  const endpoint = getR2Endpoint();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn('[R2] Missing R2 credentials. Set R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY. Storage operations will be mocked.');
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'stonehenge-drawings';

// In-memory storage for development/testing when R2 is not configured
const memoryStorage = new Map<string, { data: Buffer; contentType: string }>();

/**
 * Upload a file to R2 storage
 * @param key - The R2 object key (path in bucket)
 * @param data - The file data as Buffer
 * @param contentType - MIME type of the file
 */
export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const client = getR2Client();

  if (!client) {
    // Mock upload for development
    console.log(`[R2] Mock upload: ${key} (${data.length} bytes)`);
    memoryStorage.set(key, { data, contentType });
    return;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
  console.log(`[R2] Uploaded: ${key}`);
}

/**
 * Get a file from R2 storage
 * @param key - The R2 object key
 * @returns The file data as Buffer, or null if not found
 */
export async function getFromR2(key: string): Promise<Buffer | null> {
  const client = getR2Client();

  if (!client) {
    // Mock retrieval for development
    const stored = memoryStorage.get(key);
    if (stored) {
      console.log(`[R2] Mock retrieval: ${key}`);
      return stored.data;
    }
    return null;
  }

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (response.Body) {
      const chunks: Uint8Array[] = [];
      // @ts-expect-error - Body is a readable stream in Node.js
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    return null;
  } catch (error) {
    console.error(`[R2] Error getting ${key}:`, error);
    return null;
  }
}

/**
 * Delete a file from R2 storage
 * @param storageKey - The R2 object key (path in bucket)
 */
export async function deleteFromR2(storageKey: string): Promise<void> {
  const client = getR2Client();

  if (!client) {
    // Mock deletion for development
    console.log(`[R2] Mock delete: ${storageKey}`);
    memoryStorage.delete(storageKey);
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
    })
  );
  console.log(`[R2] Deleted: ${storageKey}`);
}

/**
 * Generate a presigned URL for uploading to R2
 * @param key - The R2 object key
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();

  if (!client) {
    // Return a mock URL for development
    console.log(`[R2] Mock upload URL for: ${key}`);
    return `/api/mock-upload?key=${encodeURIComponent(key)}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading from R2
 * @param key - The R2 object key
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();

  if (!client) {
    // Return a mock URL for development (via our API)
    console.log(`[R2] Mock download URL for: ${key}`);
    return `/api/drawings/file?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Get the content type stored with a file
 * @param key - The R2 object key
 * @returns The content type, or null if not found
 */
export function getStoredContentType(key: string): string | null {
  const stored = memoryStorage.get(key);
  return stored?.contentType || null;
}
