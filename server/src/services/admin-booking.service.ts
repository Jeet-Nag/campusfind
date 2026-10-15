import { db } from '../db';
import {
  AdminBookingListItem,
  AdminBookingDetail,
  BookingStatus,
  CHANDIL_LOCALITIES,
  canTransition,
  ACTIVE_BOOKING_STATUSES,
} from '@shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALL_BOOKING_STATUSES: BookingStatus[] = [
  'SERVICE_REQUESTED',
  'PROVIDER_ASSIGNED',
  'PROVIDER_ACCEPTED',
  'PROVIDER_ON_THE_WAY',
  'SERVICE_STARTED',
  'SERVICE_COMPLETED',
  'PAYMENT_PENDING',
  'PAYMENT_COLLECTED',
  'BOOKING_COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'REJECTED_BY_PROVIDER',
  'CANCELLED_BY_ADMIN',
];

export class AdminBookingError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'AdminBookingError';
  }
}

export interface AdminBookingListFilter {
  status?: string;
  categoryId?: string;
  providerId?: string;
  areaLocality?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface RawBookingListDbRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  category_id: string;
  category_title_en: string | null;
  category_title_hi: string | null;
  area_locality: string;
  status: BookingStatus;
  visiting_fee: string | number;
  final_amount: string | number | null;
  payment_collected: boolean;
  audio_url: string | null;
  created_at: Date;
}

interface RawBookingDetailDbRow {
  id: string;
  idempotency_key: string;
  status: BookingStatus;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
  area_locality: string;
  landmark: string | null;
  text_description: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  visiting_fee: string | number;
  final_amount: string | number | null;
  payment_method: 'CASH';
  payment_collected: boolean;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string;
  customer_preferred_language: 'en' | 'hi';
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  provider_service_area: string | null;
  provider_rating: string | number | null;
  category_id: string;
  category_title_en: string | null;
  category_title_hi: string | null;
}

interface RawStatusLogDbRow {
  id: string | number;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_by_role: 'customer' | 'provider' | 'admin' | null;
  notes: string | null;
  created_at: Date;
}

export class AdminBookingService {
  private validateUuid(id: string, paramName = 'ID'): void {
    if (!id || !UUID_REGEX.test(id)) {
      throw new AdminBookingError(
        'INVALID_ID',
        `Invalid ${paramName} format. Must be a valid UUID.`,
        `अमान्य ${paramName} प्रारूप। एक वैध UUID होना चाहिए।`,
        400
      );
    }
  }

  /**
   * List bookings with search, filters, and pagination.
   * Deterministic ordering: created_at DESC, id DESC.
   */
  public async listBookings(filters?: AdminBookingListFilter): Promise<{
    bookings: AdminBookingListItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const pool = db.getPool();
    if (!pool) {
      throw new AdminBookingError(
        'DATABASE_UNAVAILABLE',
        'Database connection is unavailable.',
        'डेटाबेस कनेक्शन अनुपलब्ध है।',
        500
      );
    }

    // 1. Validate limit
    let limit = 25;
    if (filters?.limit !== undefined) {
      const parsedLimit = Number(filters.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new AdminBookingError(
          'VALIDATION_ERROR',
          'Limit must be an integer between 1 and 100.',
          'सीमा 1 और 100 के बीच एक पूर्णांक होनी चाहिए।',
          400
        );
      }
      limit = parsedLimit;
    }

    // 2. Validate offset
    let offset = 0;
    if (filters?.offset !== undefined) {
      const parsedOffset = Number(filters.offset);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        throw new AdminBookingError(
          'VALIDATION_ERROR',
          'Offset must be a non-negative integer.',
          'ऑफसेट एक गैर-ऋणात्मक पूर्णांक होना चाहिए।',
          400
        );
      }
      offset = parsedOffset;
    }

    // 3. Validate status filter
    if (filters?.status) {
      const trimmedStatus = filters.status.trim() as BookingStatus;
      if (!ALL_BOOKING_STATUSES.includes(trimmedStatus)) {
        throw new AdminBookingError(
          'VALIDATION_ERROR',
          `Invalid booking status filter: ${filters.status}`,
          'अमान्य बुकिंग स्थिति फ़िल्टर।',
          400
        );
      }
    }

    // 4. Validate providerId filter
    if (filters?.providerId) {
      const trimmedProviderId = filters.providerId.trim();
      if (!UUID_REGEX.test(trimmedProviderId)) {
        throw new AdminBookingError(
          'VALIDATION_ERROR',
          'Invalid provider ID format.',
          'अमान्य मिस्त्री आईडी प्रारूप।',
          400
        );
      }
    }

    // Build dynamic SQL query
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`b.status = $${paramIndex++}`);
      values.push(filters.status.trim());
    }

    if (filters?.categoryId) {
      conditions.push(`b.category_id = $${paramIndex++}`);
      values.push(filters.categoryId.trim());
    }

    if (filters?.providerId) {
      conditions.push(`b.provider_id = $${paramIndex++}`);
      values.push(filters.providerId.trim());
    }

    if (filters?.areaLocality) {
      conditions.push(`b.area_locality = $${paramIndex++}`);
      values.push(filters.areaLocality.trim());
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const rawSearch = filters.search.trim();
      const cleanHexSearch = rawSearch.replace(/^#?CHS-?/i, '').trim();
      const searchPattern = `%${rawSearch}%`;
      const cleanPattern = `%${cleanHexSearch}%`;

      conditions.push(
        `(b.id::text ILIKE $${paramIndex} OR b.id::text ILIKE $${paramIndex + 1} OR cu.phone ILIKE $${paramIndex} OR cu.full_name ILIKE $${paramIndex} OR pu.full_name ILIKE $${paramIndex})`
      );
      values.push(searchPattern, cleanPattern);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM bookings b
      JOIN users cu ON b.customer_id = cu.id
      LEFT JOIN users pu ON b.provider_id = pu.id
      LEFT JOIN service_categories sc ON b.category_id = sc.id
      ${whereClause}
    `;

    const countRes = await pool.query<{ total: string | number }>(countSql, values);
    const total = parseInt(String(countRes.rows[0]?.total || 0), 10);

    // Data query with deterministic ordering and pagination
    const dataSql = `
      SELECT 
        b.id,
        b.customer_id,
        cu.full_name AS customer_name,
        cu.phone AS customer_phone,
        b.provider_id,
        pu.full_name AS provider_name,
        pu.phone AS provider_phone,
        b.category_id,
        sc.title_en AS category_title_en,
        sc.title_hi AS category_title_hi,
        b.area_locality,
        b.status,
        b.visiting_fee,
        b.final_amount,
        b.payment_collected,
        b.audio_url,
        b.created_at
      FROM bookings b
      JOIN users cu ON b.customer_id = cu.id
      LEFT JOIN users pu ON b.provider_id = pu.id
      LEFT JOIN service_categories sc ON b.category_id = sc.id
      ${whereClause}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataValues = [...values, limit, offset];
    const { rows } = await pool.query<RawBookingListDbRow>(dataSql, dataValues);

    const bookings: AdminBookingListItem[] = rows.map((row) => {
      const localityObj = CHANDIL_LOCALITIES.find(
        (l) => l.id === row.area_locality || l.nameEn.toLowerCase() === row.area_locality.toLowerCase()
      );
      const localityNameEn = localityObj ? localityObj.nameEn : row.area_locality;
      const localityNameHi = localityObj ? localityObj.nameHi : row.area_locality;

      return {
        id: row.id,
        shortId: `#CHS-${row.id.substring(0, 8).toUpperCase()}`,
        customerId: row.customer_id,
        customerName: row.customer_name || null,
        customerPhone: row.customer_phone,
        providerId: row.provider_id || null,
        providerName: row.provider_name || null,
        providerPhone: row.provider_phone || null,
        categoryId: row.category_id,
        categoryTitleEn: row.category_title_en || row.category_id,
        categoryTitleHi: row.category_title_hi || row.category_id,
        areaLocality: row.area_locality,
        localityNameEn,
        localityNameHi,
        status: row.status,
        visitingFee: parseFloat(String(row.visiting_fee)),
        finalAmount:
          row.final_amount !== null && row.final_amount !== undefined
            ? parseFloat(String(row.final_amount))
            : null,
        paymentCollected: Boolean(row.payment_collected),
        hasAudio: Boolean(row.audio_url && row.audio_url.trim().length > 0),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };
    });

    return {
      bookings,
      total,
      limit,
      offset,
    };
  }

  /**
   * Retrieves full operational detail for a single booking including customer,
   * provider, category, and chronological status logs timeline.
   */
  public async getBookingById(id: string): Promise<AdminBookingDetail> {
    this.validateUuid(id, 'booking ID');

    const pool = db.getPool();
    if (!pool) {
      throw new AdminBookingError(
        'DATABASE_UNAVAILABLE',
        'Database connection is unavailable.',
        'डेटाबेस कनेक्शन अनुपलब्ध है।',
        500
      );
    }

    const bookingSql = `
      SELECT 
        b.id,
        b.idempotency_key,
        b.status,
        b.created_at,
        b.accepted_at,
        b.started_at,
        b.completed_at,
        b.updated_at,
        b.area_locality,
        b.landmark,
        b.text_description,
        b.audio_url,
        b.audio_duration_seconds,
        b.visiting_fee,
        b.final_amount,
        b.payment_method,
        b.payment_collected,
        b.customer_id,
        cu.full_name AS customer_name,
        cu.phone AS customer_phone,
        cu.preferred_language AS customer_preferred_language,
        b.provider_id,
        pu.full_name AS provider_name,
        pu.phone AS provider_phone,
        pp.service_area AS provider_service_area,
        pp.rating AS provider_rating,
        b.category_id,
        sc.title_en AS category_title_en,
        sc.title_hi AS category_title_hi
      FROM bookings b
      JOIN users cu ON b.customer_id = cu.id
      LEFT JOIN users pu ON b.provider_id = pu.id
      LEFT JOIN provider_profiles pp ON b.provider_id = pp.user_id
      LEFT JOIN service_categories sc ON b.category_id = sc.id
      WHERE b.id = $1
    `;

    const { rows } = await pool.query<RawBookingDetailDbRow>(bookingSql, [id]);

    if (rows.length === 0) {
      throw new AdminBookingError(
        'BOOKING_NOT_FOUND',
        'Booking not found.',
        'बुकिंग नहीं मिली।',
        404
      );
    }

    const row = rows[0];

    // Fetch chronological status logs timeline
    const logsSql = `
      SELECT 
        l.id,
        l.from_status,
        l.to_status,
        l.changed_by,
        u.full_name AS changed_by_name,
        u.role AS changed_by_role,
        l.notes,
        l.created_at
      FROM booking_status_logs l
      LEFT JOIN users u ON l.changed_by = u.id
      WHERE l.booking_id = $1
      ORDER BY l.created_at ASC, l.id ASC
    `;

    const logsRes = await pool.query<RawStatusLogDbRow>(logsSql, [id]);

    return {
      booking: {
        id: row.id,
        idempotencyKey: row.idempotency_key,
        status: row.status,
        timestamps: {
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
          acceptedAt: row.accepted_at
            ? row.accepted_at instanceof Date
              ? row.accepted_at.toISOString()
              : String(row.accepted_at)
            : null,
          startedAt: row.started_at
            ? row.started_at instanceof Date
              ? row.started_at.toISOString()
              : String(row.started_at)
            : null,
          completedAt: row.completed_at
            ? row.completed_at instanceof Date
              ? row.completed_at.toISOString()
              : String(row.completed_at)
            : null,
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        },
        areaLocality: row.area_locality,
        landmark: row.landmark,
        textDescription: row.text_description,
        audioUrl: row.audio_url,
        audioDurationSeconds: row.audio_duration_seconds,
        visitingFee: parseFloat(String(row.visiting_fee)),
        finalAmount:
          row.final_amount !== null && row.final_amount !== undefined
            ? parseFloat(String(row.final_amount))
            : null,
        paymentMethod: row.payment_method,
        paymentCollected: Boolean(row.payment_collected),
      },
      customer: {
        id: row.customer_id,
        fullName: row.customer_name || null,
        phone: row.customer_phone,
        preferredLanguage: row.customer_preferred_language,
      },
      provider: row.provider_id
        ? {
            id: row.provider_id,
            fullName: row.provider_name || null,
            phone: row.provider_phone || '',
            serviceArea: row.provider_service_area || 'Chandil',
            rating:
              row.provider_rating !== null && row.provider_rating !== undefined
                ? parseFloat(String(row.provider_rating))
                : 5.0,
          }
        : null,
      category: {
        id: row.category_id,
        titleEn: row.category_title_en || row.category_id,
        titleHi: row.category_title_hi || row.category_id,
      },
      timeline: logsRes.rows.map((log) => ({
        id: String(log.id),
        fromStatus: log.from_status,
        toStatus: log.to_status,
        changedBy: log.changed_by
          ? {
              id: log.changed_by,
              name: log.changed_by_name || null,
              role: log.changed_by_role || 'admin',
            }
          : null,
        notes: log.notes,
        createdAt: log.created_at instanceof Date ? log.created_at.toISOString() : String(log.created_at),
      })),
    };
  }

  /**
   * Administratively cancel an active booking with mandatory reason note.
   * Atomic transaction: row-level lock (FOR UPDATE), canonical state machine validation,
   * booking status update, and audit log creation in a single transaction.
   */
  public async cancelBooking(id: string, reason: string, adminId: string): Promise<AdminBookingDetail> {
    this.validateUuid(id, 'booking ID');

    if (typeof reason !== 'string') {
      throw new AdminBookingError(
        'VALIDATION_ERROR',
        'Cancellation reason is required.',
        'रद्दीकरण का कारण आवश्यक है।',
        400
      );
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      throw new AdminBookingError(
        'VALIDATION_ERROR',
        'Cancellation reason must be at least 3 characters.',
        'रद्दीकरण का कारण कम से कम 3 अक्षर होना चाहिए।',
        400
      );
    }

    if (trimmedReason.length > 255) {
      throw new AdminBookingError(
        'VALIDATION_ERROR',
        'Cancellation reason must not exceed 255 characters.',
        'रद्दीकरण का कारण 255 अक्षरों से अधिक नहीं होना चाहिए।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new AdminBookingError(
        'DATABASE_UNAVAILABLE',
        'Database connection is unavailable.',
        'डेटाबेस कनेक्शन अनुपलब्ध है।',
        500
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock the booking row for update to prevent concurrent race conditions
      const lockRes = await client.query<{
        id: string;
        status: BookingStatus;
        visiting_fee: string | number;
        final_amount: string | number | null;
        payment_method: string;
        payment_collected: boolean;
      }>(
        'SELECT id, status, visiting_fee, final_amount, payment_method, payment_collected FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'BOOKING_NOT_FOUND',
          'Booking not found.',
          'बुकिंग नहीं मिली।',
          404
        );
      }

      const currentBooking = lockRes.rows[0];

      // 2. Validate state transition using canonical booking state machine
      if (!canTransition(currentBooking.status, 'CANCELLED_BY_ADMIN', 'admin')) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'INVALID_STATUS_TRANSITION',
          `Cannot cancel booking in status ${currentBooking.status}.`,
          `स्थिति ${currentBooking.status} में बुकिंग रद्द नहीं की जा सकती।`,
          409
        );
      }

      // 3. Update status to CANCELLED_BY_ADMIN (financial fields left untouched)
      await client.query(
        `UPDATE bookings
         SET status = 'CANCELLED_BY_ADMIN',
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      // 4. Record audit status log in the same database transaction
      await client.query(
        `INSERT INTO booking_status_logs (
           booking_id,
           from_status,
           to_status,
           changed_by,
           notes
         ) VALUES ($1, $2, 'CANCELLED_BY_ADMIN', $3, $4)`,
        [id, currentBooking.status, adminId, trimmedReason]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Return the updated full detail
    return this.getBookingById(id);
  }

  /**
   * Administratively assign an eligible provider to a requested booking.
   * Two-step dispatch model: transitions strictly SERVICE_REQUESTED -> PROVIDER_ASSIGNED.
   * Enforces:
   * 1. Row-level booking lock (FOR UPDATE)
   * 2. Booking exists and is in status SERVICE_REQUESTED with provider_id IS NULL
   * 3. Canonical state machine validation canTransition('SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', 'admin')
   * 4. Provider exists, is active (users.is_active = true), role = 'provider'
   * 5. Provider profile exists, is available (provider_profiles.is_available = true)
   * 6. Provider category matches booking category (category_id match)
   * 7. Provider has NO active in-progress bookings (PROVIDER_ACCEPTED, PROVIDER_ON_THE_WAY, SERVICE_STARTED, PAYMENT_PENDING)
   * 8. Atomic update: provider_id set, status set to PROVIDER_ASSIGNED (no timestamps or financial fields altered)
   * 9. Audit log entry in booking_status_logs recording admin actor and server-resolved provider identity
   */
  public async assignProvider(id: string, providerId: string, adminId: string): Promise<AdminBookingDetail> {
    this.validateUuid(id, 'booking ID');
    this.validateUuid(providerId, 'provider ID');

    const pool = db.getPool();
    if (!pool) {
      throw new AdminBookingError(
        'DATABASE_UNAVAILABLE',
        'Database connection is unavailable.',
        'डेटाबेस कनेक्शन अनुपलब्ध है।',
        500
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock the booking row for update to prevent concurrent race conditions
      const lockRes = await client.query<{
        id: string;
        customer_id: string;
        category_id: string;
        provider_id: string | null;
        status: BookingStatus;
      }>(
        'SELECT id, customer_id, category_id, provider_id, status FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'BOOKING_NOT_FOUND',
          'Booking not found.',
          'बुकिंग नहीं मिली।',
          404
        );
      }

      const currentBooking = lockRes.rows[0];

      // 2. Check if booking is already assigned or already has a provider
      if (currentBooking.status === 'PROVIDER_ASSIGNED' || currentBooking.provider_id !== null) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'BOOKING_ALREADY_ASSIGNED',
          'Booking is already assigned to a provider.',
          'बुकिंग पहले से ही किसी मिस्त्री को सौंपी गई है।',
          409
        );
      }

      // 3. Validate state transition using canonical booking state machine
      if (currentBooking.status !== 'SERVICE_REQUESTED' || !canTransition(currentBooking.status, 'PROVIDER_ASSIGNED', 'admin')) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'INVALID_STATUS_TRANSITION',
          `Cannot assign booking in status ${currentBooking.status}.`,
          `स्थिति ${currentBooking.status} में बुकिंग को मिस्त्री नहीं सौंपा जा सकता।`,
          409
        );
      }

      // 4. Lock and verify target provider account in users table
      const userRes = await client.query<{
        id: string;
        phone: string;
        full_name: string | null;
        role: string;
        is_active: boolean;
      }>(
        'SELECT id, phone, full_name, role, is_active FROM users WHERE id = $1 FOR UPDATE',
        [providerId]
      );

      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'PROVIDER_NOT_FOUND',
          'Provider not found.',
          'मिस्त्री नहीं मिला।',
          404
        );
      }

      const providerUser = userRes.rows[0];

      if (providerUser.role !== 'provider') {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'INVALID_PROVIDER_ROLE',
          'Target user is not a service provider.',
          'लक्षित उपयोगकर्ता सेवा प्रदाता नहीं है।',
          400
        );
      }

      if (!providerUser.is_active) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'PROVIDER_INACTIVE',
          'Cannot assign inactive provider.',
          'निष्क्रिय मिस्त्री को काम नहीं सौंपा जा सकता।',
          400
        );
      }

      // 5. Verify provider profile exists, is verified, and is available
      const profileRes = await client.query<{
        category_id: string;
        service_area: string;
        is_available: boolean;
        verification_status: string;
      }>(
        'SELECT category_id, service_area, is_available, verification_status FROM provider_profiles WHERE user_id = $1 FOR UPDATE',
        [providerId]
      );

      if (profileRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'PROVIDER_PROFILE_MISSING',
          'Provider profile is missing.',
          'मिस्त्री प्रोफ़ाइल गायब है।',
          400
        );
      }

      const profile = profileRes.rows[0];

      if (profile.verification_status !== 'VERIFIED') {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'PROVIDER_NOT_VERIFIED',
          'Cannot assign provider whose verification is not approved.',
          'उस मिस्त्री को काम नहीं सौंपा जा सकता जिसका सत्यापन स्वीकृत नहीं है।',
          400
        );
      }

      if (!profile.is_available) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'PROVIDER_UNAVAILABLE',
          'Provider is currently marked unavailable.',
          'मिस्त्री वर्तमान में अनुपलब्ध है।',
          400
        );
      }

      if (profile.category_id !== currentBooking.category_id) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'CATEGORY_MISMATCH',
          'Provider category does not match booking category.',
          'मिस्त्री की श्रेणी बुकिंग श्रेणी से मेल नहीं खाती।',
          400
        );
      }

      // 6. Verify provider does NOT already have an active operational booking
      const activeBookingsRes = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM bookings
         WHERE provider_id = $1
           AND status IN ('PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COLLECTED')
         LIMIT 1`,
        [providerId]
      );

      if (activeBookingsRes.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new AdminBookingError(
          'ACTIVE_BOOKING_EXISTS',
          'Cannot assign provider with an active booking in progress.',
          'प्रगति पर बुकिंग वाले मिस्त्री को नया काम नहीं सौंपा जा सकता।',
          409
        );
      }

      // 7. Update booking: assign provider and advance status to PROVIDER_ASSIGNED
      await client.query(
        `UPDATE bookings
         SET provider_id = $1,
             status = 'PROVIDER_ASSIGNED',
             updated_at = NOW()
         WHERE id = $2`,
        [providerId, id]
      );

      // 8. Record audit status log in the same database transaction
      const providerDisplayName = providerUser.full_name || 'Technician';
      const auditNote = `Assigned to provider ${providerDisplayName} (${providerUser.phone})`;

      await client.query(
        `INSERT INTO booking_status_logs (
           booking_id,
           from_status,
           to_status,
           changed_by,
           notes
         ) VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', $2, $3)`,
        [id, adminId, auditNote]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Return the updated full detail
    return this.getBookingById(id);
  }
}
