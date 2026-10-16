import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { authenticate } from '../middleware/auth';
import { audioService } from '../services/audio.service';
import { ApiResponse } from '@shared';

export const audioRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/audio/:filename
   * Securely streams an audio recording.
   * Authorization:
   * 1. Requires valid Bearer JWT authentication.
   * 2. Resolves owning booking from database.
   * 3. Customer: only the customer who owns the booking.
   * 4. Provider: only the provider assigned to that booking.
   * 5. Admin: operational access permitted.
   * 6. Preserves HTTP range requests, MIME types, and streaming.
   */
  app.get<{ Params: { filename: string } }>(
    '/:filename',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { filename } = request.params;

      // 1. Path traversal and filename safety check
      if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            messageEn: 'Audio file not found.',
            messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      // 2. Resolve owning booking in database
      const pool = db.getPool();
      if (!pool) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            messageEn: 'Database connection is unavailable.',
            messageHi: 'डेटाबेस कनेक्शन अनुपलब्ध है।',
          },
        };
        return reply.status(500).send(response);
      }

      const bookingQuery = `
        SELECT id, customer_id, provider_id, status
        FROM bookings
        WHERE audio_url = $1 OR audio_url = $2
        LIMIT 1
      `;
      const { rows: bookings } = await pool.query<{
        id: string;
        customer_id: string;
        provider_id: string | null;
        status: string;
      }>(bookingQuery, [`/api/audio/${filename}`, filename]);

      if (bookings.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            messageEn: 'Audio file not found.',
            messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      const booking = bookings[0];
      const user = request.user;

      // 3. Ownership / Role Authorization
      if (user.role === 'admin') {
        // Admin operational access permitted
      } else if (user.role === 'customer') {
        if (booking.customer_id !== user.id) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'FORBIDDEN',
              messageEn: 'Access denied. You do not own this booking audio.',
              messageHi: 'पहुँच अस्वीकृत। आप इस बुकिंग ऑडियो के स्वामी नहीं हैं।',
            },
          };
          return reply.status(403).send(response);
        }
      } else if (user.role === 'provider') {
        if (!booking.provider_id || booking.provider_id !== user.id) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'FORBIDDEN',
              messageEn: 'Access denied. You are not assigned to this booking.',
              messageHi: 'पहुँच अस्वीकृत। आप इस बुकिंग के लिए नियत नहीं हैं।',
            },
          };
          return reply.status(403).send(response);
        }
      } else {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'Access denied.',
            messageHi: 'पहुँच अस्वीकृत।',
          },
        };
        return reply.status(403).send(response);
      }

      // 4. Retrieve audio from storage driver
      let audioFile;
      try {
        audioFile = await audioService.getAudioFile(filename);
      } catch (err: any) {
        request.log.error({ err, filename }, 'Error retrieving audio file from storage');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'STORAGE_ERROR',
            messageEn: 'Failed to retrieve audio file.',
            messageHi: 'ऑडियो फ़ाइल प्राप्त करने में विफल।',
          },
        };
        return reply.status(500).send(response);
      }

      if (!audioFile) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            messageEn: 'Audio file not found.',
            messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      // 5. Content Type & Headers
      reply.header('Content-Type', audioFile.contentType);
      reply.header('Accept-Ranges', 'bytes');

      // 6. HTTP Range Request Handling (206 Partial Content)
      const range = request.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : audioFile.contentLength - 1;

        if (
          isNaN(start) ||
          start >= audioFile.contentLength ||
          end >= audioFile.contentLength ||
          start > end
        ) {
          reply.header('Content-Range', `bytes */${audioFile.contentLength}`);
          return reply.status(416).send();
        }

        const chunksize = end - start + 1;
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${audioFile.contentLength}`);
        reply.header('Content-Length', chunksize);
        return reply.send(audioFile.buffer.subarray(start, end + 1));
      }

      reply.header('Content-Length', audioFile.contentLength);
      return reply.send(audioFile.buffer);
    }
  );
};
