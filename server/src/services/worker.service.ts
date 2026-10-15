import { db } from '../db';
import { WorkerOnboardingInput, VerifiedWorkerSummary, AdminProviderView } from '@shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MIN_IMAGE_SIZE = 100; // 100 bytes

export class WorkerError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'WorkerError';
  }
}

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class WorkerService {
  /**
   * Validates base64 image data, checking:
   * 1. Valid base64 encoding
   * 2. Size boundaries (100 B - 5 MB)
   * 3. Allowed MIME types (image/jpeg, image/png, image/webp)
   * 4. Magic bytes matching the claimed MIME type
   */
  public validateImage(base64Data: string, declaredMime: string, fieldName: string): ValidatedImage {
    if (!base64Data || typeof base64Data !== 'string' || base64Data.trim().length === 0) {
      throw new WorkerError(
        'INVALID_IMAGE_PAYLOAD',
        `${fieldName} image data is required.`,
        `${fieldName} फोटो आवश्यक है।`,
        400
      );
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '').trim();
    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      throw new WorkerError(
        'MALFORMED_BASE64',
        `Malformed base64 image data for ${fieldName}.`,
        `${fieldName} का फोटो डेटा अमान्य है।`,
        400
      );
    }

    if (buffer.length < MIN_IMAGE_SIZE) {
      throw new WorkerError(
        'IMAGE_TOO_SMALL',
        `${fieldName} image data is empty or too small.`,
        `${fieldName} फोटो फ़ाइल बहुत छोटी या दूषित है।`,
        400
      );
    }

    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new WorkerError(
        'IMAGE_TOO_LARGE',
        `${fieldName} exceeds maximum allowed size of 5 MB.`,
        `${fieldName} फोटो का आकार 5 MB की अधिकतम सीमा से अधिक है।`,
        400
      );
    }

    const normMime = declaredMime.toLowerCase().trim();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(normMime)) {
      throw new WorkerError(
        'UNSUPPORTED_MIME_TYPE',
        `Unsupported MIME type for ${fieldName}: ${declaredMime}. Only JPEG, PNG, and WebP are accepted.`,
        `${fieldName} के लिए केवल JPEG, PNG और WebP फोटो स्वीकार्य हैं।`,
        400
      );
    }

    // Magic bytes verification
    if (normMime === 'image/jpeg') {
      // JPEG starts with FF D8 FF
      if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new WorkerError(
          'INVALID_IMAGE_MAGIC_BYTES',
          `Invalid image content for ${fieldName}. File does not match JPEG signature.`,
          `${fieldName} का फोटो डेटा सही JPEG प्रारूप में नहीं है।`,
          400
        );
      }
    } else if (normMime === 'image/png') {
      // PNG starts with 89 50 4E 47
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47
      ) {
        throw new WorkerError(
          'INVALID_IMAGE_MAGIC_BYTES',
          `Invalid image content for ${fieldName}. File does not match PNG signature.`,
          `${fieldName} का फोटो डेटा सही PNG प्रारूप में नहीं है।`,
          400
        );
      }
    } else if (normMime === 'image/webp') {
      // WebP starts with 'RIFF' (bytes 0-3: 52 49 46 46) and 'WEBP' (bytes 8-11: 57 45 42 50)
      if (
        buffer.length < 12 ||
        buffer[0] !== 0x52 ||
        buffer[1] !== 0x49 ||
        buffer[2] !== 0x46 ||
        buffer[3] !== 0x46 ||
        buffer[8] !== 0x57 ||
        buffer[9] !== 0x45 ||
        buffer[10] !== 0x42 ||
        buffer[11] !== 0x50
      ) {
        throw new WorkerError(
          'INVALID_IMAGE_MAGIC_BYTES',
          `Invalid image content for ${fieldName}. File does not match WebP signature.`,
          `${fieldName} का फोटो डेटा सही WebP प्रारूप में नहीं है।`,
          400
        );
      }
    }

    return {
      buffer,
      mimeType: normMime as 'image/jpeg' | 'image/png' | 'image/webp',
    };
  }

  /**
   * Submit worker onboarding application.
   * Atomic operation saving documents and transitioning/keeping status as PENDING_VERIFICATION.
   */
  public async submitOnboarding(userId: string, input: WorkerOnboardingInput): Promise<{
    status: 'PENDING_VERIFICATION';
    submittedAt: string;
    messageEn: string;
    messageHi: string;
  }> {
    if (!userId || !UUID_REGEX.test(userId)) {
      throw new WorkerError('INVALID_USER_ID', 'Invalid user ID.', 'अमान्य उपयोगकर्ता आईडी।', 400);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    // 1. Verify User exists and is active
    const { rows: userRows } = await pool.query<{ id: string; is_active: boolean; role: string }>(
      'SELECT id, is_active, role FROM users WHERE id = $1',
      [userId]
    );
    if (userRows.length === 0) {
      throw new WorkerError('USER_NOT_FOUND', 'User not found.', 'उपयोगकर्ता नहीं मिला।', 404);
    }
    if (!userRows[0].is_active) {
      throw new WorkerError('ACCOUNT_DEACTIVATED', 'Account is deactivated.', 'खाता निष्क्रिय है।', 403);
    }

    // 2. Validate Full Name
    const trimmedName = (input.fullName || '').trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new WorkerError(
        'INVALID_FULL_NAME',
        'Full name is required and must not exceed 100 characters.',
        'पूरा नाम आवश्यक है और 100 अक्षरों से अधिक नहीं हो सकता।',
        400
      );
    }

    // 3. Validate Category exists and is active
    const { rows: catRows } = await pool.query<{ id: string }>(
      'SELECT id FROM service_categories WHERE id = $1 AND is_active = true',
      [input.categoryId]
    );
    if (catRows.length === 0) {
      throw new WorkerError(
        'CATEGORY_NOT_FOUND',
        'Selected category not found or inactive.',
        'चुनी गई सेवा श्रेणी उपलब्ध नहीं है।',
        400
      );
    }

    // 4. Validate or preserve Images (Aadhaar Front, Aadhaar Back, Worker Photo)
    const { rows: existingProfiles } = await pool.query<{
      verification_status: string;
      has_front: boolean;
      has_back: boolean;
      has_photo: boolean;
    }>(
      `SELECT
         verification_status,
         (aadhaar_front_data IS NOT NULL) as has_front,
         (aadhaar_back_data IS NOT NULL) as has_back,
         (photo_data IS NOT NULL) as has_photo
       FROM provider_profiles WHERE user_id = $1`,
      [userId]
    );

    const existing = existingProfiles[0];
    if (existing && existing.verification_status === 'VERIFIED') {
      throw new WorkerError(
        'ALREADY_VERIFIED',
        'Worker profile is already verified by admin.',
        'आपकी प्रोफ़ाइल पहले से सत्यापित है।',
        400
      );
    }

    let frontImg: ValidatedImage | null = null;
    if (input.aadhaarFrontBase64 && input.aadhaarFrontBase64.trim().length > 0) {
      frontImg = this.validateImage(input.aadhaarFrontBase64, input.aadhaarFrontMime || '', 'Aadhaar Front');
    } else if (!existing?.has_front) {
      throw new WorkerError(
        'INVALID_IMAGE_PAYLOAD',
        'Aadhaar Front image data is required.',
        'Aadhaar Front फोटो आवश्यक है।',
        400
      );
    }

    let backImg: ValidatedImage | null = null;
    if (input.aadhaarBackBase64 && input.aadhaarBackBase64.trim().length > 0) {
      backImg = this.validateImage(input.aadhaarBackBase64, input.aadhaarBackMime || '', 'Aadhaar Back');
    } else if (!existing?.has_back) {
      throw new WorkerError(
        'INVALID_IMAGE_PAYLOAD',
        'Aadhaar Back image data is required.',
        'Aadhaar Back फोटो आवश्यक है।',
        400
      );
    }

    let photoImg: ValidatedImage | null = null;
    if (input.photoBase64 && input.photoBase64.trim().length > 0) {
      photoImg = this.validateImage(input.photoBase64, input.photoMime || '', 'Worker Photo');
    } else if (!existing?.has_photo) {
      throw new WorkerError(
        'INVALID_IMAGE_PAYLOAD',
        'Worker Photo image data is required.',
        'Worker Photo फोटो आवश्यक है।',
        400
      );
    }

    // 5. Save in Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update user full_name (remains role='customer')
      await client.query(
        'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2',
        [trimmedName, userId]
      );

      // Upsert provider_profiles
      const { rows: upsertRows } = await client.query<{ submitted_at: Date }>(
        `INSERT INTO provider_profiles (
           user_id, category_id, service_area, verification_status,
           aadhaar_front_data, aadhaar_front_mime,
           aadhaar_back_data, aadhaar_back_mime,
           photo_data, photo_mime,
           submitted_at,
           rejection_reason, rejected_at, rejected_by
         ) VALUES ($1, $2, 'Chandil', 'PENDING_VERIFICATION', $3, $4, $5, $6, $7, $8, NOW(), NULL, NULL, NULL)
         ON CONFLICT (user_id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           verification_status = 'PENDING_VERIFICATION',
           aadhaar_front_data = COALESCE(EXCLUDED.aadhaar_front_data, provider_profiles.aadhaar_front_data),
           aadhaar_front_mime = COALESCE(EXCLUDED.aadhaar_front_mime, provider_profiles.aadhaar_front_mime),
           aadhaar_back_data = COALESCE(EXCLUDED.aadhaar_back_data, provider_profiles.aadhaar_back_data),
           aadhaar_back_mime = COALESCE(EXCLUDED.aadhaar_back_mime, provider_profiles.aadhaar_back_mime),
           photo_data = COALESCE(EXCLUDED.photo_data, provider_profiles.photo_data),
           photo_mime = COALESCE(EXCLUDED.photo_mime, provider_profiles.photo_mime),
           submitted_at = NOW(),
           rejection_reason = NULL,
           rejected_at = NULL,
           rejected_by = NULL
         RETURNING submitted_at`,
        [
          userId,
          input.categoryId,
          frontImg ? frontImg.buffer : null,
          frontImg ? frontImg.mimeType : null,
          backImg ? backImg.buffer : null,
          backImg ? backImg.mimeType : null,
          photoImg ? photoImg.buffer : null,
          photoImg ? photoImg.mimeType : null,
        ]
      );

      await client.query('COMMIT');

      const submittedAtIso = upsertRows[0].submitted_at.toISOString();
      return {
        status: 'PENDING_VERIFICATION',
        submittedAt: submittedAtIso,
        messageEn: 'Your profile has been submitted. Chandil Admin will verify it within 24 hours.',
        messageHi: 'आपकी प्रोफ़ाइल सबमिट हो गई है, चंडिल एडमिन 24 घंटे में सत्यापित करेगा।',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves the current onboarding / verification status for an authenticated worker.
   * Omits raw Aadhaar bytes.
   */
  public async getWorkerStatus(userId: string): Promise<{
    status: 'NOT_STARTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
    hasSubmitted: boolean;
    fullName?: string | null;
    categoryId?: string | null;
    categoryTitleEn?: string | null;
    categoryTitleHi?: string | null;
    submittedAt?: string | null;
    verifiedAt?: string | null;
    rejectionReason?: string | null;
    rejectedAt?: string | null;
    hasAadhaarFront: boolean;
    hasAadhaarBack: boolean;
    hasPhoto: boolean;
    photoUrl?: string | null;
  }> {
    if (!userId || !UUID_REGEX.test(userId)) {
      throw new WorkerError('INVALID_USER_ID', 'Invalid user ID.', 'अमान्य उपयोगकर्ता आईडी।', 400);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const query = `
      SELECT
        pp.verification_status,
        pp.category_id,
        sc.title_en as category_title_en,
        sc.title_hi as category_title_hi,
        pp.submitted_at,
        pp.verified_at,
        pp.rejection_reason,
        pp.rejected_at,
        u.full_name,
        (pp.aadhaar_front_data IS NOT NULL) as has_aadhaar_front,
        (pp.aadhaar_back_data IS NOT NULL) as has_aadhaar_back,
        (pp.photo_data IS NOT NULL) as has_photo
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN service_categories sc ON pp.category_id = sc.id
      WHERE pp.user_id = $1
    `;

    const { rows } = await pool.query<{
      verification_status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
      category_id: string | null;
      category_title_en: string | null;
      category_title_hi: string | null;
      submitted_at: Date | null;
      verified_at: Date | null;
      rejection_reason: string | null;
      rejected_at: Date | null;
      full_name: string | null;
      has_aadhaar_front: boolean;
      has_aadhaar_back: boolean;
      has_photo: boolean;
    }>(query, [userId]);

    if (rows.length === 0) {
      return {
        status: 'NOT_STARTED',
        hasSubmitted: false,
        rejectionReason: null,
        rejectedAt: null,
        fullName: null,
        hasAadhaarFront: false,
        hasAadhaarBack: false,
        hasPhoto: false,
      };
    }

    const row = rows[0];
    return {
      status: row.verification_status,
      hasSubmitted: true,
      fullName: row.full_name,
      categoryId: row.category_id,
      categoryTitleEn: row.category_title_en,
      categoryTitleHi: row.category_title_hi,
      submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
      verifiedAt: row.verified_at ? row.verified_at.toISOString() : null,
      rejectionReason: row.rejection_reason || null,
      rejectedAt: row.rejected_at ? row.rejected_at.toISOString() : null,
      hasAadhaarFront: !!row.has_aadhaar_front,
      hasAadhaarBack: !!row.has_aadhaar_back,
      hasPhoto: !!row.has_photo,
      photoUrl: row.has_photo ? `/api/workers/${userId}/photo` : null,
    };
  }

  /**
   * Admin-only retrieval of Aadhaar document (front or back).
   */
  public async getAadhaarDocument(providerId: string, side: 'front' | 'back'): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!providerId || !UUID_REGEX.test(providerId)) {
      throw new WorkerError('INVALID_ID', 'Invalid provider ID.', 'अमान्य मिस्त्री आईडी।', 400);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const colData = side === 'front' ? 'aadhaar_front_data' : 'aadhaar_back_data';
    const colMime = side === 'front' ? 'aadhaar_front_mime' : 'aadhaar_back_mime';

    const { rows } = await pool.query<{ data: Buffer | null; mime: string | null }>(
      `SELECT ${colData} as data, ${colMime} as mime FROM provider_profiles WHERE user_id = $1`,
      [providerId]
    );

    if (rows.length === 0 || !rows[0].data || !rows[0].mime) {
      throw new WorkerError(
        'DOCUMENT_NOT_FOUND',
        `Aadhaar ${side} document not found.`,
        `आधार कार्ड दस्तावेज नहीं मिला।`,
        404
      );
    }

    return {
      buffer: rows[0].data,
      mimeType: rows[0].mime,
    };
  }

  /**
   * Retrieves worker photo with strict RBAC:
   * - Admin: always allowed.
   * - Worker: can view their own photo.
   * - Customers / others: ONLY allowed if worker is VERIFIED, role='provider', and is_active=true.
   */
  public async getWorkerPhoto(
    workerId: string,
    requester: { id: string; role: string }
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!workerId || !UUID_REGEX.test(workerId)) {
      throw new WorkerError('INVALID_ID', 'Invalid worker ID.', 'अमान्य कार्यकर्ता आईडी।', 400);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const { rows } = await pool.query<{
      photo_data: Buffer | null;
      photo_mime: string | null;
      verification_status: string;
      role: string;
      is_active: boolean;
    }>(
      `SELECT
         pp.photo_data,
         pp.photo_mime,
         pp.verification_status,
         u.role,
         u.is_active
       FROM provider_profiles pp
       JOIN users u ON pp.user_id = u.id
       WHERE pp.user_id = $1`,
      [workerId]
    );

    if (rows.length === 0 || !rows[0].photo_data || !rows[0].photo_mime) {
      throw new WorkerError('PHOTO_NOT_FOUND', 'Worker photo not found.', 'फोटो नहीं मिली।', 404);
    }

    const row = rows[0];

    // Authorization check
    const isAdmin = requester.role === 'admin';
    const isSelf = requester.id === workerId;

    if (!isAdmin && !isSelf) {
      // Must be verified, active provider to be visible to customers/others
      if (row.verification_status !== 'VERIFIED' || row.role !== 'provider' || !row.is_active) {
        throw new WorkerError(
          'ACCESS_DENIED',
          'Worker photo is not accessible.',
          'फोटो उपलब्ध नहीं है।',
          403
        );
      }
    }

    return {
      buffer: row.photo_data!,
      mimeType: row.photo_mime!,
    };
  }

  /**
   * Admin-only verification of a worker application.
   * Atomic promotion from customer -> provider and verification_status -> VERIFIED.
   */
  public async verifyWorker(workerId: string, adminId: string): Promise<AdminProviderView> {
    if (!workerId || !UUID_REGEX.test(workerId)) {
      throw new WorkerError('INVALID_ID', 'Invalid worker ID.', 'अमान्य कार्यकर्ता आईडी।', 400);
    }
    if (!adminId || !UUID_REGEX.test(adminId)) {
      throw new WorkerError('INVALID_ADMIN_ID', 'Invalid admin ID.', 'अमान्य एडमिन आईडी।', 400);
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch and lock profile + user
      const { rows } = await client.query<{
        user_id: string;
        full_name: string | null;
        category_id: string | null;
        verification_status: string;
        has_front: boolean;
        has_back: boolean;
        has_photo: boolean;
      }>(
        `SELECT
           pp.user_id,
           u.full_name,
           pp.category_id,
           pp.verification_status,
           (pp.aadhaar_front_data IS NOT NULL) as has_front,
           (pp.aadhaar_back_data IS NOT NULL) as has_back,
           (pp.photo_data IS NOT NULL) as has_photo
         FROM provider_profiles pp
         JOIN users u ON pp.user_id = u.id
         WHERE pp.user_id = $1
         FOR UPDATE`,
        [workerId]
      );

      if (rows.length === 0) {
        throw new WorkerError('WORKER_NOT_FOUND', 'Worker profile not found.', 'कार्यकर्ता प्रोफ़ाइल नहीं मिली।', 404);
      }

      const profile = rows[0];

      // 2. Completeness check
      if (
        !profile.has_front ||
        !profile.has_back ||
        !profile.has_photo ||
        !profile.category_id ||
        !profile.full_name ||
        profile.full_name.trim().length === 0
      ) {
        throw new WorkerError(
          'INCOMPLETE_PROFILE',
          'Cannot verify worker with incomplete profile. Missing Aadhaar front, Aadhaar back, photo, name, or category.',
          'अधूरी प्रोफ़ाइल सत्यापित नहीं की जा सकती। आधार कार्ड, फोटो, नाम या श्रेणी अनुपलब्ध है।',
          400
        );
      }

      // 3. Atomically update verification status and role
      await client.query(
        `UPDATE provider_profiles
         SET verification_status = 'VERIFIED',
             verified_at = NOW(),
             verified_by = $1,
             is_available = true,
             rejection_reason = NULL,
             rejected_at = NULL,
             rejected_by = NULL
         WHERE user_id = $2`,
        [adminId, workerId]
      );

      await client.query(
        `UPDATE users
         SET role = 'provider',
             updated_at = NOW()
         WHERE id = $1`,
        [workerId]
      );

      await client.query('COMMIT');

      // Fetch updated view
      const { rows: updatedRows } = await pool.query<any>(
        `SELECT
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
           (p.photo_data IS NOT NULL) as "hasPhoto"
         FROM users u
         JOIN provider_profiles p ON u.id = p.user_id
         JOIN service_categories sc ON p.category_id = sc.id
         WHERE u.id = $1`,
        [workerId]
      );

      const r = updatedRows[0];
      return {
        id: r.id,
        phone: r.phone,
        fullName: r.fullName,
        role: r.role,
        preferredLanguage: r.preferredLanguage,
        isActive: r.isActive,
        categoryId: r.categoryId,
        categoryTitleEn: r.categoryTitleEn,
        categoryTitleHi: r.categoryTitleHi,
        serviceArea: r.serviceArea,
        isAvailable: r.isAvailable,
        rating: parseFloat(String(r.rating)),
        verificationStatus: r.verificationStatus,
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
        rejectionReason: r.rejectionReason || null,
        rejectedAt: r.rejectedAt ? new Date(r.rejectedAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
        hasAadhaarFront: !!r.hasAadhaarFront,
        hasAadhaarBack: !!r.hasAadhaarBack,
        hasPhoto: !!r.hasPhoto,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Admin-only rejection of a worker application with mandatory reason (1-500 chars).
   * Sets verification_status = 'REJECTED', records rejected_at, rejected_by, and rejection_reason.
   * If user was 'provider', demotes to 'customer' and increments token_version to immediately invalidate provider sessions.
   */
  public async rejectWorker(workerId: string, adminId: string, reason: string): Promise<AdminProviderView> {
    if (!workerId || !UUID_REGEX.test(workerId)) {
      throw new WorkerError('INVALID_ID', 'Invalid worker ID.', 'अमान्य कार्यकर्ता आईडी।', 400);
    }
    if (!adminId || !UUID_REGEX.test(adminId)) {
      throw new WorkerError('INVALID_ADMIN_ID', 'Invalid admin ID.', 'अमान्य एडमिन आईडी।', 400);
    }

    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 1 || trimmedReason.length > 500) {
      throw new WorkerError(
        'INVALID_REJECTION_REASON',
        'Rejection reason is required and must not exceed 500 characters.',
        'अस्वीकृति का कारण आवश्यक है और 500 अक्षरों से अधिक नहीं हो सकता।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{
        user_id: string;
        role: string;
        verification_status: string;
      }>(
        `SELECT pp.user_id, u.role, pp.verification_status
         FROM provider_profiles pp
         JOIN users u ON pp.user_id = u.id
         WHERE pp.user_id = $1
         FOR UPDATE`,
        [workerId]
      );

      if (rows.length === 0) {
        throw new WorkerError('WORKER_NOT_FOUND', 'Worker profile not found.', 'कार्यकर्ता प्रोफ़ाइल नहीं मिली।', 404);
      }

      await client.query(
        `UPDATE provider_profiles
         SET verification_status = 'REJECTED',
             rejection_reason = $1,
             rejected_at = NOW(),
             rejected_by = $2,
             is_available = false
         WHERE user_id = $3`,
        [trimmedReason, adminId, workerId]
      );

      await client.query(
        `UPDATE users
         SET role = 'customer',
             token_version = token_version + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [workerId]
      );

      await client.query('COMMIT');

      const { rows: updatedRows } = await pool.query<any>(
        `SELECT
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
           (p.photo_data IS NOT NULL) as "hasPhoto"
         FROM users u
         JOIN provider_profiles p ON u.id = p.user_id
         JOIN service_categories sc ON p.category_id = sc.id
         WHERE u.id = $1`,
        [workerId]
      );

      const r = updatedRows[0];
      return {
        id: r.id,
        phone: r.phone,
        fullName: r.fullName,
        role: r.role,
        preferredLanguage: r.preferredLanguage,
        isActive: r.isActive,
        categoryId: r.categoryId,
        categoryTitleEn: r.categoryTitleEn,
        categoryTitleHi: r.categoryTitleHi,
        serviceArea: r.serviceArea,
        isAvailable: r.isAvailable,
        rating: parseFloat(String(r.rating)),
        verificationStatus: r.verificationStatus,
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
        rejectionReason: r.rejectionReason || null,
        rejectedAt: r.rejectedAt ? new Date(r.rejectedAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
        hasAadhaarFront: !!r.hasAadhaarFront,
        hasAadhaarBack: !!r.hasAadhaarBack,
        hasPhoto: !!r.hasPhoto,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Customer-facing verified workers list.
   * Returns ONLY workers satisfying ALL:
   * - provider_profiles.verification_status = 'VERIFIED'
   * - users.role = 'provider'
   * - users.is_active = true
   * Never returns Aadhaar data or internal audit fields.
   */
  public async getVerifiedWorkers(categoryId?: string): Promise<VerifiedWorkerSummary[]> {
    const pool = db.getPool();
    if (!pool) {
      throw new WorkerError('DATABASE_UNAVAILABLE', 'Database is not available.', 'डेटाबेस अनुपलब्ध है।', 500);
    }

    const conditions: string[] = [
      "pp.verification_status = 'VERIFIED'",
      "u.role = 'provider'",
      'u.is_active = true',
      'sc.is_active = true',
    ];
    const values: any[] = [];

    if (categoryId && categoryId.trim().length > 0) {
      conditions.push(`pp.category_id = $1`);
      values.push(categoryId.trim());
    }

    const query = `
      SELECT
        u.id,
        u.full_name as "fullName",
        pp.category_id as "categoryId",
        sc.title_en as "categoryTitleEn",
        sc.title_hi as "categoryTitleHi",
        (pp.photo_data IS NOT NULL) as "hasPhoto"
      FROM users u
      JOIN provider_profiles pp ON u.id = pp.user_id
      JOIN service_categories sc ON pp.category_id = sc.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pp.rating DESC, u.created_at ASC
    `;

    const { rows } = await pool.query<{
      id: string;
      fullName: string | null;
      categoryId: string;
      categoryTitleEn: string;
      categoryTitleHi: string;
      hasPhoto: boolean;
    }>(query, values);

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName || 'Service Provider',
      categoryId: r.categoryId,
      categoryTitleEn: r.categoryTitleEn,
      categoryTitleHi: r.categoryTitleHi,
      isVerified: true,
      photoUrl: r.hasPhoto ? `/api/workers/${r.id}/photo` : null,
    }));
  }
}

export const workerService = new WorkerService();
