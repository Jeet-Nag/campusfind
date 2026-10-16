import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { audioService } from '../services/audio.service';
import { ApiResponse, Booking, BookingDetail, BookingStatus, CHANDIL_LOCALITIES, canTransition } from '@shared';

interface DbBookingRow {
  id: string;
  idempotency_key: string;
  customer_id: string;
  provider_id: string | null;
  category_id: string;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  text_description: string | null;
  area_locality: string;
  landmark: string | null;
  status: BookingStatus;
  visiting_fee: string | number;
  final_amount: string | number | null;
  payment_method: string;
  payment_collected: boolean;
  is_test?: boolean;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

function mapBookingRow(row: DbBookingRow): Booking {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    customerId: row.customer_id,
    providerId: row.provider_id,
    categoryId: row.category_id,
    audioUrl: row.audio_url,
    audioDurationSeconds: row.audio_duration_seconds,
    textDescription: row.text_description,
    areaLocality: row.area_locality,
    landmark: row.landmark,
    status: row.status,
    visitingFee: parseFloat(String(row.visiting_fee)),
    finalAmount: row.final_amount !== null ? parseFloat(String(row.final_amount)) : null,
    paymentMethod: 'CASH',
    paymentCollected: row.payment_collected,
    isTest: Boolean(row.is_test),
    createdAt: row.created_at.toISOString(),
    acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export const bookingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/bookings
   * Creates a new customer booking request.
   * RBAC: Strictly restricted to 'customer' role.
   * State: Initialized strictly to 'SERVICE_REQUESTED'.
   * Idempotency: Protected by client-supplied idempotencyKey.
   */
  app.post<{
    Body: {
      idempotencyKey: string;
      categoryId: string;
      areaLocality: string;
      landmark?: string;
      textDescription?: string;
      audioBase64?: string;
      audioUrl?: string;
      audioDurationSeconds?: number;
    };
  }>('/', {
    preHandler: [authenticate, requireRole(['customer'])],
  }, async (request, reply) => {
    const customerId = request.user.id;
    const {
      idempotencyKey,
      categoryId,
      areaLocality,
      landmark,
      textDescription,
      audioBase64,
      audioUrl: preUploadedAudioUrl,
      audioDurationSeconds,
    } = request.body || {};

    // 1. Validate idempotencyKey
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 64) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          messageEn: 'A valid idempotency key (8-64 characters) is required.',
          messageHi: 'एक वैध आइडमपोटेंसी कुंजी (8-64 अक्षर) आवश्यक है।',
        },
      };
      return reply.status(400).send(response);
    }

    if (!/^[A-Za-z0-9_-]+$/.test(idempotencyKey)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          messageEn: 'Idempotency key may only contain alphanumeric characters, hyphens, and underscores.',
          messageHi: 'आइडमपोटेंसी कुंजी में केवल अक्षर, संख्या, हाइफ़न और अंडरस्कोर हो सकते हैं।',
        },
      };
      return reply.status(400).send(response);
    }

    // 2. Validate problem description (text OR audio required)
    const trimmedText = typeof textDescription === 'string' ? textDescription.trim() : '';
    const hasText = trimmedText.length >= 3;
    const hasAudio = Boolean(audioBase64 || preUploadedAudioUrl);

    if (!hasText && !hasAudio) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DESCRIPTION_REQUIRED',
          messageEn: 'Please describe the problem in writing or record a voice note.',
          messageHi: 'कृपया समस्या लिखकर बताएं या आवाज़ में रिकॉर्ड करें।',
        },
      };
      return reply.status(400).send(response);
    }

    if (trimmedText.length > 1000) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEXT_TOO_LONG',
          messageEn: 'Problem description must not exceed 1000 characters.',
          messageHi: 'समस्या का विवरण 1000 अक्षरों से अधिक नहीं होना चाहिए।',
        },
      };
      return reply.status(400).send(response);
    }

    if (audioDurationSeconds !== undefined) {
      if (typeof audioDurationSeconds !== 'number' || audioDurationSeconds < 1 || audioDurationSeconds > 30) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_AUDIO_DURATION',
            messageEn: 'Audio duration must be between 1 and 30 seconds.',
            messageHi: 'ऑडियो की अवधि 1 से 30 सेकंड के बीच होनी चाहिए।',
          },
        };
        return reply.status(400).send(response);
      }
    }

    // 3. Validate Locality
    if (!areaLocality || typeof areaLocality !== 'string' || areaLocality.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LOCALITY_REQUIRED',
          messageEn: 'Please select a service locality in Chandil.',
          messageHi: 'कृपया चंडिल में सेवा का इलाका चुनें।',
        },
      };
      return reply.status(400).send(response);
    }

    const trimmedLocality = areaLocality.trim();
    const isValidLocality = CHANDIL_LOCALITIES.some(
      (l) => l.id === trimmedLocality || l.nameEn.toLowerCase() === trimmedLocality.toLowerCase()
    );

    if (!isValidLocality) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_LOCALITY',
          messageEn: 'Please select a valid locality from the approved Chandil list.',
          messageHi: 'कृपया स्वीकृत चंडिल सूची से एक वैध इलाका चुनें।',
        },
      };
      return reply.status(400).send(response);
    }

    const trimmedLandmark = typeof landmark === 'string' ? landmark.trim() : null;
    if (trimmedLocality === 'other' && (!trimmedLandmark || trimmedLandmark.length < 3)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LANDMARK_REQUIRED',
          messageEn: 'Landmark or house details are required when selecting Other Area.',
          messageHi: 'अन्य क्षेत्र चुनने पर लैंडमार्क या घर का विवरण आवश्यक है।',
        },
      };
      return reply.status(400).send(response);
    }

    if (trimmedLandmark && trimmedLandmark.length > 255) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LANDMARK_TOO_LONG',
          messageEn: 'Landmark must not exceed 255 characters.',
          messageHi: 'लैंडमार्क 255 अक्षरों से अधिक नहीं होना चाहिए।',
        },
      };
      return reply.status(400).send(response);
    }

    // 4. Validate Category & Fetch Base Visit Fee
    const pool = db.getPool();
    if (!pool) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database connection is unavailable.',
          messageHi: 'डेटाबेस कनेक्शन अनुपलब्ध है।',
        },
      });
    }

    const catRes = await pool.query<{ id: string; base_visit_fee: string | number; is_active: boolean }>(
      'SELECT id, base_visit_fee, is_active FROM service_categories WHERE id = $1',
      [categoryId]
    );

    if (catRes.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          messageEn: 'Selected service category does not exist.',
          messageHi: 'चुनी गई सेवा श्रेणी मौजूद नहीं है।',
        },
      };
      return reply.status(400).send(response);
    }

    const category = catRes.rows[0];
    if (!category.is_active) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CATEGORY_INACTIVE',
          messageEn: 'Selected service category is currently inactive.',
          messageHi: 'चुनी गई सेवा श्रेणी वर्तमान में उपलब्ध नहीं है।',
        },
      };
      return reply.status(400).send(response);
    }

    const visitingFee = parseFloat(String(category.base_visit_fee));

    // 5. Pre-check idempotency key
    const existingCheck = await pool.query<DbBookingRow>(
      'SELECT * FROM bookings WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      // Verify ownership
      if (existing.customer_id !== customerId) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            messageEn: 'Idempotency key collision detected.',
            messageHi: 'आइडमपोटेंसी टकराव पाया गया।',
          },
        };
        return reply.status(409).send(response);
      }

      // Safe idempotent replay: return existing booking
      const response: ApiResponse<Booking> = {
        success: true,
        data: mapBookingRow(existing),
      };
      return reply.status(200).send(response);
    }

    // 6. Handle Audio Persistence (if provided as base64)
    let finalAudioUrl: string | null = preUploadedAudioUrl || null;
    let savedAudioFilename: string | null = null;

    if (audioBase64) {
      try {
        const saved = await audioService.saveAudioBase64(audioBase64, 'audio/webm');
        finalAudioUrl = saved.audioUrl;
        savedAudioFilename = saved.filename;
      } catch (err: any) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_SAVE_FAILED',
            messageEn: err.message || 'Failed to process audio recording.',
            messageHi: 'ऑडियो रिकॉर्डिंग सहेजने में विफल।',
          },
        };
        return reply.status(400).send(response);
      }
    }

    // 7. Atomic Database Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 7.1 Fetch customer's server-side is_test flag directly from DB (never trust client)
      const userRes = await client.query<{ is_test: boolean }>(
        'SELECT is_test FROM users WHERE id = $1',
        [customerId]
      );
      const isTest = userRes.rows.length > 0 ? Boolean(userRes.rows[0].is_test) : false;

      const insertQuery = `
        INSERT INTO bookings (
          idempotency_key,
          customer_id,
          category_id,
          audio_url,
          audio_duration_seconds,
          text_description,
          area_locality,
          landmark,
          status,
          visiting_fee,
          payment_method,
          payment_collected,
          is_test
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'SERVICE_REQUESTED', $9, 'CASH', false, $10
        ) RETURNING *;
      `;

      const insertValues = [
        idempotencyKey,
        customerId,
        categoryId,
        finalAudioUrl,
        audioDurationSeconds || null,
        trimmedText || null,
        trimmedLocality,
        trimmedLandmark,
        visitingFee,
        isTest,
      ];

      const bookingResult = await client.query<DbBookingRow>(insertQuery, insertValues);
      const newBooking = bookingResult.rows[0];

      // Audit status log entry
      const logQuery = `
        INSERT INTO booking_status_logs (
          booking_id,
          from_status,
          to_status,
          changed_by,
          notes
        ) VALUES ($1, NULL, 'SERVICE_REQUESTED', $2, 'Initial customer booking request');
      `;
      await client.query(logQuery, [newBooking.id, customerId]);

      await client.query('COMMIT');

      const response: ApiResponse<Booking> = {
        success: true,
        data: mapBookingRow(newBooking),
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      await client.query('ROLLBACK');

      // Check for unique violation race condition (PostgreSQL code 23505)
      if (err.code === '23505' && err.constraint === 'bookings_idempotency_key_key') {
        const raceCheck = await pool.query<DbBookingRow>(
          'SELECT * FROM bookings WHERE idempotency_key = $1',
          [idempotencyKey]
        );
        if (raceCheck.rows.length > 0 && raceCheck.rows[0].customer_id === customerId) {
          if (savedAudioFilename) {
            await audioService.deleteAudioFile(savedAudioFilename);
          }
          const response: ApiResponse<Booking> = {
            success: true,
            data: mapBookingRow(raceCheck.rows[0]),
          };
          return reply.status(200).send(response);
        }
      }

      // Cleanup saved audio file on failure
      if (savedAudioFilename) {
        await audioService.deleteAudioFile(savedAudioFilename);
      }

      request.log.error(err, 'Failed to create booking in database transaction');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_CREATION_FAILED',
          messageEn: 'Unable to register booking request. Please retry.',
          messageHi: 'बुकिंग अनुरोध दर्ज करने में असमर्थ। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });

  /**
   * GET /api/bookings/:id
   * Retrieves a specific booking by ID.
   * RBAC: Customer (ownership enforced) or Admin.
   */
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, requireRole(['customer', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;

    // Validate UUID format safely
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Booking not found.',
          messageHi: 'बुकिंग नहीं मिली।',
        },
      });
    }

    const pool = db.getPool();
    if (!pool) {
      return reply.status(500).send({
        success: false,
        error: { code: 'DATABASE_UNAVAILABLE', messageEn: 'Database unavailable.', messageHi: 'डेटाबेस अनुपलब्ध है।' },
      });
    }

    const result = await pool.query<DbBookingRow>('SELECT * FROM bookings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Booking not found.',
          messageHi: 'बुकिंग नहीं मिली।',
        },
      });
    }

    const booking = result.rows[0];

    // Enforce customer ownership
    if (request.user.role === 'customer' && booking.customer_id !== request.user.id) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          messageEn: 'Access denied to this booking.',
          messageHi: 'इस बुकिंग तक पहुँच अस्वीकृत है।',
        },
      });
    }

    // Fetch actual server status logs for progression timeline
    const logsResult = await pool.query<{
      id: string | number;
      booking_id: string;
      from_status: BookingStatus | null;
      to_status: BookingStatus;
      changed_by: string | null;
      notes: string | null;
      created_at: Date;
    }>(
      'SELECT id, booking_id, from_status, to_status, changed_by, notes, created_at FROM booking_status_logs WHERE booking_id = $1 ORDER BY created_at ASC, id ASC',
      [id]
    );

    // Fetch assigned provider info ONLY when assigned by server
    let assignedProvider: { name: string } | null = null;
    if (booking.provider_id) {
      const provResult = await pool.query<{ full_name: string | null }>(
        'SELECT full_name FROM users WHERE id = $1',
        [booking.provider_id]
      );
      if (provResult.rows.length > 0) {
        assignedProvider = {
          name: provResult.rows[0].full_name || 'Technician',
        };
      }
    }

    const mappedBooking = mapBookingRow(booking);
    const detailData: BookingDetail = {
      ...mappedBooking,
      statusLogs: logsResult.rows.map((r) => ({
        id: String(r.id),
        bookingId: r.booking_id,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        changedBy: r.changed_by,
        notes: r.notes,
        createdAt: r.created_at.toISOString(),
      })),
      provider: assignedProvider,
    };

    return reply.send({
      success: true,
      data: detailData,
    });
  });

  /**
   * GET /api/bookings
   * Lists recent bookings for the authenticated customer.
   */
  app.get('/', {
    preHandler: [authenticate, requireRole(['customer'])],
  }, async (request, reply) => {
    const pool = db.getPool();
    if (!pool) {
      return reply.status(500).send({
        success: false,
        error: { code: 'DATABASE_UNAVAILABLE', messageEn: 'Database unavailable.', messageHi: 'डेटाबेस अनुपलब्ध है।' },
      });
    }

    const result = await pool.query<DbBookingRow>(
      'SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
      [request.user.id]
    );

    return reply.send({
      success: true,
      data: result.rows.map(mapBookingRow),
    });
  });

  /**
   * POST /api/bookings/:id/cancel
   * Cancels an active customer booking.
   * RBAC: Strictly restricted to 'customer' role.
   * State Machine: Transitions SERVICE_REQUESTED, PROVIDER_ASSIGNED, or PROVIDER_ACCEPTED
   *                strictly to CANCELLED_BY_CUSTOMER via canTransition().
   * Invariants:
   *   - Preserves provider_id (historical attribution maintained).
   *   - Preserves accepted_at, started_at, completed_at timestamps.
   *   - Preserves visiting_fee, final_amount, payment_method, payment_collected.
   *   - Atomically records status log in booking_status_logs.
   * Concurrency: Uses row-level lock (FOR UPDATE) inside transaction.
   */
  app.post<{
    Params: { id: string };
    Body?: { reason?: string };
  }>('/:id/cancel', {
    preHandler: [authenticate, requireRole(['customer'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const customerId = request.user.id;

    // 1. Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_ID',
          messageEn: 'Invalid booking ID format.',
          messageHi: 'अमान्य बुकिंग आईडी प्रारूप।',
        },
      };
      return reply.status(400).send(response);
    }

    // 2. Validate optional cancellation reason
    let trimmedReason: string | null = null;
    if (request.body && request.body.reason !== undefined) {
      const rawReason = request.body.reason;
      if (typeof rawReason !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: 'Cancellation reason must be a string.',
            messageHi: 'रद्दीकरण का कारण टेक्स्ट होना चाहिए।',
          },
        };
        return reply.status(400).send(response);
      }

      trimmedReason = rawReason.trim();

      if (trimmedReason.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: 'Cancellation reason cannot be empty.',
            messageHi: 'रद्दीकरण का कारण खाली नहीं हो सकता।',
          },
        };
        return reply.status(400).send(response);
      }

      if (trimmedReason.length > 255) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: 'Cancellation reason must not exceed 255 characters.',
            messageHi: 'रद्दीकरण का कारण 255 अक्षरों से अधिक नहीं होना चाहिए।',
          },
        };
        return reply.status(400).send(response);
      }
    }

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 3. Lock booking row for update
      const lockRes = await client.query<DbBookingRow>(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            messageEn: 'Booking not found.',
            messageHi: 'बुकिंग नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      const currentBooking = lockRes.rows[0];

      // 4. Verify ownership
      if (currentBooking.customer_id !== customerId) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'Access denied to this booking.',
            messageHi: 'इस बुकिंग तक पहुँच अस्वीकृत है।',
          },
        };
        return reply.status(403).send(response);
      }

      // 5. Verify valid state transition using canTransition()
      if (!canTransition(currentBooking.status, 'CANCELLED_BY_CUSTOMER', 'customer')) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            messageEn: `Cannot cancel booking in status ${currentBooking.status}.`,
            messageHi: `स्थिति ${currentBooking.status} में बुकिंग रद्द नहीं की जा सकती।`,
          },
        };
        return reply.status(409).send(response);
      }

      // 6. Update booking status to CANCELLED_BY_CUSTOMER
      const updateRes = await client.query<DbBookingRow>(
        `UPDATE bookings
         SET status = 'CANCELLED_BY_CUSTOMER',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      const updatedBooking = updateRes.rows[0];

      // 7. Insert audit log
      const auditNote = trimmedReason || 'Cancelled by customer';
      await client.query(
        `INSERT INTO booking_status_logs (
           booking_id,
           from_status,
           to_status,
           changed_by,
           notes
         ) VALUES ($1, $2, 'CANCELLED_BY_CUSTOMER', $3, $4)`,
        [id, currentBooking.status, customerId, auditNote]
      );

      await client.query('COMMIT');

      const response: ApiResponse<Booking> = {
        success: true,
        data: mapBookingRow(updatedBooking),
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to cancel customer booking in transaction');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          messageEn: 'Failed to cancel booking. Please retry.',
          messageHi: 'बुकिंग रद्द करने में असमर्थ। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });
};
