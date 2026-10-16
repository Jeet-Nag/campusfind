import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SavedAudioResult {
  audioUrl: string;
  filename: string;
  byteSize: number;
}

export class AudioService {
  private readonly uploadDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.resolve(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
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
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    return {
      audioUrl: `/api/audio/${filename}`,
      filename,
      byteSize: buffer.length,
    };
  }

  /**
   * Retrieves the absolute local path for a saved audio file.
   * Prevents path traversal vulnerabilities.
   */
  public getAudioFilePath(filename: string): string | null {
    // Sanitize filename: only allow UUID + safe extensions
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }

    const filePath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return filePath;
  }

  /**
   * Deletes a local audio file (e.g. on transaction rollback).
   */
  public async deleteAudioFile(filename: string): Promise<void> {
    try {
      const filePath = this.getAudioFilePath(filename);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

export const audioService = new AudioService();
