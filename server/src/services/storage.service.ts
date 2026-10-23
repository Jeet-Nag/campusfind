import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export interface StorageSaveResult {
  storageKey: string;
  absolutePath: string;
  fileSize: number;
  sha256: string;
}

export class StorageService {
  private readonly baseUploadDir: string;
  private readonly releasesDir: string;
  private readonly feedbackDir: string;

  constructor(customBaseDir?: string) {
    this.baseUploadDir = customBaseDir || path.resolve(process.cwd(), 'uploads');
    this.releasesDir = path.join(this.baseUploadDir, 'releases');
    this.feedbackDir = path.join(this.baseUploadDir, 'feedback');

    // Ensure upload directories exist
    if (!fs.existsSync(this.releasesDir)) {
      fs.mkdirSync(this.releasesDir, { recursive: true });
    }
    if (!fs.existsSync(this.feedbackDir)) {
      fs.mkdirSync(this.feedbackDir, { recursive: true });
    }
  }

  /**
   * Saves an APK file from a Readable stream to disk, computing SHA-256 and byte size in a single pass.
   */
  public async saveApkStream(
    fileStream: NodeJS.ReadableStream,
    originalFilename = 'release.apk'
  ): Promise<StorageSaveResult> {
    const fileId = crypto.randomUUID();
    const storageKey = `releases/${fileId}.apk`;
    const targetPath = path.join(this.baseUploadDir, storageKey);

    const hash = crypto.createHash('sha256');
    let fileSize = 0;

    const countingStream = new Readable({
      read() {},
    });

    const fileWriteStream = fs.createWriteStream(targetPath);

    await new Promise<void>((resolve, reject) => {
      fileStream.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        hash.update(chunk);
        fileWriteStream.write(chunk);
      });

      fileStream.on('end', () => {
        fileWriteStream.end(() => resolve());
      });

      fileStream.on('error', (err) => {
        fileWriteStream.destroy();
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        reject(err);
      });
    });

    const sha256 = hash.digest('hex');

    return {
      storageKey,
      absolutePath: targetPath,
      fileSize,
      sha256,
    };
  }

  /**
   * Saves an APK buffer directly (used in tests or direct uploads).
   */
  public async saveApkBuffer(
    buffer: Buffer,
    originalFilename = 'release.apk'
  ): Promise<StorageSaveResult> {
    const fileId = crypto.randomUUID();
    const storageKey = `releases/${fileId}.apk`;
    const targetPath = path.join(this.baseUploadDir, storageKey);

    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    const sha256 = hash.digest('hex');

    await fs.promises.writeFile(targetPath, buffer);

    return {
      storageKey,
      absolutePath: targetPath,
      fileSize: buffer.length,
      sha256,
    };
  }

  /**
   * Saves a base64 or binary screenshot for feedback bug reports.
   * Restricts to JPEG, PNG, or WebP; maximum 5MB.
   */
  public async saveFeedbackScreenshot(
    data: Buffer | string,
    mimeType: string
  ): Promise<{ storageKey: string; screenshotUrl: string }> {
    let buffer: Buffer;
    if (typeof data === 'string') {
      const cleanBase64 = data.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      buffer = data;
    }

    if (buffer.length === 0) {
      throw new Error('Screenshot file is empty.');
    }

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Screenshot file exceeds maximum allowed limit (5 MB).');
    }

    let ext = 'png';
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) ext = 'jpg';
    else if (lowerMime.includes('webp')) ext = 'webp';
    else if (lowerMime.includes('png')) ext = 'png';
    else {
      throw new Error('Invalid image format. Allowed formats: PNG, JPG, WebP.');
    }

    const fileId = crypto.randomUUID();
    const storageKey = `feedback/${fileId}.${ext}`;
    const targetPath = path.join(this.baseUploadDir, storageKey);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      storageKey,
      screenshotUrl: `/api/beta/attachments/${fileId}.${ext}`,
    };
  }

  /**
   * Resolves absolute path for a storage key, preventing path traversal.
   */
  public resolveAbsolutePath(storageKey: string): string | null {
    // Normalize and prevent path traversal
    const normalized = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.resolve(this.baseUploadDir, normalized);

    // Verify it stays strictly within baseUploadDir
    if (!fullPath.startsWith(path.resolve(this.baseUploadDir))) {
      return null;
    }

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    return fullPath;
  }

  /**
   * Deletes a stored file safely.
   */
  public async deleteFile(storageKey: string): Promise<void> {
    try {
      const fullPath = this.resolveAbsolutePath(storageKey);
      if (fullPath && fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

export const storageService = new StorageService();
