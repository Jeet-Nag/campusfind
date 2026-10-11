import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse, ProviderJob, BookingStatus } from '@shared';

interface DbProviderJobRow {
  id: string;
  category_id: string;
  area_locality: string;
  landmark: string | null;
  text_description: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  visiting_fee: string | number;
  status: BookingStatus;
  created_at: Date;
}

function mapProviderJobRow(row: DbProviderJobRow): ProviderJob {
  return {
    id: row.id,
    categoryId: row.category_id,
    areaLocality: row.area_locality,
    landmark: row.landmark,
    textDescription: row.text_description,
    audioUrl: row.audio_url,
    audioDurationSeconds: row.audio_duration_seconds,
    visitingFee: parseFloat(String(row.visiting_fee)),
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export const providerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/provider/jobs
   * Returns list of currently available jobs for authenticated providers.
   * RBAC: Strictly restricted to 'provider' role.
   * Filter: status = 'SERVICE_REQUESTED' AND provider_id IS NULL.
   * Order: Newest requests first (created_at DESC).
   * Privacy: Zero customer phone, account, or private audit data exposed.
   * Mutability: Strictly read-only.
   */
  app.get('/jobs', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const { rows } = await pool.query<DbProviderJobRow>(
      `SELECT id, category_id, area_locality, landmark, text_description, 
              audio_url, audio_duration_seconds, visiting_fee, status, created_at
       FROM bookings 
       WHERE (status = 'SERVICE_REQUESTED' AND provider_id IS NULL)
          OR (status = 'PROVIDER_ASSIGNED' AND provider_id = $1)
       ORDER BY CASE WHEN status = 'PROVIDER_ASSIGNED' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 50`,
      [request.user.id]
    );

    const jobs: ProviderJob[] = rows.map(mapProviderJobRow);

    const response: ApiResponse<ProviderJob[]> = {
      success: true,
      data: jobs,
    };
    return reply.status(200).send(response);
  });

  /**
   * GET /api/provider/jobs/:id
   * Retrieves specific permitted job details for the authenticated provider.
   * RBAC: Strictly restricted to 'provider' role.
   * Access: Open broadcast jobs or jobs assigned to/claimed by the authenticated provider.
   * Privacy: Returns only necessary job details, omitting customer PII.
   */
  app.get<{ Params: { id: string } }>('/jobs/:id', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const { id } = request.params;

    // Validate UUID format safely
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const { rows } = await pool.query<DbProviderJobRow & { provider_id: string | null }>(
      `SELECT id, category_id, area_locality, landmark, text_description, 
              audio_url, audio_duration_seconds, visiting_fee, status, created_at,
              provider_id
       FROM bookings 
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const row = rows[0];
    const isOpen = row.status === 'SERVICE_REQUESTED' && row.provider_id === null;
    const isOwner = row.provider_id === request.user.id;

    if (!isOpen && !isOwner) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const job: ProviderJob = mapProviderJobRow(row);

    const response: ApiResponse<ProviderJob> = {
      success: true,
      data: job,
    };
    return reply.status(200).send(response);
  });

  /**
   * POST /api/provider/jobs/:id/accept
   * Atomically claims an available SERVICE_REQUESTED job for the authenticated provider.
   * RBAC: Strictly restricted to 'provider' role.
   * Concurrency: Atomic conditional update with transaction-bound status log.
   * Concurrency safety: Zero race conditions. Returns 409 JOB_ALREADY_CLAIMED if already taken.
   * Idempotency: Safe re-acceptance by the same provider returns 200 without duplicate transitions.
   */
  app.post<{ Params: { id: string } }>('/jobs/:id/accept', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const { id } = request.params;

    // 1. Validate UUID format safely
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query<{ id: string; provider_id: string | null; status: BookingStatus }>(
        'SELECT id, provider_id, status FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            messageEn: 'Job not found.',
            messageHi: 'काम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      // 2. Lock and re-validate authenticated provider account to prevent concurrent demotion/deactivation races
      const userRes = await client.query<{ id: string; role: string; is_active: boolean }>(
        'SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE',
        [request.user.id]
      );

      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'provider' || !userRes.rows[0].is_active) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'Provider account is inactive or not authorized to accept jobs.',
            messageHi: 'मिस्त्री खाता निष्क्रिय है या काम स्वीकार करने के लिए अधिकृत नहीं है।',
          },
        };
        return reply.status(403).send(response);
      }

      const existing = checkRes.rows[0];

      // 4. Repeated acceptance by the SAME provider (Idempotency guarantee)
      if (existing.provider_id === request.user.id && existing.status === 'PROVIDER_ACCEPTED') {
        await client.query('ROLLBACK');
        const currentJobRes = await pool.query<DbProviderJobRow>(
          `SELECT id, category_id, area_locality, landmark, text_description, 
                  audio_url, audio_duration_seconds, visiting_fee, status, created_at
           FROM bookings 
           WHERE id = $1`,
          [id]
        );
        const response: ApiResponse<ProviderJob> = {
          success: true,
          data: mapProviderJobRow(currentJobRes.rows[0]),
        };
        return reply.status(200).send(response);
      }

      let fromStatus: BookingStatus | null = null;
      let auditNote = '';

      if (existing.status === 'SERVICE_REQUESTED' && existing.provider_id === null) {
        fromStatus = 'SERVICE_REQUESTED';
        auditNote = 'Technician accepted job';
      } else if (existing.status === 'PROVIDER_ASSIGNED' && existing.provider_id === request.user.id) {
        fromStatus = 'PROVIDER_ASSIGNED';
        auditNote = 'Technician accepted assigned job';
      }

      if (!fromStatus) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_ALREADY_CLAIMED',
            messageEn: 'This job has already been claimed by another technician or is no longer available.',
            messageHi: 'यह काम किसी अन्य मिस्त्री द्वारा पहले ही स्वीकार कर लिया गया है या अब उपलब्ध नहीं है।',
          },
        };
        return reply.status(409).send(response);
      }

      // 2. Atomic claim / accept
      const updateRes = await client.query<DbProviderJobRow>(
        `UPDATE bookings
         SET provider_id = $1,
             status = 'PROVIDER_ACCEPTED',
             accepted_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, category_id, area_locality, landmark, text_description,
                   audio_url, audio_duration_seconds, visiting_fee, status, created_at`,
        [request.user.id, id]
      );

      // 3. Atomically record the status log entry
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, 'PROVIDER_ACCEPTED', $3, $4)`,
        [id, fromStatus, request.user.id, auditNote]
      );

      await client.query('COMMIT');

      const response: ApiResponse<ProviderJob> = {
        success: true,
        data: mapProviderJobRow(updateRes.rows[0]),
      };
      return reply.status(200).send(response);
    } catch (err) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to accept job atomically');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_ACCEPT_FAILED',
          messageEn: 'Failed to accept job. Please try again.',
          messageHi: 'काम स्वीकार करने में विफल। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/provider/jobs/:id/reject
   * Relinquishes a previously accepted job by the authenticated provider.
   * RBAC: Strictly restricted to 'provider' role.
   * Canonical semantics:
   * 1. Only the provider who claimed the booking in PROVIDER_ACCEPTED can relinquish it.
   * 2. Open SERVICE_REQUESTED broadcast jobs cannot be rejected (409 Conflict).
   * 3. Wrong provider cannot relinquish someone else's job (409 Conflict).
   * 4. Downstream states (e.g. PROVIDER_ON_THE_WAY, etc.) cannot be relinquished (409 Conflict).
   * 5. Atomically:
   *    - Verify status = 'PROVIDER_ACCEPTED' AND provider_id = authenticated provider.
   *    - Insert audit log: from_status = 'PROVIDER_ACCEPTED', to_status = 'REJECTED_BY_PROVIDER', changed_by = provider.
   *    - Update booking: status = 'SERVICE_REQUESTED', provider_id = NULL, accepted_at = NULL, updated_at = NOW().
   *    - If any step fails: ROLLBACK.
   * 6. Re-queued booking immediately reappears in GET /api/provider/jobs.
   * 7. Repeated rejection by the same provider returns 409 Conflict (no longer assigned, no duplicate logs).
   */
  app.post<{ Params: { id: string } }>('/jobs/:id/reject', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const { id } = request.params;

    // 1. Validate UUID format safely
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query<{ id: string; provider_id: string | null; status: BookingStatus }>(
        'SELECT id, provider_id, status FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            messageEn: 'Job not found.',
            messageHi: 'काम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const existing = checkRes.rows[0];

      // Safe conflict responses based on existing state
      if (existing.status === 'SERVICE_REQUESTED' && existing.provider_id === null) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NO_LONGER_ASSIGNED',
            messageEn: 'This job is an open broadcast request and cannot be rejected without claiming it first.',
            messageHi: 'यह एक खुला अनुरोध है और इसे पहले स्वीकार किए बिना छोड़ा नहीं जा सकता।',
          },
        };
        return reply.status(409).send(response);
      }

      if (existing.provider_id !== request.user.id) {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NO_LONGER_ASSIGNED',
            messageEn: 'This job is not assigned to you.',
            messageHi: 'यह काम आपको सौंपा नहीं गया है।',
          },
        };
        return reply.status(409).send(response);
      }

      if (existing.status !== 'PROVIDER_ACCEPTED' && existing.status !== 'PROVIDER_ASSIGNED') {
        await client.query('ROLLBACK');
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NO_LONGER_ASSIGNED',
            messageEn: 'This job cannot be relinquished in its current status.',
            messageHi: 'इस स्थिति में यह काम छोड़ा नहीं जा सकता।',
          },
        };
        return reply.status(409).send(response);
      }

      const fromStatus = existing.status;
      const toStatus = fromStatus === 'PROVIDER_ASSIGNED'
        ? 'SERVICE_REQUESTED'
        : 'REJECTED_BY_PROVIDER';
      const auditNote = fromStatus === 'PROVIDER_ASSIGNED'
        ? 'Technician declined assigned job; returned to broadcast'
        : 'Relinquished by technician';

      // 2. Atomic conditional relinquishment
      const updateRes = await client.query<DbProviderJobRow>(
        `UPDATE bookings
         SET status = 'SERVICE_REQUESTED',
             provider_id = NULL,
             accepted_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, category_id, area_locality, landmark, text_description,
                   audio_url, audio_duration_seconds, visiting_fee, status, created_at`,
        [id]
      );

      // 3. Atomically record the audit log entry
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, fromStatus, toStatus, request.user.id, auditNote]
      );

      await client.query('COMMIT');

      const response: ApiResponse<ProviderJob> = {
        success: true,
        data: mapProviderJobRow(updateRes.rows[0]),
      };
      return reply.status(200).send(response);
    } catch (err) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to relinquish job atomically');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_REJECT_FAILED',
          messageEn: 'Failed to relinquish job. Please try again.',
          messageHi: 'काम छोड़ने में विफल। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/provider/jobs/:id/status
   * Progresses the operational status of an assigned job by the authenticated provider.
   * RBAC: Strictly restricted to 'provider' role.
   * Allowed operational transitions:
   *   - PROVIDER_ACCEPTED -> PROVIDER_ON_THE_WAY
   *   - PROVIDER_ON_THE_WAY -> SERVICE_STARTED (sets started_at = NOW())
   *   - SERVICE_STARTED -> SERVICE_COMPLETED (sets completed_at = NOW())
   *   - SERVICE_COMPLETED -> PAYMENT_PENDING (Module 11: sets final_amount = visiting_fee)
   *   - PAYMENT_COLLECTED -> BOOKING_COMPLETED (Module 11: terminal completion)
   * Note: PAYMENT_PENDING -> PAYMENT_COLLECTED is handled ONLY via POST /jobs/:id/payment.
   * Atomicity: Conditional SQL update and status log recorded in the same transaction.
   * Rollback: Any status log or database failure rolls back the entire state transition.
   * Concurrency & Idempotency: Stale or repeated status requests yield 409 Conflict with zero duplicate logs.
   */
  app.post<{
    Params: { id: string };
    Body: { status: BookingStatus };
  }>('/jobs/:id/status', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const requestedStatus = request.body?.status;

    // 1. Validate UUID format safely
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    // 2. Validate operational status target
    interface TransitionConfig {
      from: BookingStatus;
      to: BookingStatus;
      timestampCol?: 'started_at' | 'completed_at';
      logNote: string;
      setFinalAmount?: boolean;
    }

    const ALLOWED_OPERATIONAL_TRANSITIONS: Record<string, TransitionConfig> = {
      // Module 10: Operational progression
      PROVIDER_ON_THE_WAY: {
        from: 'PROVIDER_ACCEPTED',
        to: 'PROVIDER_ON_THE_WAY',
        logNote: 'Technician on the way',
      },
      SERVICE_STARTED: {
        from: 'PROVIDER_ON_THE_WAY',
        to: 'SERVICE_STARTED',
        timestampCol: 'started_at',
        logNote: 'Service started by technician',
      },
      SERVICE_COMPLETED: {
        from: 'SERVICE_STARTED',
        to: 'SERVICE_COMPLETED',
        timestampCol: 'completed_at',
        logNote: 'Service completed by technician',
      },
      // Module 11: Provider initiates payment pending after service is complete
      PAYMENT_PENDING: {
        from: 'SERVICE_COMPLETED',
        to: 'PAYMENT_PENDING',
        logNote: 'Service completed, cash payment pending',
        setFinalAmount: true,
      },
      // Module 11: Final completion after cash has been collected via /payment endpoint
      BOOKING_COMPLETED: {
        from: 'PAYMENT_COLLECTED',
        to: 'BOOKING_COMPLETED',
        logNote: 'Booking completed',
      },
    };

    const targetConfig = requestedStatus ? ALLOWED_OPERATIONAL_TRANSITIONS[requestedStatus] : null;

    if (!targetConfig) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          messageEn: 'Invalid operational status requested.',
          messageHi: 'अमान्य परिचालन स्थिति अनुरोधित।',
        },
      };
      return reply.status(400).send(response);
    }

    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 3. Conditional Atomic Update — ownership enforced via provider_id = $3, current status = $4
      let updateQuery: string;
      if (targetConfig.timestampCol === 'started_at') {
        updateQuery = `
          UPDATE bookings
          SET status = $1,
              started_at = NOW(),
              updated_at = NOW()
          WHERE id = $2
            AND provider_id = $3
            AND status = $4
          RETURNING id, category_id, area_locality, landmark, text_description, 
                    audio_url, audio_duration_seconds, visiting_fee, status, created_at
        `;
      } else if (targetConfig.timestampCol === 'completed_at') {
        updateQuery = `
          UPDATE bookings
          SET status = $1,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = $2
            AND provider_id = $3
            AND status = $4
          RETURNING id, category_id, area_locality, landmark, text_description, 
                    audio_url, audio_duration_seconds, visiting_fee, status, created_at
        `;
      } else if (targetConfig.setFinalAmount) {
        // PAYMENT_PENDING: final_amount = visiting_fee set server-side; client cannot override amount
        updateQuery = `
          UPDATE bookings
          SET status = $1,
              final_amount = visiting_fee,
              updated_at = NOW()
          WHERE id = $2
            AND provider_id = $3
            AND status = $4
          RETURNING id, category_id, area_locality, landmark, text_description, 
                    audio_url, audio_duration_seconds, visiting_fee, status, created_at
        `;
      } else {
        updateQuery = `
          UPDATE bookings
          SET status = $1,
              updated_at = NOW()
          WHERE id = $2
            AND provider_id = $3
            AND status = $4
          RETURNING id, category_id, area_locality, landmark, text_description, 
                    audio_url, audio_duration_seconds, visiting_fee, status, created_at
        `;
      }

      const updateRes = await client.query<DbProviderJobRow>(updateQuery, [
        targetConfig.to,
        id,
        request.user.id,
        targetConfig.from,
      ]);

      if (updateRes.rows.length === 1) {
        // 4. Record status log in the same database transaction
        await client.query(
          `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, targetConfig.from, targetConfig.to, request.user.id, targetConfig.logNote]
        );

        await client.query('COMMIT');

        const response: ApiResponse<ProviderJob> = {
          success: true,
          data: mapProviderJobRow(updateRes.rows[0]),
        };
        return reply.status(200).send(response);
      }

      // If 0 rows updated, rollback and inspect state to return exact conflict code
      await client.query('ROLLBACK');

      const checkRes = await pool.query<{ id: string; provider_id: string | null; status: BookingStatus }>(
        'SELECT id, provider_id, status FROM bookings WHERE id = $1',
        [id]
      );

      if (checkRes.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            messageEn: 'Job not found.',
            messageHi: 'काम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const existing = checkRes.rows[0];

      if (existing.provider_id !== request.user.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NO_LONGER_ASSIGNED',
            messageEn: 'This job is not assigned to you.',
            messageHi: 'यह काम आपको सौंपा नहीं गया है।',
          },
        };
        return reply.status(409).send(response);
      }

      // Status mismatch: either already transitioned or invalid skip
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          messageEn: `Cannot transition job from ${existing.status} to ${targetConfig.to}.`,
          messageHi: 'यह स्थिति बदलाव मान्य नहीं है।',
        },
      };
      return reply.status(409).send(response);
    } catch (err) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to update job status atomically');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          messageEn: 'Failed to update job status. Please try again.',
          messageHi: 'काम की स्थिति अपडेट करने में विफल। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/provider/jobs/:id/payment
   * Module 11: Dedicated cash payment collection endpoint.
   * Transitions: PAYMENT_PENDING -> PAYMENT_COLLECTED only.
   * RBAC: Strictly restricted to 'provider' role.
   * Authorization: Provider must own the booking (provider_id = authenticated user).
   * Amount: Server-authoritative. final_amount = visiting_fee read from DB. Client cannot supply amount.
   * Payment method: Must be CASH. Enforced via payment_method = 'CASH' in conditional WHERE clause.
   * Atomicity: Conditional UPDATE + status log INSERT in a single transaction.
   * Duplicate Protection: Repeated call on already-collected booking returns 409. Zero duplicate audit logs.
   * Concurrency: Conditional WHERE status = 'PAYMENT_PENDING' ensures exactly one concurrent winner.
   * Rollback: Status log insert failure rolls back the entire UPDATE.
   */
  app.post<{ Params: { id: string } }>('/jobs/:id/payment', {
    preHandler: [authenticate, requireRole(['provider'])],
  }, async (request, reply) => {
    const { id } = request.params;

    // 1. Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          messageEn: 'Job not found.',
          messageHi: 'काम नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    const pool = db.getPool();
    if (!pool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          messageEn: 'Database pool is unavailable.',
          messageHi: 'डेटाबेस अनुपलब्ध है।',
        },
      };
      return reply.status(500).send(response);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 2. Atomic conditional update:
      //    - provider_id = $2 (provider must own the booking)
      //    - status = 'PAYMENT_PENDING' (only valid origin state)
      //    - payment_method = 'CASH' (enforced; no online payment accepted)
      //    - final_amount = visiting_fee (server reads from DB; client has no input)
      //    - payment_collected = true
      const updateRes = await client.query<DbProviderJobRow>(
        `UPDATE bookings
         SET status = 'PAYMENT_COLLECTED',
             payment_collected = true,
             final_amount = visiting_fee,
             updated_at = NOW()
         WHERE id = $1
           AND provider_id = $2
           AND status = 'PAYMENT_PENDING'
           AND payment_method = 'CASH'
         RETURNING id, category_id, area_locality, landmark, text_description,
                   audio_url, audio_duration_seconds, visiting_fee, status, created_at`,
        [id, request.user.id]
      );

      if (updateRes.rows.length === 1) {
        // 3. Record audit log atomically in the same transaction
        await client.query(
          `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
           VALUES ($1, 'PAYMENT_PENDING', 'PAYMENT_COLLECTED', $2, 'Cash payment collected by technician')`,
          [id, request.user.id]
        );

        await client.query('COMMIT');

        const response: ApiResponse<ProviderJob> = {
          success: true,
          data: mapProviderJobRow(updateRes.rows[0]),
        };
        return reply.status(200).send(response);
      }

      // 0 rows updated — rollback and determine exact failure reason
      await client.query('ROLLBACK');

      const checkRes = await pool.query<{
        id: string;
        provider_id: string | null;
        status: BookingStatus;
        payment_method: string;
      }>(
        'SELECT id, provider_id, status, payment_method FROM bookings WHERE id = $1',
        [id]
      );

      if (checkRes.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            messageEn: 'Job not found.',
            messageHi: 'काम नहीं मिला।',
          },
        };
        return reply.status(404).send(response);
      }

      const existing = checkRes.rows[0];

      if (existing.provider_id !== request.user.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NO_LONGER_ASSIGNED',
            messageEn: 'This job is not assigned to you.',
            messageHi: 'यह काम आपको सौंपा नहीं गया है।',
          },
        };
        return reply.status(409).send(response);
      }

      // Status is not PAYMENT_PENDING (already collected, wrong phase, or non-cash)
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          messageEn: `Cannot collect payment: job is currently in status ${existing.status}.`,
          messageHi: 'भुगतान संग्रह संभव नहीं: बुकिंग वर्तमान स्थिति में नहीं है।',
        },
      };
      return reply.status(409).send(response);
    } catch (err) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to record cash payment collection atomically');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PAYMENT_COLLECT_FAILED',
          messageEn: 'Failed to record cash payment. Please try again.',
          messageHi: 'नकद भुगतान दर्ज करने में विफल। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    } finally {
      client.release();
    }
  });
};

