import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Env } from '../config/env';

export interface StoredObjectInfo {
  size: number;
  contentType?: string;
}

/** Object storage for product media. Garage (S3) in dev/prod, in memory in tests. */
export abstract class ObjectStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  /** Null when the object does not exist. */
  abstract head(key: string): Promise<StoredObjectInfo | null>;
}

export class S3ObjectStorage extends ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    super();
    this.bucket = env.S3_BUCKET_PRODUCTS;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async head(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (err) {
      if (err instanceof NotFound) return null;
      throw err;
    }
  }
}

/** Test double (NODE_ENV=test): keeps objects in `objects`. */
export class MemoryObjectStorage extends ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
  }

  async delete(key: string) {
    this.objects.delete(key);
  }

  async head(key: string) {
    const obj = this.objects.get(key);
    return obj ? { size: obj.body.length, contentType: obj.contentType } : null;
  }
}
