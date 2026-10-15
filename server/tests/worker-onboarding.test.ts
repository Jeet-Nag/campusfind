import { buildApp } from '../src/app';
import { db } from '../src/db';
import { env } from '../src/config/env';
import { FastifyInstance } from 'fastify';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}`);
    failed++;
  }
}

// Helpers to create valid test image base64 data
function createValidJpegBase64(): string {
  // JPEG magic bytes: FF D8 FF E0
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const body = Buffer.alloc(256, 0xaa);
  return Buffer.concat([header, body]).toString('base64');
}

function createValidPngBase64(): string {
  // PNG magic bytes: 89 50 4E 47
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = Buffer.alloc(256, 0xbb);
  return Buffer.concat([header, body]).toString('base64');
}

function createValidWebpBase64(): string {
  // WebP magic bytes: RIFF .... WEBP
  const riff = Buffer.from('RIFF');
  const size = Buffer.from([0x00, 0x01, 0x00, 0x00]);
  const webp = Buffer.from('WEBP');
  const body = Buffer.alloc(256, 0xcc);
  return Buffer.concat([riff, size, webp, body]).toString('base64');
}

function createFakeImageBase64(): string {
  // Plain text pretending to be an image
  return Buffer.from('This is a text file, not an image!'.repeat(10)).toString('base64');
}

function createOversizedImageBase64(): string {
  // > 5 MB
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const hugeBody = Buffer.alloc(5.2 * 1024 * 1024, 0x55);
  return Buffer.concat([header, hugeBody]).toString('base64');
}

async function runWorkerOnboardingTestSuite() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - WORKER ONBOARDING & VERIFICATION SUITE');
  console.log('============================================================\n');

  let app: FastifyInstance | null = null;
  const pool = db.getPool();
  if (!pool) {
    console.error('[BLOCKER] Database pool is unavailable.');
    process.exit(1);
  }

  try {
    app = await buildApp({
      customEnv: { NODE_ENV: 'test', JWT_SECRET: 'test-worker-secret-key-1234567890' },
    });
    await app.ready();

    // ─── Test Identities Setup ───────────────────────────────────────────────
    const testAdminId = '00000000-0000-0000-0000-000000000a01';
    const testAdminPhone = '9999900001';

    const testWorker1Id = '00000000-0000-0000-0000-000000000a02';
    const testWorker1Phone = '9999900002';

    const testWorker2Id = '00000000-0000-0000-0000-000000000a03';
    const testWorker2Phone = '9999900003';

    const testCustomerId = '00000000-0000-0000-0000-000000000a04';
    const testCustomerPhone = '9999900004';

    // Cleanup previous runs
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
      testAdminPhone,
      testWorker1Phone,
      testWorker2Phone,
      testCustomerPhone,
    ]);

    // Insert Admin
    await pool.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, token_version)
       VALUES ($1, $2, 'Admin Tester', 'admin', 'en', true, 1)`,
      [testAdminId, testAdminPhone]
    );

    // Insert Worker 1 (initially customer role)
    await pool.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, token_version)
       VALUES ($1, $2, 'Worker One', 'customer', 'hi', true, 1)`,
      [testWorker1Id, testWorker1Phone]
    );

    // Insert Worker 2 (initially customer role)
    await pool.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, token_version)
       VALUES ($1, $2, 'Worker Two', 'customer', 'hi', true, 1)`,
      [testWorker2Id, testWorker2Phone]
    );

    // Insert Customer
    await pool.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, token_version)
       VALUES ($1, $2, 'Customer Ram', 'customer', 'hi', true, 1)`,
      [testCustomerId, testCustomerPhone]
    );

    // Generate valid JWT tokens
    const adminToken = app.jwt.sign({ id: testAdminId, phone: testAdminPhone, role: 'admin', tokenVersion: 1 });
    const worker1Token = app.jwt.sign({ id: testWorker1Id, phone: testWorker1Phone, role: 'customer', tokenVersion: 1 });
    const worker2Token = app.jwt.sign({ id: testWorker2Id, phone: testWorker2Phone, role: 'customer', tokenVersion: 1 });
    const customerToken = app.jwt.sign({ id: testCustomerId, phone: testCustomerPhone, role: 'customer', tokenVersion: 1 });

    // ─── A. Customer Full Name Required ──────────────────────────────────────
    console.log('--- A. Customer Full Name Required ---');
    // A.1: Customer registration without fullName is rejected (400)
    const noNameRes = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '9888877771', role: 'customer' },
    });
    assert(noNameRes.statusCode === 400, 'A.1 Customer registration without fullName is rejected with 400');
    assert(noNameRes.json().error.code === 'VALIDATION_ERROR', 'A.1 Returns VALIDATION_ERROR code');

    // A.2: Customer registration with blank fullName is rejected (400)
    const blankNameRes = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '9888877772', role: 'customer', fullName: '   ' },
    });
    assert(blankNameRes.statusCode === 400, 'A.2 Customer registration with blank fullName is rejected with 400');

    // A.3: Customer registration with flow="customer" and missing fullName rejected
    const flowCustomerNoNameRes = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '9888877773', flow: 'customer' },
    });
    assert(flowCustomerNoNameRes.statusCode === 400, 'A.3 flow=customer without fullName is rejected with 400');

    // A.4: Customer registration with valid fullName is accepted (200)
    const validCustomerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '9888877774', role: 'customer', fullName: 'Ramesh Verma' },
    });
    assert(validCustomerRes.statusCode === 200, 'A.4 Customer registration with valid fullName returns 200');

    // ─── B. Worker Onboarding Authentication ─────────────────────────────────
    console.log('\n--- B. Worker Onboarding Authentication ---');
    // B.1: Unauthenticated request to /api/worker/onboarding is rejected (401)
    const unauthOnboarding = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      payload: {
        fullName: 'Worker One',
        categoryId: 'electrician',
        aadhaarFrontBase64: createValidJpegBase64(),
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(unauthOnboarding.statusCode === 401, 'B.1 Unauthenticated onboarding request returns 401');

    // B.2: Unauthenticated request to /api/worker/status is rejected (401)
    const unauthStatus = await app.inject({
      method: 'GET',
      url: '/api/worker/status',
    });
    assert(unauthStatus.statusCode === 401, 'B.2 Unauthenticated status request returns 401');

    // ─── C. Worker Onboarding Validation ─────────────────────────────────────
    console.log('\n--- C. Worker Onboarding Validation ---');
    // C.1: Missing required fields (e.g. categoryId missing) rejected (400)
    const missingCatRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One',
        aadhaarFrontBase64: createValidJpegBase64(),
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(missingCatRes.statusCode === 400, 'C.1 Missing categoryId rejected with 400');

    // C.2: Non-existent category rejected (400 CATEGORY_NOT_FOUND)
    const badCatRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One',
        categoryId: 'non-existent-category-12345',
        aadhaarFrontBase64: createValidJpegBase64(),
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(badCatRes.statusCode === 400, 'C.2 Non-existent categoryId rejected with 400');
    assert(badCatRes.json().error.code === 'CATEGORY_NOT_FOUND', 'C.2 Returns CATEGORY_NOT_FOUND error code');

    // ─── E. Invalid MIME Rejected ────────────────────────────────────────────
    console.log('\n--- E. Invalid MIME Rejected ---');
    const badMimeRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One',
        categoryId: 'electrician',
        aadhaarFrontBase64: createValidJpegBase64(),
        aadhaarFrontMime: 'application/pdf', // Unsupported
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(badMimeRes.statusCode === 400, 'E.1 application/pdf MIME type rejected with 400');
    assert(badMimeRes.json().error.code === 'UNSUPPORTED_MIME_TYPE', 'E.1 Returns UNSUPPORTED_MIME_TYPE');

    // ─── F. Invalid Magic Bytes Rejected ─────────────────────────────────────
    console.log('\n--- F. Invalid Magic Bytes Rejected ---');
    const fakeImgRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One',
        categoryId: 'electrician',
        aadhaarFrontBase64: createFakeImageBase64(), // text claiming to be jpeg
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(fakeImgRes.statusCode === 400, 'F.1 Spoofed image header rejected with 400');
    assert(fakeImgRes.json().error.code === 'INVALID_IMAGE_MAGIC_BYTES', 'F.1 Returns INVALID_IMAGE_MAGIC_BYTES');

    // ─── G. Oversized Image Rejected ─────────────────────────────────────────
    console.log('\n--- G. Oversized Image Rejected ---');
    const oversizedRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One',
        categoryId: 'electrician',
        aadhaarFrontBase64: createOversizedImageBase64(), // > 5 MB
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidJpegBase64(),
        aadhaarBackMime: 'image/jpeg',
        photoBase64: createValidJpegBase64(),
        photoMime: 'image/jpeg',
      },
    });
    assert(oversizedRes.statusCode === 400, 'G.1 Oversized image (>5MB) rejected with 400');
    assert(oversizedRes.json().error.code === 'IMAGE_TOO_LARGE', 'G.1 Returns IMAGE_TOO_LARGE');

    // ─── D. Worker Starts as PENDING_VERIFICATION ────────────────────────────
    console.log('\n--- D. Worker Starts as PENDING_VERIFICATION ---');
    const validOnboardingRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1Token}` },
      payload: {
        fullName: 'Worker One Electrician',
        categoryId: 'electrician',
        aadhaarFrontBase64: createValidJpegBase64(),
        aadhaarFrontMime: 'image/jpeg',
        aadhaarBackBase64: createValidPngBase64(),
        aadhaarBackMime: 'image/png',
        photoBase64: createValidWebpBase64(),
        photoMime: 'image/webp',
      },
    });
    assert(validOnboardingRes.statusCode === 200, 'D.1 Valid onboarding submission returns 200 OK');
    const onboardingBody = validOnboardingRes.json();
    assert(onboardingBody.data.status === 'PENDING_VERIFICATION', 'D.1 Status is PENDING_VERIFICATION');

    // Check DB state: users.role MUST remain customer
    const { rows: userAfterSubmit } = await pool.query<{ role: string; full_name: string }>(
      'SELECT role, full_name FROM users WHERE id = $1',
      [testWorker1Id]
    );
    assert(userAfterSubmit[0].role === 'customer', 'D.2 User role strictly remains "customer" upon onboarding');
    assert(userAfterSubmit[0].full_name === 'Worker One Electrician', 'D.2 User full_name updated');

    // Check DB state: provider_profiles verification_status is PENDING_VERIFICATION
    const { rows: profileAfterSubmit } = await pool.query<{ verification_status: string }>(
      'SELECT verification_status FROM provider_profiles WHERE user_id = $1',
      [testWorker1Id]
    );
    assert(profileAfterSubmit[0].verification_status === 'PENDING_VERIFICATION', 'D.3 Profile status is PENDING_VERIFICATION');

    // Check GET /api/worker/status returns PENDING_VERIFICATION
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/worker/status',
      headers: { authorization: `Bearer ${worker1Token}` },
    });
    assert(statusRes.statusCode === 200, 'D.4 GET /api/worker/status returns 200');
    const statusBody = statusRes.json().data;
    assert(statusBody.status === 'PENDING_VERIFICATION', 'D.4 Status is PENDING_VERIFICATION');
    assert(statusBody.hasAadhaarFront === true, 'D.4 hasAadhaarFront is true');
    assert(statusBody.hasAadhaarBack === true, 'D.4 hasAadhaarBack is true');
    assert(statusBody.hasPhoto === true, 'D.4 hasPhoto is true');
    assert(statusBody.categoryId === 'electrician', 'D.4 categoryId is electrician');
    assert(statusBody.aadhaar_front_data === undefined, 'D.5 Aadhaar byte data is NOT exposed in status response');

    // ─── H & I & J & K: Aadhaar Document Security ───────────────────────────
    console.log('\n--- H, I, J, K. Aadhaar Document Security ---');
    // H. Aadhaar front admin-only access
    const adminAadhaarFront = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${testWorker1Id}/documents/aadhaar-front`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminAadhaarFront.statusCode === 200, 'H.1 Admin can access Aadhaar Front');
    assert(adminAadhaarFront.headers['content-type'] === 'image/jpeg', 'H.1 Content-Type is image/jpeg');

    // I. Aadhaar back admin-only access
    const adminAadhaarBack = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${testWorker1Id}/documents/aadhaar-back`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminAadhaarBack.statusCode === 200, 'I.1 Admin can access Aadhaar Back');
    assert(adminAadhaarBack.headers['content-type'] === 'image/png', 'I.1 Content-Type is image/png');

    // J. Customer cannot access Aadhaar
    const customerAadhaarRes = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${testWorker1Id}/documents/aadhaar-front`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(customerAadhaarRes.statusCode === 403, 'J.1 Customer access to Aadhaar is rejected with 403 Forbidden');

    // K. Worker cannot access another worker's Aadhaar (or even their own via admin route)
    const workerAadhaarRes = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${testWorker2Id}/documents/aadhaar-front`,
      headers: { authorization: `Bearer ${worker1Token}` },
    });
    assert(workerAadhaarRes.statusCode === 403, 'K.1 Worker access to Aadhaar endpoint is rejected with 403 Forbidden');

    // ─── Worker Photo Security (Pre-Verification) ───────────────────────────
    console.log('\n--- Worker Photo Security (Pending Worker) ---');
    // Worker can access their own photo while pending
    const selfPhotoRes = await app.inject({
      method: 'GET',
      url: `/api/workers/${testWorker1Id}/photo`,
      headers: { authorization: `Bearer ${worker1Token}` },
    });
    assert(selfPhotoRes.statusCode === 200, 'Worker can view their own photo while pending verification');

    // Admin can access worker photo
    const adminPhotoRes = await app.inject({
      method: 'GET',
      url: `/api/workers/${testWorker1Id}/photo`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminPhotoRes.statusCode === 200, 'Admin can view worker photo while pending verification');

    // Customer CANNOT access pending worker photo
    const customerPendingPhotoRes = await app.inject({
      method: 'GET',
      url: `/api/workers/${testWorker1Id}/photo`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(customerPendingPhotoRes.statusCode === 403, 'Customer CANNOT view photo of pending worker (403)');

    // ─── L & M & N: Customer Verified Workers Endpoint ───────────────────────
    console.log('\n--- L, M, N. Customer Verified Workers Endpoint ---');
    // L. Pending worker not returned by customer verified-workers endpoint
    const listBeforeVerify = await app.inject({
      method: 'GET',
      url: '/api/workers/verified',
    });
    assert(listBeforeVerify.statusCode === 200, 'GET /api/workers/verified returns 200');
    const workersBefore = listBeforeVerify.json().data.workers;
    const worker1InList = workersBefore.some((w: any) => w.id === testWorker1Id);
    assert(!worker1InList, 'L.1 Pending worker is NOT returned in customer verified workers list');

    // ─── O & P & Q & R: Admin Verification ──────────────────────────────────
    console.log('\n--- O, P, Q, R. Admin Verification ---');
    // O. Non-admin cannot verify worker
    const customerVerifyAttempt = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/verify`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(customerVerifyAttempt.statusCode === 403, 'O.1 Customer cannot verify worker (403 Forbidden)');

    const workerVerifyAttempt = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/verify`,
      headers: { authorization: `Bearer ${worker2Token}` },
    });
    assert(workerVerifyAttempt.statusCode === 403, 'O.2 Worker cannot verify worker (403 Forbidden)');

    // S. Customer cannot promote itself to provider
    const { rows: customerCheck } = await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [testCustomerId]);
    assert(customerCheck[0].role === 'customer', 'S.1 Customer remains customer role');

    // R. Incomplete worker profile cannot be verified
    // Create an incomplete worker profile (missing Aadhaar Back and Photo)
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, verification_status, aadhaar_front_data, aadhaar_front_mime)
       VALUES ($1, 'plumber', 'Chandil', 'PENDING_VERIFICATION', $2, 'image/jpeg')
       ON CONFLICT (user_id) DO NOTHING`,
      [testWorker2Id, Buffer.from('test_front_only')]
    );
    const incompleteVerifyRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker2Id}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(incompleteVerifyRes.statusCode === 400, 'R.1 Incomplete worker profile cannot be verified (400)');
    assert(incompleteVerifyRes.json().error.code === 'INCOMPLETE_PROFILE', 'R.1 Returns INCOMPLETE_PROFILE code');

    // P & Q. Admin can verify complete worker -> Atomic transaction updates status and role
    const verifySuccessRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(verifySuccessRes.statusCode === 200, 'P.1 Admin verifies complete worker successfully (200 OK)');
    const verifiedData = verifySuccessRes.json().data.provider;
    assert(verifiedData.verificationStatus === 'VERIFIED', 'Q.1 Returned provider verificationStatus is VERIFIED');
    assert(verifiedData.role === 'provider', 'Q.1 Returned provider role is provider');

    // Verify DB integrity after verification
    const { rows: dbWorkerAfter } = await pool.query<{
      role: string;
      verification_status: string;
      verified_by: string;
      verified_at: Date | null;
    }>(
      `SELECT u.role, pp.verification_status, pp.verified_by, pp.verified_at
       FROM users u
       JOIN provider_profiles pp ON u.id = pp.user_id
       WHERE u.id = $1`,
      [testWorker1Id]
    );
    assert(dbWorkerAfter[0].role === 'provider', 'Q.2 DB users.role upgraded to "provider"');
    assert(dbWorkerAfter[0].verification_status === 'VERIFIED', 'Q.2 DB verification_status set to "VERIFIED"');
    assert(dbWorkerAfter[0].verified_by === testAdminId, 'Q.2 verified_by records admin UUID');
    assert(dbWorkerAfter[0].verified_at !== null, 'Q.2 verified_at is populated');

    // ─── M & N: Customer Verified Workers (Post-Verification) ───────────────
    console.log('\n--- Customer Visibility & Photo Access Post-Verification ---');
    // M. Verified worker returned in customer verified workers list
    const listAfterVerify = await app.inject({
      method: 'GET',
      url: '/api/workers/verified',
    });
    const workersAfter = listAfterVerify.json().data.workers;
    const worker1Found = workersAfter.find((w: any) => w.id === testWorker1Id);
    assert(!!worker1Found, 'M.1 Verified worker is returned in customer verified workers list');
    assert(worker1Found.fullName === 'Worker One Electrician', 'M.1 Worker fullName matches');
    assert(worker1Found.categoryId === 'electrician', 'M.1 Worker category matches');
    assert(worker1Found.isVerified === true, 'M.1 Worker isVerified is true');
    assert(worker1Found.photoUrl === `/api/workers/${testWorker1Id}/photo`, 'M.1 photoUrl reference provided');
    assert(worker1Found.aadhaar_front_data === undefined, 'M.2 Zero Aadhaar data returned in customer list');
    assert(worker1Found.verified_by === undefined, 'M.2 Zero verified_by audit info returned in customer list');

    // Category filter test
    const categoryFilteredRes = await app.inject({
      method: 'GET',
      url: '/api/workers/verified?category_id=electrician',
    });
    assert(categoryFilteredRes.json().data.workers.length >= 1, 'Category filter matches electrician');

    const mismatchCategoryRes = await app.inject({
      method: 'GET',
      url: '/api/workers/verified?category_id=plumber',
    });
    const workerInWrongCat = mismatchCategoryRes.json().data.workers.some((w: any) => w.id === testWorker1Id);
    assert(!workerInWrongCat, 'Worker does not appear in unmatched category filter');

    // Now customer CAN access verified worker photo
    const customerVerifiedPhotoRes = await app.inject({
      method: 'GET',
      url: `/api/workers/${testWorker1Id}/photo`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(customerVerifiedPhotoRes.statusCode === 200, 'Customer can now access photo of VERIFIED worker (200)');
    assert(customerVerifiedPhotoRes.headers['content-type'] === 'image/webp', 'Photo served with correct Content-Type');

    // N. Inactive verified worker is NOT returned
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [testWorker1Id]);
    const listAfterDeactivate = await app.inject({
      method: 'GET',
      url: '/api/workers/verified',
    });
    const workerAfterDeact = listAfterDeactivate.json().data.workers.some((w: any) => w.id === testWorker1Id);
    assert(!workerAfterDeact, 'N.1 Inactive verified worker is NOT returned in customer list');

    // Photo of deactivated worker is not accessible to customer
    const photoDeactRes = await app.inject({
      method: 'GET',
      url: `/api/workers/${testWorker1Id}/photo`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(photoDeactRes.statusCode === 403, 'N.2 Photo of deactivated worker cannot be accessed by customer');

    // Restore active status
    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [testWorker1Id]);

    // ─── T. Existing RBAC & Admin Provider List Intactness ───────────────────
    console.log('\n--- T. Existing RBAC & Admin Provider List Intactness ---');
    // Admin providers list includes both verified and pending workers
    const adminProvidersList = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminProvidersList.statusCode === 200, 'T.1 Admin can list providers');
    const adminProviders = adminProvidersList.json().data.providers;
    const worker1InAdmin = adminProviders.find((p: any) => p.id === testWorker1Id);
    assert(!!worker1InAdmin, 'T.2 Verified worker appears in admin provider view');
    assert(worker1InAdmin.hasAadhaarFront === true, 'T.2 hasAadhaarFront flag visible to admin');
    assert(worker1InAdmin.hasAadhaarBack === true, 'T.2 hasAadhaarBack flag visible to admin');
    assert(worker1InAdmin.hasPhoto === true, 'T.2 hasPhoto flag visible to admin');
    assert(worker1InAdmin.verificationStatus === 'VERIFIED', 'T.2 verificationStatus is VERIFIED in admin view');

    // Filter by pending verification
    const pendingFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/providers?status=PENDING_VERIFICATION',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(pendingFilterRes.statusCode === 200, 'T.3 Admin can filter by PENDING_VERIFICATION');

    // ─── U. Worker Rejection & Partial Document Resubmission Workflow ────────
    console.log('\n--- U. Worker Rejection & Partial Document Resubmission Workflow ---');
    // U.1: Non-admin or unauthenticated cannot reject worker
    const unauthRejectRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/reject`,
      payload: { reason: 'Invalid documents' },
    });
    assert(unauthRejectRes.statusCode === 401, 'U.1 Unauthenticated reject returns 401 Unauthorized');

    const customerRejectRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/reject`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Invalid documents' },
    });
    assert(customerRejectRes.statusCode === 403, 'U.1 Customer reject attempt returns 403 Forbidden');

    // U.2: Validation on rejection reason (empty or > 500 chars)
    const emptyReasonRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: '   ' },
    });
    assert(emptyReasonRes.statusCode === 400, 'U.2 Empty rejection reason rejected with 400');
    assert(emptyReasonRes.json().error.code === 'VALIDATION_ERROR', 'U.2 Returns VALIDATION_ERROR');

    const longReasonRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'A'.repeat(501) },
    });
    assert(longReasonRes.statusCode === 400, 'U.2 Reason > 500 chars rejected with 400');

    // U.3: Successful admin rejection
    const rejectReasonText = 'Aadhaar front is blurry. Please upload a clear photo.';
    const validRejectRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: rejectReasonText },
    });
    assert(validRejectRes.statusCode === 200, 'U.3 Admin rejects worker -> 200 OK');
    assert(validRejectRes.json().success === true, 'U.3 Success is true');
    assert(validRejectRes.json().data.provider.verificationStatus === 'REJECTED', 'U.3 Response status is REJECTED');

    // Verify DB columns
    const { rows: rejectedProfileRows } = await pool.query<{
      verification_status: string;
      rejection_reason: string;
      rejected_at: Date;
      rejected_by: string;
    }>(
      'SELECT verification_status, rejection_reason, rejected_at, rejected_by FROM provider_profiles WHERE user_id = $1',
      [testWorker1Id]
    );
    assert(rejectedProfileRows[0].verification_status === 'REJECTED', 'U.3 DB verification_status is REJECTED');
    assert(rejectedProfileRows[0].rejection_reason === rejectReasonText, 'U.3 DB rejection_reason matches');
    assert(rejectedProfileRows[0].rejected_at !== null, 'U.3 DB rejected_at is populated');
    assert(rejectedProfileRows[0].rejected_by === testAdminId, 'U.3 DB rejected_by is admin ID');

    // Verify role demoted and token_version incremented
    const { rows: demotedUserRows } = await pool.query<{
      role: string;
      token_version: number;
    }>('SELECT role, token_version FROM users WHERE id = $1', [testWorker1Id]);
    assert(demotedUserRows[0].role === 'customer', 'U.3 User role demoted to customer on rejection');
    assert(demotedUserRows[0].token_version === 2, 'U.3 token_version incremented on rejection');

    // U.4: Token revocation check - old token rejected with 401
    const oldTokenStatusRes = await app.inject({
      method: 'GET',
      url: '/api/worker/status',
      headers: { authorization: `Bearer ${worker1Token}` },
    });
    assert(oldTokenStatusRes.statusCode === 401, 'U.4 Old JWT token rejected with 401 after token_version increment');

    // U.5: Fresh token for rejected worker can check status
    const worker1FreshToken = app.jwt.sign({
      id: testWorker1Id,
      phone: testWorker1Phone,
      role: 'customer',
      tokenVersion: 2,
    });
    const freshStatusRes = await app.inject({
      method: 'GET',
      url: '/api/worker/status',
      headers: { authorization: `Bearer ${worker1FreshToken}` },
    });
    assert(freshStatusRes.statusCode === 200, 'U.5 Worker status returns 200 with fresh token');
    const freshStatusData = freshStatusRes.json().data;
    assert(freshStatusData.status === 'REJECTED', 'U.5 Status is REJECTED');
    assert(freshStatusData.rejectionReason === rejectReasonText, 'U.5 rejectionReason matches');
    assert(freshStatusData.rejectedAt !== null, 'U.5 rejectedAt is populated');
    assert(freshStatusData.hasAadhaarFront === true, 'U.5 hasAadhaarFront is true');
    assert(freshStatusData.hasAadhaarBack === true, 'U.5 hasAadhaarBack is true');
    assert(freshStatusData.hasPhoto === true, 'U.5 hasPhoto is true');
    assert(freshStatusData.fullName === 'Worker One Electrician', 'U.5 fullName is returned');

    // Rejected worker does NOT appear in customer verified list
    const customerListAfterReject = await app.inject({
      method: 'GET',
      url: '/api/workers/verified',
    });
    const workerInCustList = customerListAfterReject.json().data.workers.some((w: any) => w.id === testWorker1Id);
    assert(!workerInCustList, 'U.5 Rejected worker does NOT appear in customer verified list');

    // Admin can list rejected workers
    const adminRejectedList = await app.inject({
      method: 'GET',
      url: '/api/admin/providers?status=REJECTED',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminRejectedList.statusCode === 200, 'U.5 Admin can filter by status=REJECTED');
    const rejectedProv = adminRejectedList.json().data.providers.find((p: any) => p.id === testWorker1Id);
    assert(!!rejectedProv, 'U.5 Rejected worker found in admin filter');
    assert(rejectedProv.rejectionReason === rejectReasonText, 'U.5 rejectionReason exposed in admin view');

    // U.6: Partial resubmission - Worker submits ONLY new Aadhaar Front
    // Replace with a new PNG image
    const newAadhaarFrontBase64 = createValidPngBase64();
    const resubmitRes = await app.inject({
      method: 'POST',
      url: '/api/worker/onboarding',
      headers: { authorization: `Bearer ${worker1FreshToken}` },
      payload: {
        fullName: 'Worker One Corrected',
        categoryId: 'electrician',
        aadhaarFrontBase64: newAadhaarFrontBase64,
        aadhaarFrontMime: 'image/png',
        // aadhaarBack and photo omitted!
      },
    });
    assert(resubmitRes.statusCode === 200, 'U.6 Partial resubmission returns 200 OK');
    assert(resubmitRes.json().success === true, 'U.6 Resubmission success is true');
    assert(resubmitRes.json().data.status === 'PENDING_VERIFICATION', 'U.6 Status transitions to PENDING_VERIFICATION');

    // Verify DB state after resubmission
    const { rows: resubProfileRows } = await pool.query<{
      verification_status: string;
      rejection_reason: string | null;
      rejected_at: Date | null;
      rejected_by: string | null;
      aadhaar_front_mime: string;
      has_back: boolean;
      has_photo: boolean;
    }>(
      `SELECT
         verification_status, rejection_reason, rejected_at, rejected_by,
         aadhaar_front_mime,
         (aadhaar_back_data IS NOT NULL) as has_back,
         (photo_data IS NOT NULL) as has_photo
       FROM provider_profiles WHERE user_id = $1`,
      [testWorker1Id]
    );
    assert(resubProfileRows[0].verification_status === 'PENDING_VERIFICATION', 'U.6 DB verification_status is PENDING_VERIFICATION');
    assert(resubProfileRows[0].rejection_reason === null, 'U.6 DB rejection_reason cleared to NULL');
    assert(resubProfileRows[0].rejected_at === null, 'U.6 DB rejected_at cleared to NULL');
    assert(resubProfileRows[0].rejected_by === null, 'U.6 DB rejected_by cleared to NULL');
    assert(resubProfileRows[0].aadhaar_front_mime === 'image/png', 'U.6 New Aadhaar Front updated to image/png');
    assert(resubProfileRows[0].has_back === true, 'U.6 Existing Aadhaar Back preserved intact');
    assert(resubProfileRows[0].has_photo === true, 'U.6 Existing Photo preserved intact');

    // U.7: Worker status after resubmission
    const afterResubStatus = await app.inject({
      method: 'GET',
      url: '/api/worker/status',
      headers: { authorization: `Bearer ${worker1FreshToken}` },
    });
    assert(afterResubStatus.statusCode === 200, 'U.7 Status returns 200 after resubmission');
    assert(afterResubStatus.json().data.status === 'PENDING_VERIFICATION', 'U.7 Status is PENDING_VERIFICATION');
    assert(afterResubStatus.json().data.rejectionReason === null, 'U.7 rejectionReason is null');

    // U.8: Admin re-review and approval
    const approveResubRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${testWorker1Id}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(approveResubRes.statusCode === 200, 'U.8 Admin approves resubmitted worker -> 200 OK');
    assert(approveResubRes.json().data.provider.verificationStatus === 'VERIFIED', 'U.8 Status is VERIFIED');
    assert(approveResubRes.json().data.provider.role === 'provider', 'U.8 Role is provider');

    const { rows: finalProfileRows } = await pool.query<{
      verification_status: string;
      rejection_reason: string | null;
      verified_by: string;
    }>('SELECT verification_status, rejection_reason, verified_by FROM provider_profiles WHERE user_id = $1', [testWorker1Id]);
    assert(finalProfileRows[0].verification_status === 'VERIFIED', 'U.8 DB status is VERIFIED');
    assert(finalProfileRows[0].rejection_reason === null, 'U.8 DB rejection_reason remains NULL');
    assert(finalProfileRows[0].verified_by === testAdminId, 'U.8 DB verified_by is admin ID');

    // Cleanup test users
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
      testAdminPhone,
      testWorker1Phone,
      testWorker2Phone,
      testCustomerPhone,
    ]);

    console.log('\n============================================================');
    console.log(`WORKER ONBOARDING SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED.`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (app) await app.close();
  }
}

runWorkerOnboardingTestSuite().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
