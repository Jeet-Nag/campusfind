import { db } from '../db';
import { AdminProviderView, WorkerVerificationStatus, ACTIVE_BOOKING_STATUSES } from '@shared';
import { workerService } from './worker.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdminProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'AdminProviderError';
  }
}

export interface ListProvidersFilter {
  categoryId?: string;
  isActive?: boolean;
  verificationStatus?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
}

export interface CreateProviderInput {
  phone: string;
  fullName: string;
  categoryId: string;
  preferredLanguage?: 'en' | 'hi';
  serviceArea?: string;
}

export interface UpdateProviderInput {
  fullName?: string;
  categoryId?: string;
  preferredLanguage?: 'en' | 'hi';
  serviceArea?: string;
}

interface RawProviderDbRow {
  id: string;
  phone: string;
  fullName: string | null;
  role: 'customer' | 'provider' | 'admin';
  preferredLanguage: 'en' | 'hi';
  isActive: boolean;
  categoryId: string;
  categoryTitleEn: string;
  categoryTitleHi: string;
  serviceArea: string;
  isAvailable: boolean;
  rating: number | string;
  verificationStatus: WorkerVerificationStatus;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  createdAt: Date;
  hasAadhaarFront: boolean;
  hasAadhaarBack: boolean;
  hasPhoto: boolean;
  activeBookingsCount?: number | string;
}

function mapRawRow(row: RawProviderDbRow): AdminProviderView {
  return {
    id: row.id,
    phone: row.phone,
    fullName: row.fullName,
    role: row.role as any,
    preferredLanguage: row.preferredLanguage,
    isActive: row.isActive,
    categoryId: row.categoryId,
    categoryTitleEn: row.categoryTitleEn,
    categoryTitleHi: row.categoryTitleHi,
    serviceArea: row.serviceArea,
    isAvailable: row.isAvailable,
    rating: parseFloat(String(row.rating || 5.0)),
    verificationStatus: row.verificationStatus || 'VERIFIED',
    submittedAt: row.submittedAt ? (row.submittedAt instanceof Date ? row.submittedAt.toISOString() : String(row.submittedAt)) : null,
    verifiedAt: row.verifiedAt ? (row.verifiedAt instanceof Date ? row.verifiedAt.toISOString() : String(row.verifiedAt)) : null,
    rejectionReason: row.rejectionReason || null,
    rejectedAt: row.rejectedAt ? (row.rejectedAt instanceof Date ? row.rejectedAt.toISOString() : String(row.rejectedAt)) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    hasAadhaarFront: !!row.hasAadhaarFront,
    hasAadhaarBack: !!row.hasAadhaarBack,
    hasPhoto: !!row.hasPhoto,
    activeBookingsCount: row.activeBookingsCount !== undefined ? parseInt(String(row.activeBookingsCount), 10) : 0,
  };
}

export class AdminProviderService {
  private validateUuid(id: string): void {
    if (!id || !UUID_REGEX.test(id)) {
      throw new AdminProviderError(
        'INVALID_ID',
        'Invalid provider ID format.',
        'अमान्य मिस्त्री आईडी प्रारूप।',
        400
      );
    }
  }

  /**
   * List all providers and pending workers with optional filters (categoryId, isActive, verificationStatus).
   * Strict deterministic ordering: created_at DESC, id DESC.
   */
  public async listProviders(filters?: ListProvidersFilter): Promise<AdminProviderView[]> {
    const pool = db.getPool();
    if (!pool) {
      throw new AdminProviderError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const conditions: string[] = ["(u.role = 'provider' OR p.verification_status IN ('PENDING_VERIFICATION', 'REJECTED'))"];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.categoryId) {
      conditions.push(`p.category_id = $${paramIndex++}`);
      values.push(filters.categoryId);
    }

    if (filters?.isActive !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    if (filters?.verificationStatus !== undefined) {
      conditions.push(`p.verification_status = $${paramIndex++}`);
      values.push(filters.verificationStatus);
    }

    const query = `
      SELECT
        u.id,
        u.phone,
        u.full_name as "fullName",
        u.role,
        u.preferred_language as "preferredLanguage",
        u.is_active as "isActive",
        p.category_id as "categoryId",
        sc.title_en as "categoryTitleEn",
        sc.title_hi as "categoryTitleHi",
        p.service_area as "serviceArea",
        p.is_available as "isAvailable",
        p.rating,
        p.verification_status as "verificationStatus",
        p.submitted_at as "submittedAt",
        p.verified_at as "verifiedAt",
        p.rejection_reason as "rejectionReason",
        p.rejected_at as "rejectedAt",
        u.created_at as "createdAt",
        (p.aadhaar_front_data IS NOT NULL) as "hasAadhaarFront",
        (p.aadhaar_back_data IS NOT NULL) as "hasAadhaarBack",
        (p.photo_data IS NOT NULL) as "hasPhoto",
        (
          SELECT COUNT(*)::int
          FROM bookings b
          WHERE b.provider_id = u.id
            AND b.status IN ('PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COLLECTED')
        ) as "activeBookingsCount"
      FROM users u
      JOIN provider_profiles p ON u.id = p.user_id
      JOIN service_categories sc ON p.category_id = sc.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC, u.id DESC
    `;

    const { rows } = await pool.query<RawProviderDbRow>(query, values);
    return rows.map(mapRawRow);
  }

  /**
   * Retrieve a single provider/worker profile by ID.
   */
  public async getProviderById(id: string): Promise<AdminProviderView> {
    this.validateUuid(id);

    const pool = db.getPool();
    if (!pool) {
      throw new AdminProviderError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const query = `
      SELECT
        u.id,
        u.phone,
        u.full_name as "fullName",
        u.role,
        u.preferred_language as "preferredLanguage",
        u.is_active as "isActive",
        p.category_id as "categoryId",
        sc.title_en as "categoryTitleEn",
        sc.title_hi as "categoryTitleHi",
        p.service_area as "serviceArea",
        p.is_available as "isAvailable",
        p.rating,
        p.verification_status as "verificationStatus",
        p.submitted_at as "submittedAt",
        p.verified_at as "verifiedAt",
        p.rejection_reason as "rejectionReason",
        p.rejected_at as "rejectedAt",
        u.created_at as "createdAt",
        (p.aadhaar_front_data IS NOT NULL) as "hasAadhaarFront",
        (p.aadhaar_back_data IS NOT NULL) as "hasAadhaarBack",
        (p.photo_data IS NOT NULL) as "hasPhoto",
        (
          SELECT COUNT(*)::int
          FROM bookings b
          WHERE b.provider_id = u.id
            AND b.status IN ('PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COLLECTED')
        ) as "activeBookingsCount"
      FROM users u
      JOIN provider_profiles p ON u.id = p.user_id
      JOIN service_categories sc ON p.category_id = sc.id
      WHERE u.id = $1 AND (u.role = 'provider' OR p.verification_status IN ('PENDING_VERIFICATION', 'REJECTED'))
    `;

    const { rows } = await pool.query<RawProviderDbRow>(query, [id]);
    if (rows.length === 0) {
      throw new AdminProviderError(
        'PROVIDER_NOT_FOUND',
        'Provider not found.',
        'मिस्त्री नहीं मिला।',
        404
      );
    }

    return mapRawRow(rows[0]);
  }

  public async verifyWorker(workerId: string, adminId: string): Promise<AdminProviderView> {
    return await workerService.verifyWorker(workerId, adminId);
  }

  public async rejectWorker(workerId: string, adminId: string, reason: string): Promise<AdminProviderView> {
    return await workerService.rejectWorker(workerId, adminId, reason);
  }

  public async getAadhaarDocument(providerId: string, side: 'front' | 'back'): Promise<{ buffer: Buffer; mimeType: string }> {
    return await workerService.getAadhaarDocument(providerId, side);
  }

  /**
   * Provision a new provider in an atomic transaction.
   * Inserts into users (role = 'provider') and provider_profiles.
   */
  public async createProvider(input: CreateProviderInput): Promise<AdminProviderView> {
    const pool = db.getPool();
    if (!pool) {
      throw new AdminProviderError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    // 1. Validate Category exists and is active
    const { rows: categoryRows } = await pool.query<{ id: string }>(
      'SELECT id FROM service_categories WHERE id = $1 AND is_active = true',
      [input.categoryId]
    );
    if (categoryRows.length === 0) {
      throw new AdminProviderError(
        'CATEGORY_NOT_FOUND',
        'Service category not found or inactive.',
        'सेवा श्रेणी नहीं मिली या निष्क्रिय है।',
        400
      );
    }

    // 2. Validate Phone uniqueness in users
    const { rows: existingUser } = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE phone = $1',
      [input.phone]
    );
    if (existingUser.length > 0) {
      throw new AdminProviderError(
        'PHONE_ALREADY_REGISTERED',
        'This phone number is already registered in the system.',
        'यह मोबाइल नंबर पहले से पंजीकृत है।',
        409
      );
    }

    // 3. Atomic Provisioning Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const preferredLang = input.preferredLanguage || 'hi';
      const serviceArea = (input.serviceArea && input.serviceArea.trim()) || 'Chandil';

      const { rows: newUsers } = await client.query<{ id: string }>(
        `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
         VALUES ($1, 'provider', $2, $3, true, 1)
         RETURNING id`,
        [input.phone, input.fullName.trim(), preferredLang]
      );
      const newUserId = newUsers[0].id;

      await client.query(
        `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status, rating)
         VALUES ($1, $2, $3, true, 'VERIFIED', 5.00)`,
        [newUserId, input.categoryId, serviceArea]
      );

      await client.query('COMMIT');

      return await this.getProviderById(newUserId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update provider details (fullName, categoryId, preferredLanguage, serviceArea).
   * Phone and role are immutable.
   */
  public async updateProvider(id: string, input: UpdateProviderInput): Promise<AdminProviderView> {
    this.validateUuid(id);

    const pool = db.getPool();
    if (!pool) {
      throw new AdminProviderError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    // 1. Verify provider exists
    const { rows: checkRows } = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 AND role = 'provider'",
      [id]
    );
    if (checkRows.length === 0) {
      throw new AdminProviderError(
        'PROVIDER_NOT_FOUND',
        'Provider not found.',
        'मिस्त्री नहीं मिला।',
        404
      );
    }

    // 2. If categoryId changed, verify it exists and is active
    if (input.categoryId !== undefined) {
      const { rows: catRows } = await pool.query<{ id: string }>(
        'SELECT id FROM service_categories WHERE id = $1 AND is_active = true',
        [input.categoryId]
      );
      if (catRows.length === 0) {
        throw new AdminProviderError(
          'CATEGORY_NOT_FOUND',
          'Service category not found or inactive.',
          'सेवा श्रेणी नहीं मिली या निष्क्रिय है।',
          400
        );
      }
    }

    // 3. Execute updates in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userUpdates: string[] = [];
      const userValues: any[] = [];
      let uIdx = 1;

      if (input.fullName !== undefined) {
        userUpdates.push(`full_name = $${uIdx++}`);
        userValues.push(input.fullName.trim());
      }
      if (input.preferredLanguage !== undefined) {
        userUpdates.push(`preferred_language = $${uIdx++}`);
        userValues.push(input.preferredLanguage);
      }

      if (userUpdates.length > 0) {
        userUpdates.push('updated_at = NOW()');
        userValues.push(id);
        await client.query(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${uIdx} AND role = 'provider'`,
          userValues
        );
      }

      const profileUpdates: string[] = [];
      const profileValues: any[] = [];
      let pIdx = 1;

      if (input.categoryId !== undefined) {
        profileUpdates.push(`category_id = $${pIdx++}`);
        profileValues.push(input.categoryId);
      }
      if (input.serviceArea !== undefined) {
        profileUpdates.push(`service_area = $${pIdx++}`);
        profileValues.push(input.serviceArea.trim());
      }

      if (profileUpdates.length > 0) {
        profileValues.push(id);
        await client.query(
          `UPDATE provider_profiles SET ${profileUpdates.join(', ')} WHERE user_id = $${pIdx}`,
          profileValues
        );
      }

      await client.query('COMMIT');
      return await this.getProviderById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Set provider active status (activate / deactivate).
   * Deactivation guards against active in-progress bookings and revokes sessions (token_version increment).
   * Idempotent: repeated same-status requests do not increment token_version or alter state.
   */
  public async setProviderStatus(id: string, isActive: boolean): Promise<AdminProviderView> {
    this.validateUuid(id);

    const pool = db.getPool();
    if (!pool) {
      throw new AdminProviderError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock and fetch provider row
      const { rows: providerRows } = await client.query<{ id: string; is_active: boolean }>(
        `SELECT u.id, u.is_active
         FROM users u
         JOIN provider_profiles p ON u.id = p.user_id
         WHERE u.id = $1 AND u.role = 'provider'
         FOR UPDATE`,
        [id]
      );

      if (providerRows.length === 0) {
        throw new AdminProviderError(
          'PROVIDER_NOT_FOUND',
          'Provider not found.',
          'मिस्त्री नहीं मिला।',
          404
        );
      }

      const currentActive = providerRows[0].is_active;

      // 2. Idempotency: If already in desired status, no-op transactionally
      if (currentActive === isActive) {
        await client.query('COMMIT');
        return await this.getProviderById(id);
      }

      // 3. Deactivation flow
      if (!isActive) {
        // Guard: check for any active in-progress bookings
        const { rows: activeBookings } = await client.query<{ id: string; status: string }>(
          `SELECT id, status FROM bookings
           WHERE provider_id = $1
             AND status IN ('PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COLLECTED')
           LIMIT 1`,
          [id]
        );

        if (activeBookings.length > 0) {
          throw new AdminProviderError(
            'ACTIVE_BOOKING_EXISTS',
            'Cannot deactivate provider with an active booking in progress.',
            'प्रगति पर बुकिंग वाले मिस्त्री को निष्क्रिय नहीं किया जा सकता।',
            409
          );
        }

        // Deactivate and revoke sessions
        await client.query(
          `UPDATE users 
           SET is_active = false, token_version = token_version + 1, updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );

        await client.query(
          `UPDATE provider_profiles 
           SET is_available = false 
           WHERE user_id = $1`,
          [id]
        );
      } else {
        // 4. Reactivation flow (do NOT increment token_version)
        await client.query(
          `UPDATE users 
           SET is_active = true, updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );

        await client.query(
          `UPDATE provider_profiles 
           SET is_available = true 
           WHERE user_id = $1`,
          [id]
        );
      }

      await client.query('COMMIT');
      return await this.getProviderById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
