import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ApiResponse, VerifiedWorkerSummary } from '@shared';
import { workerService, WorkerError } from '../services/worker.service';

const workerOnboardingSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
  categoryId: z.string().trim().min(1, 'Category ID is required'),
  aadhaarFrontBase64: z.string().optional(),
  aadhaarFrontMime: z.string().optional(),
  aadhaarBackBase64: z.string().optional(),
  aadhaarBackMime: z.string().optional(),
  photoBase64: z.string().optional(),
  photoMime: z.string().optional(),
});

export const workerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/worker/onboarding
   * Authenticated endpoint for workers to submit their onboarding application.
   */
  app.post(
    '/worker/onboarding',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const parsed = workerOnboardingSchema.safeParse(request.body);
        if (!parsed.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid onboarding data',
              messageHi: 'अमान्य ऑनबोर्डिंग डेटा।',
            },
          };
          return reply.status(400).send(response);
        }

        const result = await workerService.submitOnboarding(request.user.id, parsed.data);
        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof WorkerError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/worker/status
   * Authenticated endpoint returning current user's worker onboarding / verification status.
   */
  app.get(
    '/worker/status',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const status = await workerService.getWorkerStatus(request.user.id);
        const response: ApiResponse<typeof status> = {
          success: true,
          data: status,
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof WorkerError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/workers/verified
   * Customer-facing endpoint returning only verified, active workers.
   * Optional query param: category_id
   */
  app.get('/workers/verified', async (request, reply) => {
    try {
      const query = request.query as { category_id?: string };
      const categoryId = query.category_id ? String(query.category_id).trim() : undefined;
      const workers = await workerService.getVerifiedWorkers(categoryId);

      const response: ApiResponse<{ workers: VerifiedWorkerSummary[] }> = {
        success: true,
        data: { workers },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof WorkerError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: err.code,
            messageEn: err.messageEn,
            messageHi: err.messageHi,
          },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  /**
   * GET /api/workers/:id/photo
   * Authenticated endpoint to retrieve worker photo.
   * - Admin: always allowed.
   * - Worker: can retrieve their own photo.
   * - Customers: only allowed if worker is VERIFIED.
   */
  app.get(
    '/workers/:id/photo',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { buffer, mimeType } = await workerService.getWorkerPhoto(id, request.user);

        return reply
          .header('Content-Type', mimeType)
          .header('X-Content-Type-Options', 'nosniff')
          .header('Cache-Control', 'private, max-age=3600')
          .send(buffer);
      } catch (err: any) {
        if (err instanceof WorkerError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );
};
