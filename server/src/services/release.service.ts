import crypto from 'node:crypto';
import { db } from '../db';
import { AppRelease, ReleaseUploadResponse } from '@shared';
import { storageService, StorageSaveResult } from './storage.service';
import { apkService, ApkValidationError, ExtractedApkMetadata } from './apk.service';

export class ReleaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'RELEASE_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ReleaseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function mapRowToAppRelease(row: any): AppRelease {
  return {
    id: row.id,
    releaseNumber: row.release_number,
    versionDisplay: row.version_display,
    versionName: row.version_name,
    androidVersionCode: row.android_version_code,
    packageId: row.package_id,
    minSdk: row.min_sdk,
    targetSdk: row.target_sdk,
    fileSize: Number(row.file_size),
    sha256: row.sha256,
    changelog: row.changelog,
    releaseStatus: row.release_status,
    isLatest: row.is_latest,
    downloadCount: row.download_count,
    apkStorageKey: row.apk_storage_key,
    createdBy: row.created_by,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at).toISOString() : null,
    withdrawalReason: row.withdrawal_reason || null,
  };
}

export class ReleaseService {
  /**
   * Retrieves the currently active published release marked as latest.
   */
  public async getLatestRelease(): Promise<AppRelease | null> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `SELECT * FROM app_releases 
       WHERE release_status = 'published' AND is_latest = true 
       LIMIT 1`
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRowToAppRelease(rows[0]);
  }

  /**
   * Lists releases for public view (only published or withdrawn, never drafts).
   */
  public async listPublicReleases(): Promise<AppRelease[]> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `SELECT * FROM app_releases 
       WHERE release_status IN ('published', 'withdrawn') 
       ORDER BY release_number DESC`
    );

    return rows.map(mapRowToAppRelease);
  }

  /**
   * Lists all releases for administrative view (including drafts).
   */
  public async listAdminReleases(): Promise<AppRelease[]> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `SELECT * FROM app_releases 
       ORDER BY release_number DESC`
    );

    return rows.map(mapRowToAppRelease);
  }

  /**
   * Retrieves single release by ID.
   */
  public async getReleaseById(id: string): Promise<AppRelease | null> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `SELECT * FROM app_releases WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRowToAppRelease(rows[0]);
  }

  /**
   * Uploads an APK file as a draft release:
   * 1. Allocates next release_number inside a database transaction lock.
   * 2. Saves APK to storage and calculates SHA-256 and size.
   * 3. Parses binary AndroidManifest.xml and verifies package ID.
   * 4. Persists draft release with extracted metadata.
   */
  public async uploadDraftRelease(options: {
    fileStream?: NodeJS.ReadableStream;
    fileBuffer?: Buffer;
    originalFilename?: string;
    changelog: string;
    adminId?: string;
  }): Promise<ReleaseUploadResponse> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const cleanChangelog = (options.changelog || '').trim();
    if (!cleanChangelog) {
      throw new ReleaseError('Changelog description is required.', 'MISSING_CHANGELOG', 400);
    }

    const client = await pool.connect();
    let savedStorage: StorageSaveResult | null = null;

    try {
      await client.query('BEGIN');

      // Concurrency-safe version allocation using table lock
      await client.query('LOCK TABLE app_releases IN EXCLUSIVE MODE');
      const { rows: lockRows } = await client.query<{ next_num: number }>(
        `SELECT COALESCE(MAX(release_number), 0) + 1 AS next_num 
         FROM app_releases`
      );
      const nextReleaseNumber = Number(lockRows[0].next_num);
      const versionDisplay = `v${nextReleaseNumber}`;

      // Save APK file to storage
      if (options.fileBuffer) {
        savedStorage = await storageService.saveApkBuffer(
          options.fileBuffer,
          options.originalFilename || `${versionDisplay}.apk`
        );
      } else if (options.fileStream) {
        savedStorage = await storageService.saveApkStream(
          options.fileStream,
          options.originalFilename || `${versionDisplay}.apk`
        );
      } else {
        throw new ReleaseError('No APK file payload provided.', 'MISSING_FILE', 400);
      }

      // Parse and validate binary AndroidManifest.xml
      let extractedMetadata: ExtractedApkMetadata;
      try {
        extractedMetadata = await apkService.parseAndValidateApk(savedStorage.absolutePath);
      } catch (err: any) {
        // Clean up stored file on validation failure
        if (savedStorage) {
          await storageService.deleteFile(savedStorage.storageKey);
        }
        throw err;
      }

      // Insert new release row in draft status
      const insertSql = `
        INSERT INTO app_releases (
          release_number,
          version_display,
          version_name,
          android_version_code,
          package_id,
          min_sdk,
          target_sdk,
          apk_storage_key,
          file_size,
          sha256,
          changelog,
          release_status,
          is_latest,
          created_by,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', false, $12, NOW()
        ) RETURNING *;
      `;

      const { rows: releaseRows } = await client.query(insertSql, [
        nextReleaseNumber,
        versionDisplay,
        extractedMetadata.versionName,
        extractedMetadata.versionCode,
        extractedMetadata.packageId,
        extractedMetadata.minSdkVersion,
        extractedMetadata.targetSdkVersion,
        savedStorage.storageKey,
        savedStorage.fileSize,
        savedStorage.sha256,
        cleanChangelog,
        options.adminId || null,
      ]);

      const createdRelease = mapRowToAppRelease(releaseRows[0]);

      // Record audit log
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
         VALUES ($1, 'RELEASE_UPLOAD_DRAFT', 'release', $2, $3)`,
        [
          options.adminId || null,
          createdRelease.id,
          JSON.stringify({
            releaseNumber: createdRelease.releaseNumber,
            versionDisplay: createdRelease.versionDisplay,
            versionName: createdRelease.versionName,
            androidVersionCode: createdRelease.androidVersionCode,
            sha256: createdRelease.sha256,
            fileSize: createdRelease.fileSize,
          }),
        ]
      );

      await client.query('COMMIT');

      return {
        release: createdRelease,
        extractedMetadata: {
          packageId: extractedMetadata.packageId,
          versionCode: extractedMetadata.versionCode,
          versionName: extractedMetadata.versionName,
          minSdkVersion: extractedMetadata.minSdkVersion,
          targetSdkVersion: extractedMetadata.targetSdkVersion,
          sha256: savedStorage.sha256,
          fileSize: savedStorage.fileSize,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (savedStorage) {
        await storageService.deleteFile(savedStorage.storageKey);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Publishes a draft release, making it the latest active release.
   */
  public async publishRelease(
    id: string,
    adminId?: string,
    updatedChangelog?: string
  ): Promise<AppRelease> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: existingRows } = await client.query(
        `SELECT * FROM app_releases WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingRows.length === 0) {
        throw new ReleaseError('Release not found.', 'RELEASE_NOT_FOUND', 404);
      }

      const existing = existingRows[0];
      if (existing.release_status === 'published') {
        throw new ReleaseError('Release is already published.', 'ALREADY_PUBLISHED', 400);
      }

      // Demote current latest release
      await client.query(
        `UPDATE app_releases 
         SET is_latest = false 
         WHERE is_latest = true`
      );

      // Promote this release
      const changelogToSet = (updatedChangelog && updatedChangelog.trim()) || existing.changelog;

      const { rows: updatedRows } = await client.query(
        `UPDATE app_releases 
         SET release_status = 'published',
             is_latest = true,
             published_at = NOW(),
             changelog = $2
         WHERE id = $1
         RETURNING *`,
        [id, changelogToSet]
      );

      const published = mapRowToAppRelease(updatedRows[0]);

      // Audit log
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
         VALUES ($1, 'RELEASE_PUBLISHED', 'release', $2, $3)`,
        [
          adminId || null,
          id,
          JSON.stringify({
            versionDisplay: published.versionDisplay,
            versionName: published.versionName,
            androidVersionCode: published.androidVersionCode,
          }),
        ]
      );

      await client.query('COMMIT');
      return published;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Withdraws a release with mandatory reason.
   * If it was marked as latest, elects the next highest published release as latest.
   */
  public async withdrawRelease(
    id: string,
    reason: string,
    adminId?: string
  ): Promise<AppRelease> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new ReleaseError('Withdrawal reason is required.', 'MISSING_REASON', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: existingRows } = await client.query(
        `SELECT * FROM app_releases WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingRows.length === 0) {
        throw new ReleaseError('Release not found.', 'RELEASE_NOT_FOUND', 404);
      }

      const existing = existingRows[0];
      const wasLatest = existing.is_latest;

      const { rows: updatedRows } = await client.query(
        `UPDATE app_releases 
         SET release_status = 'withdrawn',
             is_latest = false,
             withdrawn_at = NOW(),
             withdrawal_reason = $2
         WHERE id = $1
         RETURNING *`,
        [id, cleanReason]
      );

      // If it was latest, promote the newest remaining published release
      if (wasLatest) {
        await client.query(
          `UPDATE app_releases 
           SET is_latest = true 
           WHERE id = (
             SELECT id FROM app_releases 
             WHERE release_status = 'published' AND id != $1 
             ORDER BY release_number DESC 
             LIMIT 1
           )`,
          [id]
        );
      }

      const withdrawn = mapRowToAppRelease(updatedRows[0]);

      // Audit log
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
         VALUES ($1, 'RELEASE_WITHDRAWN', 'release', $2, $3)`,
        [
          adminId || null,
          id,
          JSON.stringify({
            versionDisplay: withdrawn.versionDisplay,
            withdrawalReason: cleanReason,
          }),
        ]
      );

      await client.query('COMMIT');
      return withdrawn;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Tracks a download event without exposing private tester information.
   */
  public async trackDownload(releaseId: string, ip: string, userAgent?: string): Promise<void> {
    const pool = db.getPool();
    if (!pool) return;

    try {
      const ipHash = crypto
        .createHash('sha256')
        .update(ip + '-chandil-salt-key')
        .digest('hex');

      await pool.query(
        `INSERT INTO release_downloads (release_id, ip_hash, user_agent, downloaded_at)
         VALUES ($1, $2, $3, NOW())`,
        [releaseId, ipHash, userAgent ? userAgent.slice(0, 500) : null]
      );

      await pool.query(
        `UPDATE app_releases 
         SET download_count = download_count + 1 
         WHERE id = $1`,
        [releaseId]
      );
    } catch {
      // Do not block download if telemetry write fails
    }
  }
}

export const releaseService = new ReleaseService();
