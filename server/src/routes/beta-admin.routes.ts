import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { releaseService, ReleaseError } from '../services/release.service';
import { feedbackService, FeedbackError } from '../services/feedback.service';
import { db } from '../db';
import { ApiResponse, AppRelease, BetaFeedback } from '@shared';

const publishReleaseSchema = z.object({
  changelog: z.string().trim().optional(),
});

const withdrawReleaseSchema = z.object({
  reason: z.string().trim().min(3, 'Withdrawal reason must be at least 3 characters').max(500),
});

const updateFeedbackStatusSchema = z.object({
  status: z.enum(['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX']),
});

const pinFeedbackSchema = z.object({
  isPinned: z.boolean(),
});

const moderateCommentSchema = z.object({
  moderationStatus: z.enum(['APPROVED', 'FLAGGED']),
});

const adminReplyCommentSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
  authorName: z.string().trim().max(100).optional(),
});

const uploadReleaseJsonSchema = z.object({
  apkBase64: z.string().min(100, 'APK base64 payload is required'),
  filename: z.string().optional(),
  changelog: z.string().trim().min(5, 'Changelog must be at least 5 characters').max(5000),
});

export const betaAdminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All routes in this plugin strictly require admin role
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole(['admin']));

  /**
   * GET /api/admin/beta/releases
   * Lists all releases (including drafts).
   */
  app.get('/releases', async (_request, reply) => {
    try {
      const releases = await releaseService.listAdminReleases();
      const response: ApiResponse<{ releases: AppRelease[] }> = {
        success: true,
        data: { releases },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: err.message },
      });
    }
  });

  /**
   * POST /api/admin/beta/releases/upload
   * Handles APK upload either via multipart form-data or JSON base64.
   */
  app.post('/releases/upload', async (request, reply) => {
    try {
      let fileBuffer: Buffer | undefined;
      let originalFilename = 'release.apk';
      let changelog = '';

      // 1. Check if multipart
      if (request.isMultipart && request.isMultipart()) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'apk') {
            originalFilename = part.filename || 'release.apk';
            fileBuffer = await part.toBuffer();
          } else if (part.type === 'field' && part.fieldname === 'changelog') {
            changelog = String(part.value || '').trim();
          }
        }
      } else {
        // 2. JSON payload
        const parsed = uploadReleaseJsonSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid upload body',
            },
          });
        }
        changelog = parsed.data.changelog;
        originalFilename = parsed.data.filename || 'release.apk';
        const cleanBase64 = parsed.data.apkBase64.replace(/^data:application\/octet-stream;base64,/, '');
        fileBuffer = Buffer.from(cleanBase64, 'base64');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_FILE', messageEn: 'No APK file uploaded.' },
        });
      }

      if (!changelog) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_CHANGELOG', messageEn: 'Release changelog is required.' },
        });
      }

      const result = await releaseService.uploadDraftRelease({
        fileBuffer,
        originalFilename,
        changelog,
        adminId: request.user.id,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'UPLOAD_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * POST /api/admin/beta/releases/:id/publish
   * Publishes draft release as the latest active release.
   */
  app.post('/releases/:id/publish', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = publishReleaseSchema.safeParse(request.body || {});
      const changelog = parsed.success ? parsed.data.changelog : undefined;

      const published = await releaseService.publishRelease(id, request.user.id, changelog);
      return reply.status(200).send({
        success: true,
        data: { release: published },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'PUBLISH_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * POST /api/admin/beta/releases/:id/withdraw
   * Withdraws a release with mandatory explanation.
   */
  app.post('/releases/:id/withdraw', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = withdrawReleaseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid withdrawal reason',
          },
        });
      }

      const withdrawn = await releaseService.withdrawRelease(id, parsed.data.reason, request.user.id);
      return reply.status(200).send({
        success: true,
        data: { release: withdrawn },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'WITHDRAW_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * GET /api/admin/beta/feedback
   * Lists all feedback with moderation views.
   */
  app.get('/feedback', async (request, reply) => {
    try {
      const query = request.query as any;
      const result = await feedbackService.listFeedback({
        category: query.category,
        status: query.status,
        appVersion: query.appVersion,
        testerRole: query.testerRole,
        search: query.search,
        sort: query.sort,
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: err.message },
      });
    }
  });

  /**
   * GET /api/admin/beta/feedback/:id
   * Retrieves single feedback discussion with ALL comments (including flagged).
   */
  app.get('/feedback/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await feedbackService.getFeedbackById(id, true);
      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', messageEn: 'Feedback thread not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: err.message },
      });
    }
  });

  /**
   * PATCH /api/admin/beta/feedback/:id/status
   * Updates status of a feedback item.
   */
  app.patch('/feedback/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = updateFeedbackStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', messageEn: parsed.error.errors[0]?.message || 'Invalid status' },
        });
      }

      const updated = await feedbackService.updateStatus(id, parsed.data.status, request.user.id);
      return reply.status(200).send({
        success: true,
        data: { feedback: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'UPDATE_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * PATCH /api/admin/beta/feedback/:id/pin
   * Toggles pinned state of a discussion.
   */
  app.patch('/feedback/:id/pin', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = pinFeedbackSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', messageEn: 'isPinned boolean is required' },
        });
      }

      const updated = await feedbackService.togglePin(id, parsed.data.isPinned, request.user.id);
      return reply.status(200).send({
        success: true,
        data: { feedback: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'UPDATE_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * PATCH /api/admin/beta/feedback/comments/:commentId/moderate
   * Moderates a comment (APPROVED / FLAGGED).
   */
  app.patch('/feedback/comments/:commentId/moderate', async (request, reply) => {
    try {
      const { commentId } = request.params as { commentId: string };
      const parsed = moderateCommentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', messageEn: 'moderationStatus is required' },
        });
      }

      const comment = await feedbackService.moderateComment(commentId, parsed.data.moderationStatus, request.user.id);
      return reply.status(200).send({
        success: true,
        data: { comment },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'MODERATION_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * POST /api/admin/beta/feedback/:id/comments
   * Posts an official administrative response to a feedback item.
   */
  app.post('/feedback/:id/comments', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const parsed = adminReplyCommentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', messageEn: parsed.error.errors[0]?.message || 'Invalid comment' },
        });
      }

      const authorName = parsed.data.authorName || request.user.phone || 'Chandil Team (Admin)';
      const comment = await feedbackService.addComment({
        feedbackId: id,
        authorName,
        message: parsed.data.message,
        isAdmin: true,
      });

      return reply.status(201).send({
        success: true,
        data: { comment },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        success: false,
        error: { code: err.code || 'COMMENT_FAILED', messageEn: err.message },
      });
    }
  });

  /**
   * GET /api/admin/beta/analytics
   * Aggregates real download statistics and feedback health metrics.
   */
  app.get('/analytics', async (_request, reply) => {
    const pool = db.getPool();
    if (!pool) return reply.status(500).send({ success: false, error: { code: 'DB_UNAVAILABLE', messageEn: 'DB unavailable' } });

    try {
      const { rows: releaseStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_releases,
          COUNT(CASE WHEN release_status = 'published' THEN 1 END) as published_releases,
          COUNT(CASE WHEN release_status = 'draft' THEN 1 END) as draft_releases,
          COUNT(CASE WHEN release_status = 'withdrawn' THEN 1 END) as withdrawn_releases,
          COALESCE(SUM(download_count), 0) as total_downloads
        FROM app_releases;
      `);

      const { rows: feedbackStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN status = 'NEW' THEN 1 END) as new_count,
          COUNT(CASE WHEN status = 'UNDER_REVIEW' THEN 1 END) as under_review_count,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'FIXED' THEN 1 END) as fixed_count,
          COUNT(CASE WHEN is_reported = true THEN 1 END) as reported_count
        FROM beta_feedback;
      `);

      const { rows: categoryStats } = await pool.query(`
        SELECT category, COUNT(*) as count 
        FROM beta_feedback 
        GROUP BY category 
        ORDER BY count DESC;
      `);

      return reply.status(200).send({
        success: true,
        data: {
          releases: releaseStats[0],
          feedback: feedbackStats[0],
          byCategory: categoryStats,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'ANALYTICS_ERROR', messageEn: err.message },
      });
    }
  });

  /**
   * GET /api/admin/beta/audit-logs
   * Retrieves recent audit entries.
   */
  app.get('/audit-logs', async (_request, reply) => {
    const pool = db.getPool();
    if (!pool) return reply.status(500).send({ success: false, error: { code: 'DB_UNAVAILABLE', messageEn: 'DB unavailable' } });

    try {
      const { rows } = await pool.query(`
        SELECT l.*, u.phone as admin_phone, u.full_name as admin_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 50;
      `);

      return reply.status(200).send({
        success: true,
        data: { logs: rows },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'AUDIT_LOG_ERROR', messageEn: err.message },
      });
    }
  });
};
