import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export interface SavedAudioResult {
  audioUrl: string;
  filename: string;
  byteSize: number;
}

export interface AudioFileResult {
  buffer: Buffer;
  contentType: string;
  contentLength: number;
}

export interface AudioStorageDriver {
  save(filename: string, buffer: Buffer, mimeType: string): Promise<void>;
  get(filename: string): Promise<AudioFileResult | null>;
  delete(filename: string): Promise<void>;
  getLocalPath?(filename: string): string | null;
}

export class LocalStorageDriver implements AudioStorageDriver {
  private readonly uploadDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.resolve(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async save(filename: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.uploadDir, filename);
    await fs.promises.writeFile(filePath, buffer);
  }

  public async get(filename: string): Promise<AudioFileResult | null> {
    const filePath = this.getLocalPath(filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const buffer = await fs.promises.readFile(filePath);
    let contentType = 'audio/webm';
    if (filename.endsWith('.wav')) contentType = 'audio/wav';
    else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
    else if (filename.endsWith('.mp4')) contentType = 'audio/mp4';

    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  public async delete(filename: string): Promise<void> {
    const filePath = this.getLocalPath(filename);
    if (filePath && fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // Ignore cleanup error
      }
    }
  }

  public getLocalPath(filename: string): string | null {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }
    return path.join(this.uploadDir, filename);
  }
}

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  region?: string;
}

export class R2StorageDriver implements AudioStorageDriver {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(config?: R2Config, customS3Client?: S3Client) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = config?.bucketName || process.env.R2_BUCKET_NAME;
    const region = config?.region || process.env.R2_REGION || 'auto';
    const endpoint =
      config?.endpoint ||
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    if (!customS3Client) {
      const missing: string[] = [];
      if (!accountId && !config?.endpoint && !process.env.R2_ENDPOINT) {
        missing.push('R2_ACCOUNT_ID (or R2_ENDPOINT)');
      }
      if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
      if (!bucketName) missing.push('R2_BUCKET_NAME');

      if (missing.length > 0) {
        throw new Error(
          `Cloudflare R2 configuration error: Missing required variables [${missing.join(', ')}].`
        );
      }

      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    } else {
      this.s3Client = customS3Client;
    }

    if (!bucketName) {
      throw new Error('Cloudflare R2 configuration error: Missing R2_BUCKET_NAME.');
    }
    this.bucketName = bucketName;
  }

  public async save(filename: string, buffer: Buffer, mimeType: string): Promise<void> {
    const key = `audio/${filename}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
  }

  public async get(filename: string): Promise<AudioFileResult | null> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }
    const key = `audio/${filename}`;
    try {
      const res = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      if (!res.Body) {
        return null;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      let contentType = res.ContentType || 'audio/webm';
      if (!contentType || contentType === 'application/octet-stream') {
        if (filename.endsWith('.wav')) contentType = 'audio/wav';
        else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
        else if (filename.endsWith('.mp4')) contentType = 'audio/mp4';
        else contentType = 'audio/webm';
      }

      return {
        buffer,
        contentType,
        contentLength: res.ContentLength !== undefined ? res.ContentLength : buffer.length,
      };
    } catch (err: any) {
      if (
        err.name === 'NoSuchKey' ||
        err.name === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  public async delete(filename: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return;
    }
    const key = `audio/${filename}`;
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch {
      // Ignore cleanup error
    }
  }

  public getLocalPath(_filename: string): string | null {
    return null;
  }
}

export interface SupabaseStorageConfig {
  url?: string;
  serviceRoleKey?: string;
  bucketName?: string;
}

export class SupabaseStorageDriver implements AudioStorageDriver {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly bucketName: string;
  private readonly customFetch?: typeof fetch;

  constructor(config?: SupabaseStorageConfig, customFetch?: typeof fetch) {
    const rawUrl = config?.url || process.env.SUPABASE_URL;
    const serviceRoleKey = config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = config?.bucketName || process.env.SUPABASE_STORAGE_BUCKET || 'chandil-staging-audio';

    const missing: string[] = [];
    if (!rawUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!bucketName) missing.push('SUPABASE_STORAGE_BUCKET');

    if (missing.length > 0) {
      throw new Error(
        `Supabase Storage configuration error: Missing required variables [${missing.join(', ')}].`
      );
    }

    this.url = rawUrl!.replace(/\/+$/, '');
    this.serviceRoleKey = serviceRoleKey!;
    this.bucketName = bucketName!;
    this.customFetch = customFetch;
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!this.serviceRoleKey) return msg;
    const escaped = this.serviceRoleKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return msg.replace(new RegExp(escaped, 'g'), '[REDACTED]');
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.serviceRoleKey,
    };
    if (this.isLegacyJwt(this.serviceRoleKey)) {
      headers['Authorization'] = `Bearer ${this.serviceRoleKey}`;
    }
    return headers;
  }

  private isLegacyJwt(key: string): boolean {
    const parts = key.trim().split('.');
    return parts.length === 3 && parts[0].startsWith('eyJ');
  }

  public async save(filename: string, buffer: Buffer, mimeType: string): Promise<void> {
    const fetchFn = this.customFetch || fetch;
    const endpoint = `${this.url}/storage/v1/object/${this.bucketName}/audio/${filename}`;

    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const body = (await res.json()) as any;
        if (body?.message) errMsg = body.message;
        else if (body?.error) errMsg = body.error;
      } catch {
        // use statusText
      }
      const safeErrMsg = this.sanitizeErrorMessage(errMsg || res.statusText);
      throw new Error(`Supabase Storage upload failed (${res.status}): ${safeErrMsg}`);
    }
  }

  public async get(filename: string): Promise<AudioFileResult | null> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }

    const fetchFn = this.customFetch || fetch;
    const endpoint = `${this.url}/storage/v1/object/authenticated/${this.bucketName}/audio/${filename}`;

    const res = await fetchFn(endpoint, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
      },
    });

    if (res.status === 404) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // Not JSON or empty body - standard missing object
      }
      const msg = (body?.message || body?.error || '').toLowerCase();
      if (msg.includes('bucket not found') || (msg.includes('bucket') && msg.includes('not found'))) {
        const safeMsg = this.sanitizeErrorMessage(body?.message || res.statusText);
        throw new Error(`Supabase Storage configuration error (${res.status}): ${safeMsg}`);
      }
      return null;
    }

    if (res.status === 400) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // Not JSON
      }
      const msg = (body?.message || '').toLowerCase();
      const err = (body?.error || '').toLowerCase();

      // Return null ONLY when the response clearly identifies a missing object
      const isMissingObject =
        (msg.includes('object not found') || err === 'not_found' || msg.includes('not found')) &&
        !msg.includes('bucket') &&
        !err.includes('bucket');

      if (isMissingObject) {
        return null;
      }

      // Invalid bucket, malformed key, or configuration error must throw
      const errMsg = body?.message || body?.error || res.statusText;
      const safeMsg = this.sanitizeErrorMessage(errMsg);
      throw new Error(`Supabase Storage retrieval failed (${res.status}): ${safeMsg}`);
    }

    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const body = (await res.json()) as any;
        if (body?.message) errMsg = body.message;
        else if (body?.error) errMsg = body.error;
      } catch {
        // use statusText
      }
      const safeErrMsg = this.sanitizeErrorMessage(errMsg || res.statusText);
      throw new Error(`Supabase Storage retrieval failed (${res.status}): ${safeErrMsg}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let contentType = res.headers.get('content-type') || 'audio/webm';
    if (!contentType || contentType === 'application/octet-stream') {
      if (filename.endsWith('.wav')) contentType = 'audio/wav';
      else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
      else if (filename.endsWith('.mp4')) contentType = 'audio/mp4';
      else contentType = 'audio/webm';
    }

    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  public async delete(filename: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return;
    }

    try {
      const fetchFn = this.customFetch || fetch;
      const endpoint = `${this.url}/storage/v1/object/${this.bucketName}`;

      await fetchFn(endpoint, {
        method: 'DELETE',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefixes: [`audio/${filename}`],
        }),
      });
    } catch {
      // Ignore cleanup error
    }
  }

  public getLocalPath(_filename: string): string | null {
    return null;
  }
}

export class AudioService {
  private driver: AudioStorageDriver;

  constructor(customDriver?: AudioStorageDriver, customUploadDir?: string) {
    if (customDriver) {
      this.driver = customDriver;
    } else {
      const driverType = (process.env.AUDIO_STORAGE_DRIVER || 'local').toLowerCase().trim();
      if (driverType === 'supabase') {
        this.driver = new SupabaseStorageDriver();
      } else if (driverType === 'r2') {
        this.driver = new R2StorageDriver();
      } else {
        this.driver = new LocalStorageDriver(customUploadDir);
      }
    }
  }

  public getDriver(): AudioStorageDriver {
    return this.driver;
  }

  public setDriver(driver: AudioStorageDriver): void {
    this.driver = driver;
  }

  /**
   * Saves a base64 encoded audio recording to storage.
   * Accepts both data URIs (e.g. data:audio/webm;codecs=opus;base64,...) and raw base64.
   * Validates MIME types, encoding integrity, and limits size to 256 KB.
   */
  public async saveAudioBase64(base64Data: string, mimeType = 'audio/webm'): Promise<SavedAudioResult> {
    if (typeof base64Data !== 'string') {
      throw new Error('Audio payload must be a string.');
    }

    const trimmed = base64Data.trim();
    if (!trimmed) {
      throw new Error('Audio payload is empty.');
    }

    let rawBase64 = trimmed;
    let ext = 'webm';

    // Check if input is formatted as a Data URI
    if (trimmed.startsWith('data:')) {
      if (!/^data:audio\//i.test(trimmed)) {
        throw new Error('Unsupported media type: only audio data URIs are permitted.');
      }

      const commaIndex = trimmed.indexOf(',');
      if (commaIndex === -1) {
        throw new Error('Malformed audio data URI: missing comma separator.');
      }

      const metadata = trimmed.slice(0, commaIndex);
      if (!/;base64$/i.test(metadata)) {
        throw new Error('Malformed audio data URI: encoding must be base64.');
      }

      // Validates data:audio/<subtype>(;<param>=<value>)*;base64
      const metadataRegex = /^data:audio\/([a-zA-Z0-9_\-.+]+)(?:;[a-zA-Z0-9_\-.+]+=(?:"[^"]*"|[a-zA-Z0-9_\-.+]+))*;base64$/i;
      const match = metadata.match(metadataRegex);
      if (!match) {
        throw new Error('Malformed audio data URI format.');
      }

      const subType = match[1].toLowerCase();
      const allowedSubTypes = new Set(['webm', 'ogg', 'wav', 'x-wav', 'mp4']);
      if (!allowedSubTypes.has(subType)) {
        throw new Error(`Unsupported audio format: audio/${subType}. Supported formats are webm, ogg, wav, mp4.`);
      }

      if (subType === 'wav' || subType === 'x-wav') ext = 'wav';
      else if (subType === 'ogg') ext = 'ogg';
      else if (subType === 'mp4') ext = 'mp4';
      else ext = 'webm';

      rawBase64 = trimmed.slice(commaIndex + 1);
    } else {
      // Raw Base64 string validation
      if (/[;,:]/.test(trimmed)) {
        throw new Error('Malformed audio payload: unrecognized prefix or invalid characters.');
      }

      if (mimeType.includes('wav')) ext = 'wav';
      else if (mimeType.includes('ogg')) ext = 'ogg';
      else if (mimeType.includes('mp4')) ext = 'mp4';
      else ext = 'webm';
    }

    // Clean whitespace and validate Base64 payload integrity
    const cleanBase64 = rawBase64.replace(/\s+/g, '');
    if (cleanBase64.length === 0) {
      throw new Error('Audio payload is empty.');
    }

    if (cleanBase64.length % 4 === 1) {
      throw new Error('Invalid Base64 audio encoding: invalid length.');
    }

    let padded = cleanBase64;
    while (padded.length % 4 !== 0) {
      padded += '=';
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded)) {
      throw new Error('Invalid Base64 audio encoding: contains illegal characters or invalid padding.');
    }

    const buffer = Buffer.from(padded, 'base64');
    if (buffer.length === 0) {
      throw new Error('Audio payload is empty.');
    }

    if (buffer.length > 256 * 1024) {
      throw new Error('Audio file exceeds maximum allowed limit (250 KB).');
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    let savedMimeType = 'audio/webm';
    if (ext === 'wav') savedMimeType = 'audio/wav';
    else if (ext === 'ogg') savedMimeType = 'audio/ogg';
    else if (ext === 'mp4') savedMimeType = 'audio/mp4';

    await this.driver.save(filename, buffer, savedMimeType);

    return {
      audioUrl: `/api/audio/${filename}`,
      filename,
      byteSize: buffer.length,
    };
  }

  /**
   * Retrieves an audio file by filename from the active storage driver.
   * Prevents path traversal vulnerabilities.
   */
  public async getAudioFile(filename: string): Promise<AudioFileResult | null> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }
    return await this.driver.get(filename);
  }

  /**
   * Retrieves the absolute local path for a saved audio file if local storage is used.
   * Prevents path traversal vulnerabilities.
   */
  public getAudioFilePath(filename: string): string | null {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }
    if (this.driver.getLocalPath) {
      const localPath = this.driver.getLocalPath(filename);
      if (localPath && fs.existsSync(localPath)) {
        return localPath;
      }
    }
    return null;
  }

  /**
   * Deletes an audio file (e.g. on transaction rollback).
   */
  public async deleteAudioFile(filename: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return;
    }
    await this.driver.delete(filename);
  }
}

export const audioService = new AudioService();
