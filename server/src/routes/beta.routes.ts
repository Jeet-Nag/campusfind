import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { releaseService, ReleaseError } from '../services/release.service';
import { feedbackService, FeedbackError } from '../services/feedback.service';
import { storageService } from '../services/storage.service';
import { ApiResponse, AppRelease, BetaFeedback } from '@shared';

// Rate limiting cache for public feedback submissions
const submissionRateLimits = new Map<string, number[]>();

function checkRateLimit(ip: string, maxAttempts = 15, windowMs = 60000): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const history = (submissionRateLimits.get(ip) || []).filter((t) => now - t < windowMs);
  if (history.length >= maxAttempts) return false;
  history.push(now);
  submissionRateLimits.set(ip, history);
  return true;
}

const createFeedbackSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(5000, 'Description cannot exceed 5000 characters'),
  category: z.enum([
    'BUG_REPORT',
    'UI_DESIGN',
    'PERFORMANCE',
    'AUTH',
    'BOOKING',
    'WORKER_EXPERIENCE',
    'FEATURE_REQUEST',
    'OTHER',
  ]),
  appVersion: z.string().trim().min(1, 'App version is required').max(64),
  testerRole: z.enum(['customer', 'worker', 'both']),
  deviceModel: z.string().trim().max(128).optional(),
  androidVersion: z.string().trim().max(64).optional(),
  authorName: z.string().trim().min(1, 'Author name is required').max(100),
  authorContact: z.string().trim().max(100).optional(),
  screenshotBase64: z.string().optional(),
  screenshotMime: z.string().optional(),
});

const createCommentSchema = z.object({
  authorName: z.string().trim().min(1, 'Author name is required').max(100),
  message: z.string().trim().min(1, 'Message is required').max(2000),
  parentCommentId: z.string().uuid().optional(),
});

export const betaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/beta/releases/latest
   * Returns the latest published beta release.
   */
  app.get('/releases/latest', async (_request, reply) => {
    try {
      const release = await releaseService.getLatestRelease();
      const response: ApiResponse<{ release: AppRelease | null }> = {
        success: true,
        data: { release },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'DATABASE_ERROR', messageEn: err.message, messageHi: 'डेटाबेस त्रुटि।' },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/beta/releases
   * Lists published and withdrawn releases for the public downloads archive.
   */
  app.get('/releases', async (_request, reply) => {
    try {
      const releases = await releaseService.listPublicReleases();
      const response: ApiResponse<{ releases: AppRelease[] }> = {
        success: true,
        data: { releases },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'DATABASE_ERROR', messageEn: err.message, messageHi: 'डेटाबेस त्रुटि।' },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/beta/releases/:id
   * Retrieves metadata for a specific release.
   */
  app.get('/releases/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const release = await releaseService.getReleaseById(id);
      if (!release || release.releaseStatus === 'draft') {
        const response: ApiResponse = {
          success: false,
          error: { code: 'RELEASE_NOT_FOUND', messageEn: 'Release not found.', messageHi: 'रिलीज़ नहीं मिली।' },
        };
        return reply.status(404).send(response);
      }
      const response: ApiResponse<{ release: AppRelease }> = {
        success: true,
        data: { release },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: err.message, messageHi: 'सर्वर त्रुटि।' },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/beta/releases/:id/download
   * Streams the actual APK binary file with HTTP Range support for resumable downloads.
   */
  app.get('/releases/:id/download', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const release = await releaseService.getReleaseById(id);

      if (!release) {
        return reply.status(404).send({
          success: false,
          error: { code: 'RELEASE_NOT_FOUND', messageEn: 'Release not found.', messageHi: 'रिलीज़ नहीं मिली।' },
        });
      }

      if (release.releaseStatus === 'draft') {
        return reply.status(403).send({
          success: false,
          error: { code: 'DRAFT_RELEASE', messageEn: 'Draft releases cannot be publicly downloaded.', messageHi: 'ड्राफ्ट रिलीज़ डाउनलोड नहीं की जा सकती।' },
        });
      }

      const filePath = storageService.resolveAbsolutePath(release.apkStorageKey || '');
      if (!filePath || !fs.existsSync(filePath)) {
        return reply.status(404).send({
          success: false,
          error: { code: 'APK_FILE_MISSING', messageEn: 'APK binary file not found on storage.', messageHi: 'एपीके फ़ाइल सर्वर पर नहीं मिली।' },
        });
      }

      const stat = fs.statSync(filePath);
      const downloadFilename = `ChandilHomeServices-${release.versionDisplay}.apk`;

      // Track telemetry in background
      const ip = request.ip || '127.0.0.1';
      const userAgent = request.headers['user-agent'];
      releaseService.trackDownload(release.id, ip, userAgent).catch(() => {});

      reply.header('Content-Type', 'application/vnd.android.package-archive');
      reply.header('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('X-APK-SHA256', release.sha256);
      reply.header('X-APK-Version', release.versionDisplay);

      const range = request.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        if (isNaN(start) || start >= stat.size || end >= stat.size || start > end) {
          reply.header('Content-Range', `bytes */${stat.size}`);
          return reply.status(416).send();
        }

        const chunksize = end - start + 1;
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        reply.header('Content-Length', chunksize);
        return reply.send(fs.createReadStream(filePath, { start, end }));
      }

      reply.header('Content-Length', stat.size);
      return reply.send(fs.createReadStream(filePath));
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'STREAM_ERROR', messageEn: err.message, messageHi: 'डाउनलोड त्रुटि।' },
      });
    }
  });

  /**
   * GET /api/beta/feedback
   * Public feedback listing with search, category/status filters, and sorting.
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
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'FEEDBACK_LIST_ERROR', messageEn: err.message, messageHi: 'फीडबैक सूची लोड करने में त्रुटि।' },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/beta/feedback/:id
   * Retrieves single feedback discussion with approved comments.
   */
  app.get('/feedback/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await feedbackService.getFeedbackById(id, false);

      if (!result) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'FEEDBACK_NOT_FOUND', messageEn: 'Feedback post not found.', messageHi: 'फीडबैक पोस्ट नहीं मिली।' },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: err.message, messageHi: 'सर्वर त्रुटि।' },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * POST /api/beta/feedback
   * Submits a new feedback item from a tester.
   */
  app.post('/feedback', async (request, reply) => {
    try {
      const ip = request.ip || '127.0.0.1';
      if (!checkRateLimit(ip)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            messageEn: 'Too many submissions. Please wait a minute and try again.',
            messageHi: 'अत्यधिक प्रयास। कृपया कुछ देर बाद प्रयास करें।',
          },
        };
        return reply.status(429).send(response);
      }

      const parsed = createFeedbackSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid feedback data',
            messageHi: 'अमान्य डेटा।',
          },
        };
        return reply.status(400).send(response);
      }

      const feedback = await feedbackService.createFeedback(parsed.data);
      const response: ApiResponse<{ feedback: BetaFeedback }> = {
        success: true,
        data: { feedback },
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      if (err instanceof FeedbackError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.message, messageHi: 'फीडबैक त्रुटि।' },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  /**
   * POST /api/beta/feedback/:id/comments
   * Adds a reply or comment to a feedback discussion.
   */
  app.post('/feedback/:id/comments', async (request, reply) => {
    try {
      const ip = request.ip || '127.0.0.1';
      if (!checkRateLimit(ip, 20)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            messageEn: 'Too many comments. Please wait before replying again.',
            messageHi: 'अत्यधिक टिप्पणियाँ। कृपया प्रतीक्षा करें।',
          },
        };
        return reply.status(429).send(response);
      }

      const { id } = request.params as { id: string };
      const parsed = createCommentSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid comment data',
            messageHi: 'अमान्य टिप्पणी।',
          },
        };
        return reply.status(400).send(response);
      }

      const comment = await feedbackService.addComment({
        feedbackId: id,
        authorName: parsed.data.authorName,
        message: parsed.data.message,
        parentCommentId: parsed.data.parentCommentId,
        isAdmin: false,
      });

      const response: ApiResponse<{ comment: typeof comment }> = {
        success: true,
        data: { comment },
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      if (err instanceof FeedbackError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.message, messageHi: 'टिप्पणी त्रुटि।' },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  /**
   * POST /api/beta/feedback/:id/report
   * Flags inappropriate content for administrative review.
   */
  app.post('/feedback/:id/report', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const res = await feedbackService.reportFeedback(id);
      const response: ApiResponse<{ success: boolean; reported: boolean }> = {
        success: true,
        data: { success: true, reported: true },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof FeedbackError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.message, messageHi: 'रिपोर्ट त्रुटि।' },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  /**
   * GET /api/beta/attachments/:filename
   * Safely serves uploaded screenshot attachments.
   */
  app.get('/attachments/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', messageEn: 'Attachment not found.' } });
    }

    const filePath = storageService.resolveAbsolutePath(`feedback/${filename}`);
    if (!filePath || !fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', messageEn: 'Attachment not found.' } });
    }

    let contentType = 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filename.endsWith('.webp')) contentType = 'image/webp';

    reply.header('Content-Type', contentType);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(fs.createReadStream(filePath));
  });
};
