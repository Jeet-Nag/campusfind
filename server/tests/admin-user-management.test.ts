import { buildApp } from '../src/app';
import { db } from '../src/db';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';

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

async function runAdminUserManagementTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 15 ADMIN USER MANAGEMENT TESTS');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: Database pool unavailable.');
    process.exit(1);
  }

  // Apply migration 011 to test database
  await pool.query(`
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_test'
        ) THEN
            ALTER TABLE users ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
        END IF;
    END $$;

    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'is_test'
        ) THEN
            ALTER TABLE bookings ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_users_is_test ON users(is_test);
    CREATE INDEX IF NOT EXISTS idx_bookings_is_test ON bookings(is_test);
  `);

  // Dedicated test phone numbers for Module 15
  const adminPhone = '9800077001';
  const customerRealPhone = '9800077002';
  const customerTestPhone = '9800077003';
  const providerRealPhone = '9800077004';
  const providerTestPhone = '9800077005';
  const strangerPhone = '9800077006';
  const zeroBookingsPhone = '9800077007';

  const allTestPhones = [
    adminPhone,
    customerRealPhone,
    customerTestPhone,
    providerRealPhone,
    providerTestPhone,
    strangerPhone,
    zeroBookingsPhone,
  ];

  async function cleanupFixtures() {
    // 1. Delete logs and bookings for all test users
    await pool!.query(
      `DELETE FROM booking_status_logs 
       WHERE booking_id IN (
         SELECT id FROM bookings 
         WHERE customer_id IN (SELECT id FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%')
            OR provider_id IN (SELECT id FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%')
            OR idempotency_key LIKE 'mod15-%'
       )`,
      [allTestPhones]
    );

    await pool!.query(
      `DELETE FROM bookings 
       WHERE customer_id IN (SELECT id FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%')
          OR provider_id IN (SELECT id FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%')
          OR idempotency_key LIKE 'mod15-%'`,
      [allTestPhones]
    );

    // 2. Delete provider profiles, credentials, challenges
    await pool!.query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%')`,
      [allTestPhones]
    );

    await pool!.query(
      `DELETE FROM users WHERE phone = ANY($1) OR phone LIKE 'del_%'`,
      [allTestPhones]
    );
  }

  try {
    // 0. Pre-test cleanup
    await cleanupFixtures();

    // Ensure categories exist
    await pool.query(`
      INSERT INTO service_categories (id, title_en, title_hi, icon_name, base_visit_fee, is_active, sort_order)
      VALUES 
        ('electrician', 'Electrician', 'बिजली मिस्त्री', 'zap', 99.00, true, 1),
        ('plumber', 'Plumber', 'नल / प्लंबर', 'droplet', 99.00, true, 2)
      ON CONFLICT (id) DO NOTHING
    `);

    // 1. Seed Accounts
    // 1a. Admin
    const { rows: adminRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'admin', 'en', 'Super Admin', true, 1, false) RETURNING id`,
      [adminPhone]
    );
    const adminId = adminRows[0].id;
    const adminToken = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

    // 1b. Real Customer
    const { rows: custRealRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'customer', 'en', 'Real Customer', true, 1, false) RETURNING id`,
      [customerRealPhone]
    );
    const custRealId = custRealRows[0].id;
    const custRealToken = app.jwt.sign({ id: custRealId, phone: customerRealPhone, role: 'customer', tokenVersion: 1 });

    // 1c. Test Customer
    const { rows: custTestRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'customer', 'hi', 'Test Customer', true, 1, true) RETURNING id`,
      [customerTestPhone]
    );
    const custTestId = custTestRows[0].id;

    // 1d. Real Provider
    const { rows: provRealRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'provider', 'hi', 'Real Electrician', true, 1, false) RETURNING id`,
      [providerRealPhone]
    );
    const provRealId = provRealRows[0].id;
    const provRealToken = app.jwt.sign({ id: provRealId, phone: providerRealPhone, role: 'provider', tokenVersion: 1 });

    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, rating, verification_status)
       VALUES ($1, 'electrician', 'Chandil Bazar', true, 4.8, 'VERIFIED')`,
      [provRealId]
    );

    // 1e. Test Provider
    const { rows: provTestRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'provider', 'en', 'Test Plumber', true, 1, true) RETURNING id`,
      [providerTestPhone]
    );
    const provTestId = provTestRows[0].id;

    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, rating, verification_status)
       VALUES ($1, 'plumber', 'Station Colony', true, 4.5, 'PENDING_VERIFICATION')`,
      [provTestId]
    );

    // 1f. User with 0 bookings
    const { rows: zeroRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version, is_test)
       VALUES ($1, 'customer', 'en', 'Zero Booking User', true, 1, false) RETURNING id`,
      [zeroBookingsPhone]
    );
    const zeroBookingsId = zeroRows[0].id;

    console.log('--- 1. Database Schema & Migration 011 Verification ---');
    const { rows: usersCols } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_test'"
    );
    assert(usersCols.length === 1, 'Migration 011: is_test column exists on users table');

    const { rows: bookingsCols } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'is_test'"
    );
    assert(bookingsCols.length === 1, 'Migration 011: is_test column exists on bookings table');

    console.log('\n--- 2. Admin RBAC & Route Access Control ---');
    // 2a. Unauthenticated GET /api/admin/users rejected
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
    });
    assert(unauthRes.statusCode === 401, 'Unauthenticated request to GET /api/admin/users rejected with 401');

    // 2b. Customer token rejected with 403
    const custRbacRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { Authorization: `Bearer ${custRealToken}` },
    });
    assert(custRbacRes.statusCode === 403, 'Customer token to GET /api/admin/users rejected with 403 Forbidden');

    // 2c. Provider token rejected with 403
    const provRbacRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { Authorization: `Bearer ${provRealToken}` },
    });
    assert(provRbacRes.statusCode === 403, 'Provider token to GET /api/admin/users rejected with 403 Forbidden');

    // 2d. Admin token allowed
    const adminRbacRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRbacRes.statusCode === 200, 'Admin token to GET /api/admin/users succeeds with 200 OK');
    const userListBody = JSON.parse(adminRbacRes.payload);
    assert(userListBody.success === true, 'Response body success is true');
    assert(Array.isArray(userListBody.data.users), 'Response contains users array');

    console.log('\n--- 3. User Listing, Filtering, and Search ---');
    // List all
    const allUsers = userListBody.data.users;
    assert(allUsers.length >= 6, `Lists all registered users (found ${allUsers.length})`);

    // Check fields on a returned user
    const foundAdmin = allUsers.find((u: any) => u.id === adminId);
    assert(foundAdmin !== undefined, 'Admin user found in list');
    assert(foundAdmin.role === 'admin', 'Admin role is returned correctly');
    assert(foundAdmin.isTest === false, 'Real admin has isTest = false');
    assert(foundAdmin.bookingCounts !== undefined, 'User includes bookingCounts statistics');

    const foundProv = allUsers.find((u: any) => u.id === provRealId);
    assert(foundProv !== undefined, 'Provider user found in list');
    assert(foundProv.role === 'provider', 'Provider role is returned correctly');
    assert(foundProv.workerVerificationStatus === 'VERIFIED', 'Worker verification status is returned');

    // Filter by role = 'provider'
    const provFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?role=provider',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const provFilterBody = JSON.parse(provFilterRes.payload);
    assert(provFilterRes.statusCode === 200, 'Filter role=provider returns 200');
    assert(
      provFilterBody.data.users.every((u: any) => u.role === 'provider'),
      'Every returned user in role=provider filter is a provider'
    );

    // Filter by role = 'customer'
    const custFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?role=customer',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const custFilterBody = JSON.parse(custFilterRes.payload);
    assert(custFilterRes.statusCode === 200, 'Filter role=customer returns 200');
    assert(
      custFilterBody.data.users.every((u: any) => u.role === 'customer'),
      'Every returned user in role=customer filter is a customer'
    );

    // Filter by isTest = true
    const testFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?isTest=true',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const testFilterBody = JSON.parse(testFilterRes.payload);
    assert(testFilterRes.statusCode === 200, 'Filter isTest=true returns 200');
    assert(
      testFilterBody.data.users.every((u: any) => u.isTest === true),
      'Every returned user in isTest=true filter has isTest = true'
    );

    // Search by phone
    const searchPhoneRes = await app.inject({
      method: 'GET',
      url: `/api/admin/users?search=${customerRealPhone}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchPhoneBody = JSON.parse(searchPhoneRes.payload);
    assert(searchPhoneBody.data.users.length === 1, 'Search by exact phone returns exactly 1 user');
    assert(searchPhoneBody.data.users[0].id === custRealId, 'Returned user ID matches searched customer');

    // Search by name
    const searchNameRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?search=Super',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchNameBody = JSON.parse(searchNameRes.payload);
    assert(
      searchNameBody.data.users.some((u: any) => u.id === adminId),
      'Search by partial name returns matching user'
    );
    assert(
      searchNameBody.data.users.find((u: any) => u.id === adminId)?.fullName === 'Super Admin',
      'Returned matching user has name Super Admin'
    );

    console.log('\n--- 4. User Status Deactivation & Session Invalidation ---');
    // Get initial token_version of customer
    const { rows: custBefore } = await pool.query<{ token_version: number }>(
      'SELECT token_version FROM users WHERE id = $1',
      [custRealId]
    );
    const initialTokenVersion = custBefore[0].token_version;

    // Deactivate customer
    const deactRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${custRealId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    assert(deactRes.statusCode === 200, 'PATCH /api/admin/users/:id/status { isActive: false } returns 200');
    const deactBody = JSON.parse(deactRes.payload);
    assert(deactBody.data.user.isActive === false, 'Returned user isActive is false');

    // In DB: verify is_active = false and token_version incremented
    const { rows: custAfter } = await pool.query<{ is_active: boolean; token_version: number }>(
      'SELECT is_active, token_version FROM users WHERE id = $1',
      [custRealId]
    );
    assert(custAfter[0].is_active === false, 'User in database is_active is false');
    assert(
      custAfter[0].token_version === initialTokenVersion + 1,
      'User token_version incremented in database (+1)'
    );

    // Old JWT token of deactivated customer must now be rejected
    const revokedTokenRes = await app.inject({
      method: 'GET',
      url: '/api/bookings/my',
      headers: { Authorization: `Bearer ${custRealToken}` },
    });
    assert(
      revokedTokenRes.statusCode === 401,
      'Pre-existing token of deactivated user is immediately rejected with 401 (session revoked)'
    );

    // Reactivate customer
    const reactRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${custRealId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: true },
    });
    assert(reactRes.statusCode === 200, 'Reactivation returns 200 OK');
    const reactBody = JSON.parse(reactRes.payload);
    assert(reactBody.data.user.isActive === true, 'Returned user isActive is true again');

    console.log('\n--- 5. Admin Self-Deactivation & Self-Deletion Prevention ---');
    // Admin attempting to deactivate self
    const selfDeactRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${adminId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    assert(selfDeactRes.statusCode === 400, 'Self-deactivation rejected with 400 Bad Request');
    const selfDeactBody = JSON.parse(selfDeactRes.payload);
    assert(
      selfDeactBody.error.code === 'CANNOT_DEACTIVATE_SELF',
      'Error code is strictly CANNOT_DEACTIVATE_SELF'
    );

    // Admin attempting to delete self
    const selfDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${adminId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: adminPhone },
    });
    assert(selfDeleteRes.statusCode === 400, 'Self-deletion rejected with 400 Bad Request');
    const selfDeleteBody = JSON.parse(selfDeleteRes.payload);
    assert(
      selfDeleteBody.error.code === 'CANNOT_DELETE_SELF',
      'Error code is strictly CANNOT_DELETE_SELF'
    );

    console.log('\n--- 6. Active Booking Deletion Protection ---');
    // Create an active booking for Customer 1
    const { rows: activeBookingRows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ($1, $2, 'electrician', 'Chandil Bazar', 'SERVICE_REQUESTED', 99, 'CASH', false, false)
       RETURNING id`,
      ['mod15-active-booking-1', custRealId]
    );
    const activeBookingId = activeBookingRows[0].id;

    // Attempt to delete Customer 1 while active booking exists
    const deleteActiveRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${custRealId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: customerRealPhone },
    });
    assert(
      deleteActiveRes.statusCode === 400,
      'Deletion of user with active in-progress booking rejected with 400'
    );
    const deleteActiveBody = JSON.parse(deleteActiveRes.payload);
    assert(
      deleteActiveBody.error.code === 'ACTIVE_BOOKINGS_EXIST',
      'Error code is strictly ACTIVE_BOOKINGS_EXIST'
    );

    // Verify user still exists in database
    const { rows: stillExists } = await pool.query('SELECT id FROM users WHERE id = $1', [custRealId]);
    assert(stillExists.length === 1, 'User was protected and remains in database');

    console.log('\n--- 7. Phone Confirmation Validation ---');
    // Attempt deletion with mismatched phone number
    const mismatchRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${zeroBookingsId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: '9999999999' },
    });
    assert(mismatchRes.statusCode === 400, 'Mismatched phone confirmation rejected with 400');
    const mismatchBody = JSON.parse(mismatchRes.payload);
    assert(
      mismatchBody.error.code === 'PHONE_MISMATCH',
      'Error code is strictly PHONE_MISMATCH'
    );

    console.log('\n--- 8. Safe Test User Deletion (Cascades Test Bookings) ---');
    // Create a test booking and log for Customer 2 (Test Customer)
    const { rows: testBookingRows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ($1, $2, 'electrician', 'Station Colony', 'BOOKING_COMPLETED', 99, 'CASH', true, true)
       RETURNING id`,
      ['mod15-test-booking-1', custTestId]
    );
    const testBookingId = testBookingRows[0].id;

    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'BOOKING_COMPLETED', $2, 'Completed test job')`,
      [testBookingId, custTestId]
    );

    // Delete test user with correct phone
    const deleteTestUserRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${custTestId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: customerTestPhone },
    });
    assert(deleteTestUserRes.statusCode === 200, 'DELETE /api/admin/users/:id for test user returns 200 OK');
    const deleteTestUserBody = JSON.parse(deleteTestUserRes.payload);
    assert(deleteTestUserBody.data.deleted === true, 'Response deleted is true');
    assert(deleteTestUserBody.data.anonymized === false, 'Test user is fully deleted, not anonymized');

    // Verify test user and their test booking & logs are completely purged from DB
    const { rows: checkTestUser } = await pool.query('SELECT id FROM users WHERE id = $1', [custTestId]);
    assert(checkTestUser.length === 0, 'Test user row is completely removed from users table');

    const { rows: checkTestBooking } = await pool.query('SELECT id FROM bookings WHERE id = $1', [testBookingId]);
    assert(checkTestBooking.length === 0, 'Test booking is completely removed from bookings table');

    const { rows: checkTestLog } = await pool.query('SELECT id FROM booking_status_logs WHERE booking_id = $1', [testBookingId]);
    assert(checkTestLog.length === 0, 'Test status log is completely removed from booking_status_logs');

    console.log('\n--- 9. Real User Deletion with Completed Bookings (Audit Anonymization) ---');
    // Transition Customer 1's active booking to completed so deletion can proceed
    await pool.query(
      "UPDATE bookings SET status = 'BOOKING_COMPLETED', payment_collected = true WHERE id = $1",
      [activeBookingId]
    );

    // Delete Real Customer 1
    const deleteRealRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${custRealId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: customerRealPhone },
    });
    assert(deleteRealRes.statusCode === 200, 'DELETE /api/admin/users/:id for real user returns 200 OK');
    const deleteRealBody = JSON.parse(deleteRealRes.payload);
    assert(deleteRealBody.data.deleted === true, 'Response deleted is true');
    assert(deleteRealBody.data.anonymized === true, 'Real user with completed booking is GDPR-anonymized');

    // Verify anonymization in DB
    const { rows: anonymizedRows } = await pool.query<{ full_name: string; phone: string; is_active: boolean }>(
      'SELECT full_name, phone, is_active FROM users WHERE id = $1',
      [custRealId]
    );
    assert(anonymizedRows.length === 1, 'User row retained for FK integrity');
    assert(anonymizedRows[0].full_name === 'Deleted User', 'Full name replaced with "Deleted User"');
    assert(anonymizedRows[0].phone.startsWith('del_'), 'Phone number replaced with del_ prefix');
    assert(anonymizedRows[0].is_active === false, 'Account permanently set to is_active = false');

    // Verify historical booking is intact for audit ledger
    const { rows: auditBookingRows } = await pool.query(
      'SELECT id, status, visiting_fee FROM bookings WHERE id = $1',
      [activeBookingId]
    );
    assert(auditBookingRows.length === 1, 'Historical completed booking preserved intact for financial audit');

    // Test Real Provider Anonymization with Document Wiping
    const provDocPhone = '9800077089';
    allTestPhones.push(provDocPhone);
    const { rows: pDocUserRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'provider', 'hi', 'Ramesh Mistri', true, false) RETURNING id`,
      [provDocPhone]
    );
    const pDocUserId = pDocUserRows[0].id;

    await pool.query(
      `INSERT INTO provider_profiles (
         user_id, category_id, service_area, is_available, verification_status,
         aadhaar_front_data, aadhaar_front_mime, photo_data, photo_mime
       ) VALUES ($1, 'electrician', 'Chandil', true, 'VERIFIED', decode('1234', 'hex'), 'image/jpeg', decode('5678', 'hex'), 'image/jpeg')`,
      [pDocUserId]
    );

    await pool.query(
      `INSERT INTO bookings (
         idempotency_key, customer_id, provider_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ('mod15-prov-doc-audit', $1, $2, 'electrician', 'Chandil Bazar', 'BOOKING_COMPLETED', 99, 'CASH', true, false)`,
      [custRealId, pDocUserId]
    );

    const deleteProvRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${pDocUserId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: provDocPhone },
    });
    assert(deleteProvRes.statusCode === 200, 'DELETE real provider with historical bookings returns 200 OK without SQL errors');
    const deleteProvBody = JSON.parse(deleteProvRes.payload);
    assert(deleteProvBody.data.anonymized === true, 'Provider is anonymized');

    const { rows: pProfileCheck } = await pool.query(
      `SELECT aadhaar_front_data, aadhaar_front_mime, photo_data, photo_mime, is_available 
       FROM provider_profiles WHERE user_id = $1`,
      [pDocUserId]
    );
    assert(pProfileCheck.length === 1, 'Provider profile retained');
    assert(pProfileCheck[0].aadhaar_front_data === null, 'Provider aadhaar_front_data wiped to NULL');
    assert(pProfileCheck[0].photo_data === null, 'Provider photo_data wiped to NULL');
    assert(pProfileCheck[0].is_available === false, 'Provider is_available set to false');

    console.log('\n--- 10. Real User with 0 Bookings Deletion ---');
    const deleteZeroRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${zeroBookingsId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirmPhone: zeroBookingsPhone },
    });
    assert(deleteZeroRes.statusCode === 200, 'DELETE user with 0 bookings returns 200 OK');
    const deleteZeroBody = JSON.parse(deleteZeroRes.payload);
    assert(deleteZeroBody.data.deleted === true, 'Response deleted is true');
    assert(deleteZeroBody.data.anonymized === false, 'User with 0 bookings is cleanly deleted (not anonymized)');

    const { rows: checkZeroUser } = await pool.query('SELECT id FROM users WHERE id = $1', [zeroBookingsId]);
    assert(checkZeroUser.length === 0, 'User with 0 bookings is completely removed from DB');

    console.log('\n--- 11. Mark Test User Endpoint & Safety Guards ---');
    // Guard 1: Cannot mark admin as test
    const markAdminTestRes = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${adminId}/mark-test`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isTest: true },
    });
    assert(markAdminTestRes.statusCode === 400, 'Attempting to mark admin as test rejected with 400');
    const markAdminTestBody = JSON.parse(markAdminTestRes.payload);
    assert(markAdminTestBody.error.code === 'CANNOT_MARK_ADMIN_AS_TEST', 'Error code is CANNOT_MARK_ADMIN_AS_TEST');

    // Guard 2: Cannot mark user with active booking (e.g. SERVICE_COMPLETED) as test
    const { rows: activeCustRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ('9800077088', 'customer', 'en', 'Active Job Customer', true, false) RETURNING id`
    );
    const activeCustId = activeCustRows[0].id;
    allTestPhones.push('9800077088');

    await pool.query(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ('mod15-active-mark-test-block', $1, 'electrician', 'Chandil Bazar', 'SERVICE_COMPLETED', 99, 'CASH', false, false)`,
      [activeCustId]
    );

    const markActiveUserTestRes = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${activeCustId}/mark-test`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isTest: true },
    });
    assert(markActiveUserTestRes.statusCode === 400, 'Attempting to mark user with active booking (SERVICE_COMPLETED) as test rejected with 400');
    const markActiveUserTestBody = JSON.parse(markActiveUserTestRes.payload);
    assert(markActiveUserTestBody.error.code === 'ACTIVE_BOOKINGS_EXIST', 'Error code is ACTIVE_BOOKINGS_EXIST');

    // Mark real provider as test (when provider has no active bookings)
    const markTestRes = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${provRealId}/mark-test`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isTest: true },
    });
    assert(markTestRes.statusCode === 200, 'POST /api/admin/users/:id/mark-test returns 200 OK');
    const markTestBody = JSON.parse(markTestRes.payload);
    assert(markTestBody.data.user.isTest === true, 'User isTest updated to true');

    // Unmark
    const unmarkTestRes = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${provRealId}/mark-test`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isTest: false },
    });
    assert(unmarkTestRes.statusCode === 200, 'Unmark test user returns 200 OK');
    const unmarkTestBody = JSON.parse(unmarkTestRes.payload);
    assert(unmarkTestBody.data.user.isTest === false, 'User isTest updated back to false');

    console.log('\n--- 12. Safe Test Data Cleanup (Preview & Transactional Purge) ---');
    // Seed fresh test data for cleanup verification
    const cleanCustTestPhone = '9800077091';
    const cleanProvTestPhone = '9800077092';
    const cleanCustRealPhone = '9800077093';

    // 1. Seed Test Customer
    const { rows: tCustRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'customer', 'en', 'Cleanup Test Customer', true, true) RETURNING id`,
      [cleanCustTestPhone]
    );
    const tCustId = tCustRows[0].id;

    // 2. Seed Test Provider
    const { rows: tProvRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'provider', 'en', 'Cleanup Test Provider', true, true) RETURNING id`,
      [cleanProvTestPhone]
    );
    const tProvId = tProvRows[0].id;

    // 3. Seed Test Booking & Log
    const { rows: tBookRows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, provider_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ($1, $2, $3, 'electrician', 'Station Colony', 'BOOKING_COMPLETED', 99, 'CASH', true, true)
       RETURNING id`,
      ['mod15-cleanup-test-booking', tCustId, tProvId]
    );
    const tBookId = tBookRows[0].id;

    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'BOOKING_COMPLETED', $2, 'Cleanup test log')`,
      [tBookId, tCustId]
    );

    // 4. Seed Real Customer & Real Booking
    const { rows: rCustRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'customer', 'en', 'Real Customer Preserved', true, false) RETURNING id`,
      [cleanCustRealPhone]
    );
    const rCustId = rCustRows[0].id;

    const { rows: rBookRows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ($1, $2, 'electrician', 'Chandil Bazar', 'SERVICE_REQUESTED', 99, 'CASH', false, false)
       RETURNING id`,
      ['mod15-real-preserved-booking', rCustId]
    );
    const rBookId = rBookRows[0].id;

    // Check preview endpoint
    const previewRes = await app.inject({
      method: 'GET',
      url: '/api/admin/test-cleanup/preview',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(previewRes.statusCode === 200, 'GET /api/admin/test-cleanup/preview returns 200 OK');
    const previewBody = JSON.parse(previewRes.payload);
    assert(previewBody.data.testUsersCount >= 2, `Preview identifies test users (count: ${previewBody.data.testUsersCount})`);
    assert(previewBody.data.testBookingsCount >= 1, `Preview identifies test bookings (count: ${previewBody.data.testBookingsCount})`);
    assert(previewBody.data.canCleanup === true, 'Preview canCleanup is true');

    // Attempt execute with bad confirmation code
    const badCleanupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/test-cleanup/execute',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirm: 'WRONG_CODE' },
    });
    assert(badCleanupRes.statusCode === 400, 'Cleanup without exact code "CLEANUP" rejected with 400');
    const badCleanupBody = JSON.parse(badCleanupRes.payload);
    assert(
      badCleanupBody.error.code === 'INVALID_CONFIRMATION',
      'Error code is strictly INVALID_CONFIRMATION'
    );

    // Execute with correct confirmation
    const executeCleanupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/test-cleanup/execute',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirm: 'CLEANUP' },
    });
    assert(executeCleanupRes.statusCode === 200, 'POST /api/admin/test-cleanup/execute returns 200 OK');
    const executeCleanupBody = JSON.parse(executeCleanupRes.payload);
    assert(executeCleanupBody.data.deletedUsersCount >= 2, 'Reports deleted test users count');
    assert(executeCleanupBody.data.deletedBookingsCount >= 1, 'Reports deleted test bookings count');

    // Verify test data is gone
    const { rows: checkCleanedCust } = await pool.query('SELECT id FROM users WHERE id = $1', [tCustId]);
    assert(checkCleanedCust.length === 0, 'Test customer purged from DB');

    const { rows: checkCleanedProv } = await pool.query('SELECT id FROM users WHERE id = $1', [tProvId]);
    assert(checkCleanedProv.length === 0, 'Test provider purged from DB');

    const { rows: checkCleanedBook } = await pool.query('SELECT id FROM bookings WHERE id = $1', [tBookId]);
    assert(checkCleanedBook.length === 0, 'Test booking purged from DB');

    // CRITICAL: Verify Real Customer and Real Booking are 100% untouched!
    const { rows: checkPreservedCust } = await pool.query('SELECT id FROM users WHERE id = $1', [rCustId]);
    assert(checkPreservedCust.length === 1, 'CRITICAL: Real customer is 100% preserved in DB');

    const { rows: checkPreservedBook } = await pool.query('SELECT id FROM bookings WHERE id = $1', [rBookId]);
    assert(checkPreservedBook.length === 1, 'CRITICAL: Real booking is 100% preserved in DB');

    // Clean up temporary preserved real customer
    await pool.query('DELETE FROM bookings WHERE id = $1', [rBookId]);
    await pool.query('DELETE FROM users WHERE id = $1', [rCustId]);

    // Edge Case A & B: Test Customer with bookings.is_test = false AND Test Provider on Real Booking
    console.log('\n--- 12b. Edge Cases: Foreign-Key Invariants & Cross-Referenced Bookings ---');
    const edgeTestCustPhone = '9800077095';
    const edgeTestProvPhone = '9800077096';
    const edgeRealCustPhone = '9800077097';
    allTestPhones.push(edgeTestCustPhone, edgeTestProvPhone, edgeRealCustPhone);

    const { rows: ecRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'customer', 'en', 'Edge Test Cust', true, true) RETURNING id`,
      [edgeTestCustPhone]
    );
    const ecId = ecRows[0].id;

    const { rows: epRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'provider', 'en', 'Edge Test Prov', true, true) RETURNING id`,
      [edgeTestProvPhone]
    );
    const epId = epRows[0].id;

    const { rows: ercRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ($1, 'customer', 'en', 'Edge Real Cust', true, false) RETURNING id`,
      [edgeRealCustPhone]
    );
    const ercId = ercRows[0].id;

    // Booking 1: Test Customer with is_test = false (completed)
    const { rows: eb1Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ('mod15-edge-book-1', $1, 'electrician', 'Station Colony', 'BOOKING_COMPLETED', 99, 'CASH', true, false)
       RETURNING id`,
      [ecId]
    );
    const eb1Id = eb1Rows[0].id;

    // Booking 2: Real Customer with Test Provider (completed, is_test = false)
    const { rows: eb2Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         idempotency_key, customer_id, provider_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ('mod15-edge-book-2', $1, $2, 'electrician', 'Chandil Bazar', 'BOOKING_COMPLETED', 99, 'CASH', true, false)
       RETURNING id`,
      [ercId, epId]
    );
    const eb2Id = eb2Rows[0].id;

    // Execute cleanup
    const edgeCleanupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/test-cleanup/execute',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirm: 'CLEANUP' },
    });
    assert(edgeCleanupRes.statusCode === 200, 'Cleanup succeeds without foreign key violation when test customer booking has is_test = false');

    // Verify test customer and their booking are gone
    const { rows: checkEc } = await pool.query('SELECT id FROM users WHERE id = $1', [ecId]);
    assert(checkEc.length === 0, 'Test customer deleted cleanly');
    const { rows: checkEb1 } = await pool.query('SELECT id FROM bookings WHERE id = $1', [eb1Id]);
    assert(checkEb1.length === 0, 'Test customer booking purged despite having is_test = false');

    // Verify Real customer and their booking are 100% preserved, but provider_id is unlinked to NULL
    const { rows: checkEb2 } = await pool.query('SELECT id, provider_id FROM bookings WHERE id = $1', [eb2Id]);
    assert(checkEb2.length === 1, 'Real booking referencing test provider is preserved');
    assert(checkEb2[0].provider_id === null, 'Test provider cleanly unlinked (provider_id = null) without deleting real booking');

    // Edge Case C: Active Booking Blocks Cleanup
    const { rows: blockCustRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, is_test)
       VALUES ('9800077098', 'customer', 'en', 'Active Test Cust', true, true) RETURNING id`
    );
    const blockCustId = blockCustRows[0].id;
    allTestPhones.push('9800077098');

    await pool.query(
      `INSERT INTO bookings (
         idempotency_key, customer_id, category_id, area_locality, status, 
         visiting_fee, payment_method, payment_collected, is_test
       ) VALUES ('mod15-active-block-cleanup', $1, 'electrician', 'Chandil', 'SERVICE_REQUESTED', 99, 'CASH', false, true)`,
      [blockCustId]
    );

    const blockCleanupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/test-cleanup/execute',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { confirm: 'CLEANUP' },
    });
    assert(blockCleanupRes.statusCode === 400, 'Cleanup blocked with 400 when an active test booking exists');
    const blockCleanupBody = JSON.parse(blockCleanupRes.payload);
    assert(blockCleanupBody.error.code === 'ACTIVE_BOOKINGS_EXIST', 'Error code is ACTIVE_BOOKINGS_EXIST');

    // Clean up block test booking manually
    await pool.query('DELETE FROM bookings WHERE customer_id = $1', [blockCustId]);
    await pool.query('DELETE FROM users WHERE id = $1', [blockCustId]);
    await pool.query('DELETE FROM bookings WHERE id = $1', [eb2Id]);
    await pool.query('DELETE FROM users WHERE id = $1', [ercId]);

    // Check preview again
    const previewAfterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/test-cleanup/preview',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const previewAfterBody = JSON.parse(previewAfterRes.payload);
    assert(previewAfterBody.data.testUsersCount === 0, 'Post-cleanup preview reports 0 test users');
    assert(previewAfterBody.data.testBookingsCount === 0, 'Post-cleanup preview reports 0 test bookings');
    assert(previewAfterBody.data.canCleanup === false, 'Post-cleanup canCleanup is false');

    console.log('\n--- 13. Bilingual i18n Symmetry & Module 15 Dictionary Verification ---');
    const enKeys = Object.keys(en);
    const hiKeys = Object.keys(hi);
    assert(
      enKeys.length === hiKeys.length,
      `Matching dictionary sizes: ${enKeys.length} English, ${hiKeys.length} Hindi`
    );

    const module15Keys = [
      'admin.users',
      'admin.users_title',
      'admin.users_subtitle',
      'admin.manage_users_desc',
      'admin.users_search_placeholder',
      'admin.col_user',
      'admin.col_role',
      'admin.col_bookings_count',
      'admin.col_is_test',
      'admin.badge_test',
      'admin.badge_real',
      'admin.mark_as_test',
      'admin.mark_as_real',
      'admin.marking_test',
      'admin.mark_test_success',
      'admin.filter_role_all',
      'admin.filter_role_customer',
      'admin.filter_role_provider',
      'admin.filter_role_admin',
      'admin.filter_test_all',
      'admin.filter_test_only',
      'admin.filter_real_only',
      'admin.no_users_found',
      'admin.no_users_match',
      'admin.load_users_error',
      'admin.cannot_deactivate_self',
      'admin.cannot_delete_self',
      'admin.delete_user_btn',
      'admin.delete_user_modal_title',
      'admin.delete_user_warning',
      'admin.delete_phone_confirm_label',
      'admin.delete_phone_mismatch',
      'admin.confirm_delete_btn',
      'admin.deleting_user',
      'admin.user_deleted_success',
      'admin.delete_active_booking_error',
      'admin.user_deactivated_success',
      'admin.user_activated_success',
      'admin.deactivate_user_modal_title',
      'admin.deactivate_user_desc',
      'admin.test_cleanup_section_title',
      'admin.test_cleanup_section_desc',
      'admin.preview_cleanup_btn',
      'admin.execute_cleanup_btn',
      'admin.cleanup_modal_title',
      'admin.cleanup_modal_desc',
      'admin.cleanup_test_users_count',
      'admin.cleanup_test_bookings_count',
      'admin.cleanup_test_logs_count',
      'admin.cleanup_confirm_instruction',
      'admin.cleanup_confirm_placeholder',
      'admin.cleanup_confirm_btn',
      'admin.cleaning_up',
      'admin.cleanup_success',
      'admin.no_test_data_to_clean',
      'admin.bookings_active_label',
      'admin.bookings_completed_label',
      'admin.bookings_cancelled_label',
      'admin.bookings_total_label',
      'admin.cannot_mark_admin_as_test',
      'admin.mark_test_modal_title',
      'admin.mark_test_confirm_desc',
      'admin.mark_real_confirm_desc',
      'admin.confirm',
    ];

    for (const key of module15Keys) {
      assert(key in en, `EN: "${key}" is defined`);
      assert(key in hi, `HI: "${key}" is defined`);
      const hiVal = (hi as any)[key];
      const hasParenthetical = /\([A-Za-z0-9\s]+\)/.test(hiVal);
      assert(!hasParenthetical, `HI: "${key}" contains zero parenthetical English ("${hiVal}")`);
    }

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    failed++;
  } finally {
    await cleanupFixtures();
    await app.close();
  }

  console.log('\n============================================================');
  console.log(`ADMIN USER MANAGEMENT TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminUserManagementTests();
