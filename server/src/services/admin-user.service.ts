import { db } from '../db';
import {
  AdminUserView,
  UserRole,
  SupportedLanguage,
  WorkerVerificationStatus,
  TestCleanupPreview,
  TestCleanupResult,
} from '@shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ACTIVE_BOOKING_STATUSES = [
  'SERVICE_REQUESTED',
  'PROVIDER_ASSIGNED',
  'PROVIDER_ACCEPTED',
  'PROVIDER_ON_THE_WAY',
  'SERVICE_STARTED',
  'SERVICE_COMPLETED',
  'PAYMENT_PENDING',
];

export class AdminUserError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'AdminUserError';
  }
}

export interface ListUsersFilter {
  search?: string;
  role?: 'all' | UserRole;
  isActive?: boolean;
  isTest?: boolean;
}

export class AdminUserService {
  /**
   * Retrieves an administrative view of all registered users with their roles,
   * verification status (if worker), test data flag, and booking statistics.
   */
  async listUsers(filter: ListUsersFilter = {}): Promise<AdminUserView[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.role && filter.role !== 'all') {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(filter.role);
    }

    if (filter.isActive !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(filter.isActive);
    }

    if (filter.isTest !== undefined) {
      conditions.push(`u.is_test = $${paramIndex++}`);
      params.push(filter.isTest);
    }

    if (filter.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(u.phone) LIKE $${paramIndex} OR LOWER(COALESCE(u.full_name, '')) LIKE $${paramIndex})`);
      params.push(term);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.id,
        u.phone,
        u.role,
        u.full_name,
        u.preferred_language,
        u.is_active,
        COALESCE(u.is_test, false) AS is_test,
        u.created_at,
        u.updated_at,
        pp.verification_status,
        sc.title_en AS category_title_en,
        sc.title_hi AS category_title_hi,
        COALESCE(b_stats.total_bookings, 0) AS total_bookings,
        COALESCE(b_stats.active_bookings, 0) AS active_bookings,
        COALESCE(b_stats.completed_bookings, 0) AS completed_bookings,
        COALESCE(b_stats.cancelled_bookings, 0) AS cancelled_bookings
      FROM users u
      LEFT JOIN provider_profiles pp ON pp.user_id = u.id
      LEFT JOIN service_categories sc ON sc.id = pp.category_id
      LEFT JOIN (
        SELECT 
          target_user_id,
          COUNT(*) AS total_bookings,
          COUNT(*) FILTER (WHERE status IN ('SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING')) AS active_bookings,
          COUNT(*) FILTER (WHERE status IN ('PAYMENT_COLLECTED', 'BOOKING_COMPLETED')) AS completed_bookings,
          COUNT(*) FILTER (WHERE status IN ('CANCELLED_BY_CUSTOMER', 'REJECTED_BY_PROVIDER', 'CANCELLED_BY_ADMIN')) AS cancelled_bookings
        FROM (
          SELECT id, status, customer_id AS target_user_id FROM bookings
          UNION ALL
          SELECT id, status, provider_id AS target_user_id FROM bookings WHERE provider_id IS NOT NULL
        ) all_user_bookings
        GROUP BY target_user_id
      ) b_stats ON b_stats.target_user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const { rows } = await db.query(query, params);

    return rows.map((r: any) => ({
      id: r.id,
      phone: r.phone,
      role: r.role as UserRole,
      fullName: r.full_name,
      preferredLanguage: r.preferred_language as SupportedLanguage,
      isActive: r.is_active,
      isTest: !!r.is_test,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      workerVerificationStatus: (r.verification_status as WorkerVerificationStatus) || null,
      categoryTitleEn: r.category_title_en || null,
      categoryTitleHi: r.category_title_hi || null,
      bookingCounts: {
        total: Number(r.total_bookings || 0),
        active: Number(r.active_bookings || 0),
        completed: Number(r.completed_bookings || 0),
        cancelled: Number(r.cancelled_bookings || 0),
      },
    }));
  }

  /**
   * Toggles the active status of a user.
   * On deactivation:
   * 1. Increments token_version so active sessions are immediately invalidated.
   * 2. Sets is_available = false on provider_profiles if user is a provider.
   * Prevents self-deactivation of the logged-in administrator.
   */
  async updateUserStatus(userId: string, isActive: boolean, adminUserId: string): Promise<AdminUserView> {
    if (!UUID_REGEX.test(userId)) {
      throw new AdminUserError('INVALID_USER_ID', 'Invalid user ID format.', 'अमान्य उपयोगकर्ता पहचानकर्ता।', 400);
    }

    if (userId === adminUserId) {
      throw new AdminUserError(
        'CANNOT_DEACTIVATE_SELF',
        'You cannot deactivate your own administrative account.',
        'आप अपना स्वयं का व्यवस्थापक खाता निष्क्रिय नहीं कर सकते।',
        400
      );
    }

    const { rows: userRows } = await db.query('SELECT id, role, is_active FROM users WHERE id = $1', [userId]);
    if (userRows.length === 0) {
      throw new AdminUserError('USER_NOT_FOUND', 'User not found.', 'उपयोगकर्ता नहीं मिला।', 404);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool unavailable.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!isActive) {
        // Deactivation: increment token_version to invalidate all existing sessions
        await client.query(
          `UPDATE users 
           SET is_active = false, token_version = token_version + 1, updated_at = NOW() 
           WHERE id = $1`,
          [userId]
        );

        if (userRows[0].role === 'provider') {
          await client.query('UPDATE provider_profiles SET is_available = false WHERE user_id = $1', [userId]);
        }
      } else {
        // Activation
        await client.query(
          `UPDATE users 
           SET is_active = true, updated_at = NOW() 
           WHERE id = $1`,
          [userId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const users = await this.listUsers();
    const updated = users.find((u) => u.id === userId);
    if (!updated) {
      throw new AdminUserError('USER_NOT_FOUND', 'User not found after update.', 'उपयोगकर्ता नहीं मिला।', 404);
    }
    return updated;
  }

  /**
   * Marks or unmarks a user (and optionally their bookings) as test data.
   */
  async markTestUser(userId: string, isTest: boolean, cascadeBookings: boolean = true): Promise<AdminUserView> {
    if (!UUID_REGEX.test(userId)) {
      throw new AdminUserError('INVALID_USER_ID', 'Invalid user ID format.', 'अमान्य उपयोगकर्ता पहचानकर्ता।', 400);
    }

    const { rows } = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      throw new AdminUserError('USER_NOT_FOUND', 'User not found.', 'उपयोगकर्ता नहीं मिला।', 404);
    }

    const user = rows[0];
    if (user.role === 'admin' && isTest) {
      throw new AdminUserError(
        'CANNOT_MARK_ADMIN_AS_TEST',
        'Administrative accounts cannot be marked as test data.',
        'व्यवस्थापक खाते को परीक्षण डेटा के रूप में चिह्नित नहीं किया जा सकता।',
        400
      );
    }

    if (isTest) {
      const { rows: activeRows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count 
         FROM bookings 
         WHERE (customer_id = $1 OR provider_id = $1) AND status = ANY($2)`,
        [userId, ACTIVE_BOOKING_STATUSES]
      );
      if (Number(activeRows[0].count) > 0) {
        throw new AdminUserError(
          'ACTIVE_BOOKINGS_EXIST',
          'Cannot mark user as test data while they have active bookings in progress.',
          'सक्रिय बुकिंग प्रगति पर होने के दौरान उपयोगकर्ता को परीक्षण डेटा के रूप में चिह्नित नहीं किया जा सकता।',
          400
        );
      }
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool unavailable.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('UPDATE users SET is_test = $1, updated_at = NOW() WHERE id = $2', [isTest, userId]);

      if (cascadeBookings) {
        await client.query(
          'UPDATE bookings SET is_test = $1, updated_at = NOW() WHERE customer_id = $2 OR provider_id = $2',
          [isTest, userId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const users = await this.listUsers();
    const updated = users.find((u) => u.id === userId);
    if (!updated) {
      throw new AdminUserError('USER_NOT_FOUND', 'User not found after update.', 'उपयोगकर्ता नहीं मिला।', 404);
    }
    return updated;
  }

  /**
   * Safely deletes a user with explicit confirmation and safety guards.
   * Safety checks:
   * 1. Cannot delete self.
   * 2. Phone confirmation must match exactly.
   * 3. Blocks deletion if any active in-progress bookings exist.
   * 4. For test users: Cascades and deletes test bookings, logs, and user in a single transaction.
   * 5. For real users with historical completed bookings: Anonymizes user details and purges credentials to preserve audit/financial records without foreign key violation.
   * 6. For real users with 0 bookings: Directly deletes user.
   */
  async deleteUser(
    userId: string,
    confirmPhone: string,
    adminUserId: string
  ): Promise<{ success: boolean; anonymized: boolean }> {
    if (!UUID_REGEX.test(userId)) {
      throw new AdminUserError('INVALID_USER_ID', 'Invalid user ID format.', 'अमान्य उपयोगकर्ता पहचानकर्ता।', 400);
    }

    if (userId === adminUserId) {
      throw new AdminUserError(
        'CANNOT_DELETE_SELF',
        'You cannot delete your own administrative account.',
        'आप अपना स्वयं का व्यवस्थापक खाता हटा नहीं सकते।',
        400
      );
    }

    const { rows: userRows } = await db.query(
      'SELECT id, phone, role, is_test FROM users WHERE id = $1',
      [userId]
    );

    if (userRows.length === 0) {
      throw new AdminUserError('USER_NOT_FOUND', 'User not found.', 'उपयोगकर्ता नहीं मिला।', 404);
    }

    const user = userRows[0];

    // Explicit confirmation validation
    if (user.phone !== confirmPhone.trim()) {
      throw new AdminUserError(
        'PHONE_MISMATCH',
        'Confirmation phone number does not match user phone number.',
        'पुष्टि के लिए दिया गया फ़ोन नंबर मेल नहीं खाता।',
        400
      );
    }

    // Active booking check
    const { rows: activeRows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count 
       FROM bookings 
       WHERE (customer_id = $1 OR provider_id = $1) AND status = ANY($2)`,
      [userId, ACTIVE_BOOKING_STATUSES]
    );

    if (Number(activeRows[0].count) > 0) {
      throw new AdminUserError(
        'ACTIVE_BOOKINGS_EXIST',
        'Cannot delete user while they have an active booking in progress.',
        'सक्रिय बुकिंग प्रगति पर होने के दौरान उपयोगकर्ता को नहीं हटाया जा सकता।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool unavailable.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isTestUser = !!user.is_test;

      if (isTestUser) {
        // Safe deletion of test data: wipe test booking status logs, test bookings, and user
        // Ensure non-test bookings belonging to real customers are never deleted: only delete bookings if customer is test user or booking itself is marked is_test
        await client.query(
          `DELETE FROM booking_status_logs 
           WHERE booking_id IN (
             SELECT id FROM bookings 
             WHERE customer_id = $1 OR (provider_id = $1 AND is_test = true)
           )`,
          [userId]
        );

        await client.query(
          `DELETE FROM bookings 
           WHERE customer_id = $1 OR (provider_id = $1 AND is_test = true)`,
          [userId]
        );

        // If test user was assigned as provider to any real non-test bookings, unassign provider_id
        await client.query(
          'UPDATE bookings SET provider_id = NULL WHERE provider_id = $1',
          [userId]
        );

        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');
        return { success: true, anonymized: false };
      }

      // Check if real user has any completed/cancelled historical bookings
      const { rows: allBookingsRows } = await db.query<{ count: string }>(
        'SELECT COUNT(*)::int AS count FROM bookings WHERE customer_id = $1 OR provider_id = $1',
        [userId]
      );
      const hasHistoricalBookings = Number(allBookingsRows[0].count) > 0;

      if (hasHistoricalBookings) {
        // Financial & audit preservation: Anonymize personal identifying information
        // and purge authentication credentials, challenges, and recovery codes
        await client.query('DELETE FROM user_credentials WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM webauthn_challenges WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);

        if (user.role === 'provider') {
          await client.query(
            `UPDATE provider_profiles 
             SET aadhaar_front_data = NULL, aadhaar_front_mime = NULL, 
                 aadhaar_back_data = NULL, aadhaar_back_mime = NULL, 
                 photo_data = NULL, photo_mime = NULL, is_available = false 
             WHERE user_id = $1`,
            [userId]
          );
        }

        const anonymizedPhone = `del_${userId.replace(/-/g, '').slice(0, 10)}`;
        await client.query(
          `UPDATE users 
           SET full_name = 'Deleted User', phone = $1, is_active = false, token_version = token_version + 1, updated_at = NOW() 
           WHERE id = $2`,
          [anonymizedPhone, userId]
        );

        await client.query('COMMIT');
        return { success: true, anonymized: true };
      } else {
        // 0 bookings: clean delete cascades credentials & profile
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        return { success: true, anonymized: false };
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Previews records that would be affected by test data cleanup.
   */
  async previewTestDataCleanup(): Promise<TestCleanupPreview> {
    const { rows: userRows } = await db.query<{
      total_test_users: string;
      test_customers: string;
      test_providers: string;
    }>(`
      SELECT 
        COUNT(*)::int AS total_test_users,
        COUNT(*) FILTER (WHERE role = 'customer')::int AS test_customers,
        COUNT(*) FILTER (WHERE role = 'provider')::int AS test_providers
      FROM users 
      WHERE is_test = true
    `);

    const { rows: bookingRows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count 
       FROM bookings 
       WHERE is_test = true OR customer_id IN (SELECT id FROM users WHERE is_test = true)`
    );

    const { rows: logRows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count 
       FROM booking_status_logs 
       WHERE booking_id IN (
         SELECT id FROM bookings 
         WHERE is_test = true OR customer_id IN (SELECT id FROM users WHERE is_test = true)
       )`
    );

    const testUsersCount = Number(userRows[0]?.total_test_users || 0);
    const testCustomersCount = Number(userRows[0]?.test_customers || 0);
    const testProvidersCount = Number(userRows[0]?.test_providers || 0);
    const testBookingsCount = Number(bookingRows[0]?.count || 0);
    const testStatusLogsCount = Number(logRows[0]?.count || 0);

    return {
      testUsersCount,
      testBookingsCount,
      testStatusLogsCount,
      testCustomersCount,
      testProvidersCount,
      canCleanup: testUsersCount > 0 || testBookingsCount > 0,
    };
  }

  /**
   * Executes transactional test data cleanup targeting strictly test records.
   * Never broad deletes or touches real records.
   */
  async cleanupTestData(confirmPhrase: string): Promise<TestCleanupResult> {
    if (confirmPhrase.trim() !== 'CLEANUP') {
      throw new AdminUserError(
        'INVALID_CONFIRMATION',
        'Invalid confirmation phrase. Type CLEANUP to confirm.',
        'अमान्य पुष्टि कोड। पुष्टि के लिए CLEANUP लिखें।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool unavailable.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if any test user has active in-progress bookings that would block clean deletion
      const { rows: activeTestRows } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count 
         FROM bookings 
         WHERE (is_test = true OR customer_id IN (SELECT id FROM users WHERE is_test = true) OR provider_id IN (SELECT id FROM users WHERE is_test = true))
           AND status = ANY($1)`,
        [ACTIVE_BOOKING_STATUSES]
      );
      if (Number(activeTestRows[0].count) > 0) {
        throw new AdminUserError(
          'ACTIVE_BOOKINGS_EXIST',
          'Cannot clean up test data while active test bookings are in progress.',
          'सक्रिय परीक्षण बुकिंग प्रगति पर होने के दौरान परीक्षण डेटा साफ़ नहीं किया जा सकता।',
          400
        );
      }

      // 1. Delete status progression logs for test bookings or test customer bookings
      const { rowCount: deletedStatusLogsCount } = await client.query(
        `DELETE FROM booking_status_logs 
         WHERE booking_id IN (
           SELECT id FROM bookings 
           WHERE is_test = true OR customer_id IN (SELECT id FROM users WHERE is_test = true)
         )`
      );

      // 2. Delete test bookings or bookings created by test customers
      const { rowCount: deletedBookingsCount } = await client.query(
        `DELETE FROM bookings 
         WHERE is_test = true OR customer_id IN (SELECT id FROM users WHERE is_test = true)`
      );

      // 3. For any non-test bookings where a test provider was assigned, unlink provider_id
      await client.query(
        `UPDATE bookings 
         SET provider_id = NULL 
         WHERE provider_id IN (SELECT id FROM users WHERE is_test = true)`
      );

      // 4. Delete test users (cascades credentials, profiles, challenges, recovery codes)
      const { rowCount: deletedUsersCount } = await client.query(
        'DELETE FROM users WHERE is_test = true'
      );

      await client.query('COMMIT');

      return {
        deletedUsersCount: deletedUsersCount || 0,
        deletedBookingsCount: deletedBookingsCount || 0,
        deletedStatusLogsCount: deletedStatusLogsCount || 0,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const adminUserService = new AdminUserService();
