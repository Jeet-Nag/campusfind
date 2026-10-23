import { db } from '../db';
import {
  BetaFeedback,
  BetaFeedbackCategory,
  BetaFeedbackStatus,
  BetaTesterRole,
  BetaFeedbackComment,
} from '@shared';
import { storageService } from './storage.service';

export class FeedbackError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'FEEDBACK_ERROR', statusCode = 400) {
    super(message);
    this.name = 'FeedbackError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function mapRowToFeedback(row: any): BetaFeedback {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    appVersion: row.app_version,
    testerRole: row.tester_role,
    deviceModel: row.device_model || null,
    androidVersion: row.android_version || null,
    authorName: row.author_name,
    screenshotUrl: row.screenshot_url || null,
    status: row.status,
    isPinned: row.is_pinned,
    isReported: row.is_reported,
    reportCount: row.report_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function mapRowToComment(row: any): BetaFeedbackComment {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    parentCommentId: row.parent_comment_id || null,
    authorName: row.author_name,
    isAdmin: row.is_admin,
    message: row.message,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

export interface CreateFeedbackInput {
  title: string;
  description: string;
  category: BetaFeedbackCategory;
  appVersion: string;
  testerRole: BetaTesterRole;
  deviceModel?: string;
  androidVersion?: string;
  authorName: string;
  authorContact?: string;
  screenshotBase64?: string;
  screenshotMime?: string;
}

export interface ListFeedbackFilter {
  category?: string;
  status?: string;
  appVersion?: string;
  testerRole?: string;
  search?: string;
  sort?: 'newest' | 'most_discussed';
  limit?: number;
  offset?: number;
}

export class FeedbackService {
  /**
   * Submits a new feedback item from a beta tester.
   */
  public async createFeedback(input: CreateFeedbackInput): Promise<BetaFeedback> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const cleanTitle = (input.title || '').trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 200) {
      throw new FeedbackError('Title must be between 3 and 200 characters.', 'INVALID_TITLE', 400);
    }

    const cleanDesc = (input.description || '').trim();
    if (cleanDesc.length < 5 || cleanDesc.length > 5000) {
      throw new FeedbackError('Description must be between 5 and 5000 characters.', 'INVALID_DESCRIPTION', 400);
    }

    const cleanAuthor = (input.authorName || '').trim();
    if (cleanAuthor.length < 1 || cleanAuthor.length > 100) {
      throw new FeedbackError('Author name must be between 1 and 100 characters.', 'INVALID_AUTHOR', 400);
    }

    let screenshotKey: string | null = null;
    let screenshotUrl: string | null = null;

    if (input.screenshotBase64 && input.screenshotMime) {
      const saved = await storageService.saveFeedbackScreenshot(
        input.screenshotBase64,
        input.screenshotMime
      );
      screenshotKey = saved.storageKey;
      screenshotUrl = saved.screenshotUrl;
    }

    const insertSql = `
      INSERT INTO beta_feedback (
        title,
        description,
        category,
        app_version,
        tester_role,
        device_model,
        android_version,
        author_name,
        author_contact,
        screenshot_storage_key,
        screenshot_url,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'NEW', NOW(), NOW()
      ) RETURNING *;
    `;

    const { rows } = await pool.query(insertSql, [
      cleanTitle,
      cleanDesc,
      input.category,
      input.appVersion || 'Unknown',
      input.testerRole,
      input.deviceModel ? input.deviceModel.slice(0, 128) : null,
      input.androidVersion ? input.androidVersion.slice(0, 64) : null,
      cleanAuthor,
      input.authorContact ? input.authorContact.slice(0, 100) : null,
      screenshotKey,
      screenshotUrl,
    ]);

    return mapRowToFeedback(rows[0]);
  }

  /**
   * Lists feedback with filtering, searching, and server-side pagination.
   */
  public async listFeedback(
    filter: ListFeedbackFilter = {}
  ): Promise<{ items: BetaFeedback[]; total: number; limit: number; offset: number }> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const offset = Math.max(Number(filter.offset) || 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.category) {
      conditions.push(`category = $${pIdx++}`);
      params.push(filter.category);
    }

    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }

    if (filter.appVersion) {
      conditions.push(`app_version = $${pIdx++}`);
      params.push(filter.appVersion);
    }

    if (filter.testerRole) {
      conditions.push(`tester_role = $${pIdx++}`);
      params.push(filter.testerRole);
    }

    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(title) LIKE $${pIdx} OR LOWER(description) LIKE $${pIdx} OR LOWER(author_name) LIKE $${pIdx})`);
      params.push(term);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM beta_feedback ${whereClause};`;
    const { rows: countRows } = await pool.query<{ count: string }>(countQuery, params);
    const total = Number(countRows[0].count);

    // Order by
    let orderBy = 'is_pinned DESC, created_at DESC';
    if (filter.sort === 'most_discussed') {
      orderBy = 'is_pinned DESC, comments_count DESC, created_at DESC';
    }

    const selectQuery = `
      SELECT * FROM beta_feedback
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(selectQuery, params);
    const items = rows.map(mapRowToFeedback);

    return { items, total, limit, offset };
  }

  /**
   * Retrieves single feedback with threaded comments.
   */
  public async getFeedbackById(
    id: string,
    includeModerated = false
  ): Promise<{ feedback: BetaFeedback; comments: BetaFeedbackComment[] } | null> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows: fbRows } = await pool.query(
      `SELECT * FROM beta_feedback WHERE id = $1`,
      [id]
    );

    if (fbRows.length === 0) {
      return null;
    }

    const feedback = mapRowToFeedback(fbRows[0]);

    const commentCondition = includeModerated ? '' : `AND moderation_status = 'APPROVED'`;
    const { rows: commentRows } = await pool.query(
      `SELECT * FROM beta_feedback_comments 
       WHERE feedback_id = $1 ${commentCondition}
       ORDER BY created_at ASC`,
      [id]
    );

    const comments = commentRows.map(mapRowToComment);

    return { feedback, comments };
  }

  /**
   * Adds a comment or reply to an existing feedback thread.
   */
  public async addComment(options: {
    feedbackId: string;
    authorName: string;
    message: string;
    isAdmin?: boolean;
    parentCommentId?: string;
  }): Promise<BetaFeedbackComment> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const cleanMsg = (options.message || '').trim();
    if (cleanMsg.length < 1 || cleanMsg.length > 2000) {
      throw new FeedbackError('Message must be between 1 and 2000 characters.', 'INVALID_MESSAGE', 400);
    }

    const cleanAuthor = (options.authorName || '').trim();
    if (cleanAuthor.length < 1 || cleanAuthor.length > 100) {
      throw new FeedbackError('Author name is required.', 'INVALID_AUTHOR', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: fbRows } = await client.query(
        `SELECT id FROM beta_feedback WHERE id = $1 FOR UPDATE`,
        [options.feedbackId]
      );

      if (fbRows.length === 0) {
        throw new FeedbackError('Feedback thread not found.', 'FEEDBACK_NOT_FOUND', 404);
      }

      const insertSql = `
        INSERT INTO beta_feedback_comments (
          feedback_id,
          parent_comment_id,
          author_name,
          is_admin,
          message,
          moderation_status,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'APPROVED', NOW()
        ) RETURNING *;
      `;

      const { rows: commentRows } = await client.query(insertSql, [
        options.feedbackId,
        options.parentCommentId || null,
        cleanAuthor,
        !!options.isAdmin,
        cleanMsg,
      ]);

      await client.query(
        `UPDATE beta_feedback 
         SET comments_count = comments_count + 1, updated_at = NOW() 
         WHERE id = $1`,
        [options.feedbackId]
      );

      await client.query('COMMIT');
      return mapRowToComment(commentRows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reports inappropriate feedback content.
   */
  public async reportFeedback(id: string): Promise<{ success: boolean; reportCount: number }> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `UPDATE beta_feedback 
       SET report_count = report_count + 1,
           is_reported = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING report_count, is_reported`,
      [id]
    );

    if (rows.length === 0) {
      throw new FeedbackError('Feedback item not found.', 'FEEDBACK_NOT_FOUND', 404);
    }

    return { success: true, reportCount: rows[0].report_count };
  }

  /**
   * Admin: Updates the status of a feedback item (e.g. NEW -> UNDER_REVIEW -> IN_PROGRESS -> FIXED).
   */
  public async updateStatus(
    id: string,
    status: BetaFeedbackStatus,
    adminId?: string
  ): Promise<BetaFeedback> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `UPDATE beta_feedback 
       SET status = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id, status]
    );

    if (rows.length === 0) {
      throw new FeedbackError('Feedback item not found.', 'FEEDBACK_NOT_FOUND', 404);
    }

    const updated = mapRowToFeedback(rows[0]);

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'FEEDBACK_STATUS_CHANGE', 'feedback', $2, $3)`,
      [adminId || null, id, JSON.stringify({ status })]
    );

    return updated;
  }

  /**
   * Admin: Pin or unpin a feedback discussion.
   */
  public async togglePin(id: string, isPinned: boolean, adminId?: string): Promise<BetaFeedback> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `UPDATE beta_feedback 
       SET is_pinned = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id, isPinned]
    );

    if (rows.length === 0) {
      throw new FeedbackError('Feedback item not found.', 'FEEDBACK_NOT_FOUND', 404);
    }

    return mapRowToFeedback(rows[0]);
  }

  /**
   * Admin: Moderates a comment (APPROVED / FLAGGED).
   */
  public async moderateComment(
    commentId: string,
    moderationStatus: 'APPROVED' | 'FLAGGED',
    adminId?: string
  ): Promise<BetaFeedbackComment> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const { rows } = await pool.query(
      `UPDATE beta_feedback_comments 
       SET moderation_status = $2 
       WHERE id = $1 
       RETURNING *`,
      [commentId, moderationStatus]
    );

    if (rows.length === 0) {
      throw new FeedbackError('Comment not found.', 'COMMENT_NOT_FOUND', 404);
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'COMMENT_MODERATED', 'comment', $2, $3)`,
      [adminId || null, commentId, JSON.stringify({ moderationStatus })]
    );

    return mapRowToComment(rows[0]);
  }
}

export const feedbackService = new FeedbackService();
