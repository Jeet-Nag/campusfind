import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { campusService } from '../services/campus.service';
import { authenticate } from '../middleware/auth';
import { ApiResponse, CampusItem, CampusClaim } from '@shared';

const categoryEnum = z.enum([
  'electronics',
  'student_ids_cards',
  'keys_wallets',
  'books',
  'clothing',
  'accessories',
  'other',
]);

const createItemSchema = z.object({
  type: z.enum(['lost', 'found'], { required_error: 'Item type (lost or found) is required' }),
  title: z.string().min(2, 'Item name must be at least 2 characters').max(200),
  category: categoryEnum,
  description: z.string().min(5, 'Description must be at least 5 characters').max(3000),
  location: z.string().min(2, 'Location is required').max(150),
  dateOccurred: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  contactMethod: z.string().min(2, 'Preferred contact method is required').max(255),
  imageUrl: z.string().optional().nullable(),
  isSensitive: z.boolean().optional(),
  sensitiveDetails: z.string().optional().nullable(),
});

const updateItemSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  category: categoryEnum.optional(),
  description: z.string().min(5).max(3000).optional(),
  location: z.string().min(2).max(150).optional(),
  dateOccurred: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contactMethod: z.string().min(2).max(255).optional(),
  imageUrl: z.string().optional().nullable(),
  isSensitive: z.boolean().optional(),
  sensitiveDetails: z.string().optional().nullable(),
  status: z.enum(['open', 'claim_pending', 'returned']).optional(),
});

const submitClaimSchema = z.object({
  claimantName: z.string().min(2, 'Claimant name must be at least 2 characters').max(100),
  claimantContact: z.string().min(3, 'Claimant contact (email or phone) is required').max(255),
  distinguishingFeature: z
    .string()
    .min(5, 'Please describe a distinguishing feature that is not publicly visible')
    .max(1000),
  message: z.string().max(1000).optional(),
});

const reviewClaimSchema = z.object({
  status: z.enum(['accepted', 'rejected'], { required_error: 'Status must be accepted or rejected' }),
  ownerResponse: z.string().max(1000).optional(),
});

export const campusItemsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const itemsUploadDir = path.resolve(process.cwd(), 'uploads', 'items');
  if (!fs.existsSync(itemsUploadDir)) {
    fs.mkdirSync(itemsUploadDir, { recursive: true });
  }

  /**
   * GET /api/campus/items
   * Public browsing and search of lost & found items.
   */
  app.get<{
    Querystring: {
      search?: string;
      type?: string;
      category?: string;
      location?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>('/items', async (request, reply) => {
    try {
      const { search, type, category, location, status, limit, offset } = request.query;

      const items = await campusService.listItems({
        search,
        type,
        category,
        location,
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });

      const response: ApiResponse<CampusItem[]> = {
        success: true,
        data: items,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ITEMS_FETCH_ERROR',
          messageEn: err.message || 'Failed to fetch campus items.',
          messageHi: 'आइटम प्राप्त करने में विफल।',
        },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/campus/items/my-reports
   * List items reported by the authenticated student.
   */
  app.get('/items/my-reports', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const reports = await campusService.listUserReports(userId);

      const response: ApiResponse<CampusItem[]> = {
        success: true,
        data: reports,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MY_REPORTS_ERROR',
          messageEn: err.message || 'Failed to retrieve your reports.',
          messageHi: 'आपकी रिपोर्ट प्राप्त करने में विफल।',
        },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/campus/claims/my-claims
   * List claims submitted by the authenticated student.
   */
  app.get('/claims/my-claims', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const claims = await campusService.listUserClaims(userId);

      const response: ApiResponse<CampusClaim[]> = {
        success: true,
        data: claims,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MY_CLAIMS_ERROR',
          messageEn: err.message || 'Failed to retrieve your claims.',
          messageHi: 'आपके दावे प्राप्त करने में विफल।',
        },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/campus/items/:id
   * Get item detail.
   */
  app.get<{ Params: { id: string } }>('/items/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Extract optional requesting user ID from Authorization header if present
      let requestingUserId: string | undefined;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = await request.jwtVerify<{ id: string }>();
          requestingUserId = decoded.id;
        } catch {
          // Token invalid or absent; treated as unauthenticated public viewer
        }
      }

      const result = await campusService.getItemById(id, requestingUserId);
      if (!result) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            messageEn: 'Campus item not found.',
            messageHi: 'आइटम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse<{ item: CampusItem; claims?: CampusClaim[] }> = {
        success: true,
        data: result,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ITEM_FETCH_ERROR',
          messageEn: err.message || 'Failed to fetch item details.',
          messageHi: 'विवरण प्राप्त करने में विफल।',
        },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * POST /api/campus/items
   * Submit a new lost or found item report.
   */
  app.post('/items', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const parsed = createItemSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid item data',
            messageHi: 'अमान्य डेटा।',
            details: parsed.error.errors,
          },
        };
        return reply.status(400).send(response);
      }

      const userId = request.user.id;
      const created = await campusService.createItem(userId, parsed.data as any);

      const response: ApiResponse<CampusItem> = {
        success: true,
        data: created,
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ITEM_CREATE_FAILED',
          messageEn: err.message || 'Failed to create report.',
          messageHi: 'रिपोर्ट बनाने में विफल।',
        },
      };
      return reply.status(400).send(response);
    }
  });

  /**
   * PATCH /api/campus/items/:id
   * Update report details or status. Protected: owner only.
   */
  app.patch<{ Params: { id: string } }>('/items/:id', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const parsed = updateItemSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid update data',
            messageHi: 'अमान्य डेटा।',
          },
        };
        return reply.status(400).send(response);
      }

      const userId = request.user.id;
      const updated = await campusService.updateItem(id, userId, parsed.data as any);

      const response: ApiResponse<CampusItem> = {
        success: true,
        data: updated,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'You are not authorized to edit this report.',
            messageHi: 'आप इस रिपोर्ट को संपादित करने के लिए अधिकृत नहीं हैं।',
          },
        };
        return reply.status(403).send(response);
      }
      if (err.message === 'ITEM_NOT_FOUND') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            messageEn: 'Item not found.',
            messageHi: 'आइटम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          messageEn: err.message || 'Failed to update item.',
          messageHi: 'अपडेट करने में विफल।',
        },
      };
      return reply.status(400).send(response);
    }
  });

  /**
   * DELETE /api/campus/items/:id
   * Delete an item report. Protected: owner only.
   */
  app.delete<{ Params: { id: string } }>('/items/:id', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      await campusService.deleteItem(id, userId);

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Item report deleted successfully.' },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'You are not authorized to delete this report.',
            messageHi: 'आप इस रिपोर्ट को हटाने के लिए अधिकृत नहीं हैं।',
          },
        };
        return reply.status(403).send(response);
      }
      if (err.message === 'ITEM_NOT_FOUND') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            messageEn: 'Item not found.',
            messageHi: 'आइटम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          messageEn: err.message || 'Failed to delete item.',
          messageHi: 'हटाने में विफल।',
        },
      };
      return reply.status(400).send(response);
    }
  });

  /**
   * POST /api/campus/items/:id/claim
   * Submit a claim / contact request for an item.
   */
  app.post<{ Params: { id: string } }>('/items/:id/claim', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const parsed = submitClaimSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid claim details',
            messageHi: 'अमान्य दावा विवरण।',
          },
        };
        return reply.status(400).send(response);
      }

      const claimantId = request.user.id;
      const claim = await campusService.submitClaim(id, claimantId, parsed.data);

      const response: ApiResponse<CampusClaim> = {
        success: true,
        data: claim,
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      if (err.message === 'CANNOT_CLAIM_OWN_ITEM') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CANNOT_CLAIM_OWN_ITEM',
            messageEn: 'You cannot submit a claim on your own report.',
            messageHi: 'आप अपनी खुद की रिपोर्ट पर दावा प्रस्तुत नहीं कर सकते।',
          },
        };
        return reply.status(400).send(response);
      }
      if (err.message === 'ITEM_NOT_FOUND') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            messageEn: 'Item not found.',
            messageHi: 'आइटम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CLAIM_FAILED',
          messageEn: err.message || 'Failed to submit claim.',
          messageHi: 'दावा प्रस्तुत करने में विफल।',
        },
      };
      return reply.status(400).send(response);
    }
  });

  /**
   * PATCH /api/campus/claims/:claimId/review
   * Review claim (accept or reject). Protected: owner only.
   */
  app.patch<{ Params: { claimId: string } }>(
    '/claims/:claimId/review',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const { claimId } = request.params;
        const parsed = reviewClaimSchema.safeParse(request.body);
        if (!parsed.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid review data',
              messageHi: 'अमान्य समीक्षा विवरण।',
            },
          };
          return reply.status(400).send(response);
        }

        const ownerId = request.user.id;
        const reviewed = await campusService.reviewClaim(
          claimId,
          ownerId,
          parsed.data.status,
          parsed.data.ownerResponse
        );

        const response: ApiResponse<CampusClaim> = {
          success: true,
          data: reviewed,
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err.message === 'FORBIDDEN') {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'FORBIDDEN',
              messageEn: 'You are not authorized to review this claim.',
              messageHi: 'आप इस दावे की समीक्षा करने के लिए अधिकृत नहीं हैं।',
            },
          };
          return reply.status(403).send(response);
        }
        if (err.message === 'CLAIM_NOT_FOUND') {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              messageEn: 'Claim not found.',
              messageHi: 'दावा नहीं मिला।',
            },
          };
          return reply.status(404).send(response);
        }

        const response: ApiResponse = {
          success: false,
          error: {
            code: 'REVIEW_FAILED',
            messageEn: err.message || 'Failed to review claim.',
            messageHi: 'समीक्षा विफल रही।',
          },
        };
        return reply.status(400).send(response);
      }
    }
  );

  /**
   * POST /api/campus/upload
   * Streamed image file upload for lost/found item photos.
   */
  app.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_FILE',
            messageEn: 'No image file uploaded.',
            messageHi: 'कोई फ़ाइल अपलोड नहीं की गई।',
          },
        };
        return reply.status(400).send(response);
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimes.includes(data.mimetype)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            messageEn: 'Only JPEG, PNG, WebP, and GIF images are allowed.',
            messageHi: 'केवल चित्र फ़ाइलें अनुमत हैं।',
          },
        };
        return reply.status(400).send(response);
      }

      const ext = path.extname(data.filename) || '.jpg';
      const fileId = crypto.randomUUID();
      const safeFilename = `${fileId}${ext}`;
      const filePath = path.join(itemsUploadDir, safeFilename);

      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        data.file.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const publicUrl = `/uploads/items/${safeFilename}`;

      const response: ApiResponse<{ url: string; filename: string }> = {
        success: true,
        data: { url: publicUrl, filename: safeFilename },
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          messageEn: err.message || 'Image upload failed.',
          messageHi: 'अपलोड विफल रहा।',
        },
      };
      return reply.status(500).send(response);
    }
  });
};
