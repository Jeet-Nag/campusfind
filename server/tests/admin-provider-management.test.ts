import { buildApp } from '../src/app';
import { db } from '../src/db';
import { env } from '../src/config/env';

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

async function runAdminProviderTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 12B ADMIN PROVIDER MANAGEMENT');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: Database pool unavailable.');
    process.exit(1);
  }

  // Dedicated test phone numbers for Module 12B
  const adminPhone = '9800055001';
  const customerPhone = '9800055002';
  const existingProviderPhone = '9800055003';
  const newProviderPhone = '9800055004';
  const deactProviderPhone = '9800055005';
  const conflictProviderPhone = '9800055006';

  const allTestPhones = [
    adminPhone,
    customerPhone,
    existingProviderPhone,
    newProviderPhone,
    deactProviderPhone,
    conflictProviderPhone,
  ];

  const inactiveCategoryId = 'test-inactive-cat';

  async function cleanupFixtures() {
    // 1. Clean bookings and logs
    await pool!.query(
      `DELETE FROM booking_status_logs 
       WHERE booking_id IN (SELECT id FROM bookings WHERE idempotency_key LIKE 'adm-prov-%')`
    );
    await pool!.query(
      `DELETE FROM bookings WHERE idempotency_key LIKE 'adm-prov-%'`
    );

    // 3. Clean provider profiles and users
    await pool!.query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))`,
      [allTestPhones]
    );
    await pool!.query('DELETE FROM users WHERE phone = ANY($1)', [allTestPhones]);

    // 4. Clean inactive test category
    await pool!.query('DELETE FROM service_categories WHERE id = $1', [inactiveCategoryId]);
  }

  try {
    // Pre-test cleanup
    await cleanupFixtures();

    // 0. Seed Inactive Test Category
    await pool.query(
      `INSERT INTO service_categories (id, title_en, title_hi, icon_name, is_active, sort_order)
       VALUES ($1, 'Inactive Category', 'निष्क्रिय श्रेणी', 'tool', false, 999)
       ON CONFLICT (id) DO UPDATE SET is_active = false`,
      [inactiveCategoryId]
    );

    // 1. Seed Base Users: Admin, Customer, and Existing Provider
    const { rows: adminRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'admin', 'en', 'Admin Staff', true, 1) RETURNING id`,
      [adminPhone]
    );
    const adminId = adminRows[0].id;
    const adminToken = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

    const { rows: customerRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'customer', 'hi', 'Ravi Customer', true, 1) RETURNING id`,
      [customerPhone]
    );
    const customerId = customerRows[0].id;
    const customerToken = app.jwt.sign({ id: customerId, phone: customerPhone, role: 'customer', tokenVersion: 1 });

    const { rows: providerRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'provider', 'hi', 'Gopal Electrician', true, 1) RETURNING id`,
      [existingProviderPhone]
    );
    const existingProviderId = providerRows[0].id;
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, rating)
       VALUES ($1, 'electrician', 'Chandil', true, 4.80)`,
      [existingProviderId]
    );
    const existingProviderToken = app.jwt.sign({
      id: existingProviderId,
      phone: existingProviderPhone,
      role: 'provider',
      tokenVersion: 1,
    });

    console.log('--- A. Server-Side RBAC Boundaries ---');

    // A.1 GET /api/admin/providers
    const unauthGet = await app.inject({ method: 'GET', url: '/api/admin/providers' });
    assert(unauthGet.statusCode === 401, 'GET list unauthenticated -> 401');

    const customerGet = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerGet.statusCode === 403, 'GET list customer -> 403');

    const providerGet = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${existingProviderToken}` },
    });
    assert(providerGet.statusCode === 403, 'GET list provider -> 403');

    const adminGet = await app.inject({
      method: 'GET',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminGet.statusCode === 200, 'GET list admin -> 200');

    // A.2 POST /api/admin/providers
    const unauthPost = await app.inject({ method: 'POST', url: '/api/admin/providers', payload: {} });
    assert(unauthPost.statusCode === 401, 'POST unauthenticated -> 401');

    const customerPost = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: {},
    });
    assert(customerPost.statusCode === 403, 'POST customer -> 403');

    const providerPost = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${existingProviderToken}` },
      payload: {},
    });
    assert(providerPost.statusCode === 403, 'POST provider -> 403');

    // A.3 PATCH /api/admin/providers/:id
    const unauthPatch = await app.inject({ method: 'PATCH', url: `/api/admin/providers/${existingProviderId}`, payload: {} });
    assert(unauthPatch.statusCode === 401, 'PATCH unauthenticated -> 401');

    const customerPatch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${existingProviderId}`,
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: {},
    });
    assert(customerPatch.statusCode === 403, 'PATCH customer -> 403');

    const providerPatch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${existingProviderId}`,
      headers: { Authorization: `Bearer ${existingProviderToken}` },
      payload: {},
    });
    assert(providerPatch.statusCode === 403, 'PATCH provider -> 403');

    // A.4 POST /api/admin/providers/:id/status
    const unauthStatus = await app.inject({ method: 'POST', url: `/api/admin/providers/${existingProviderId}/status`, payload: { isActive: false } });
    assert(unauthStatus.statusCode === 401, 'POST status unauthenticated -> 401');

    const customerStatus = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${existingProviderId}/status`,
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { isActive: false },
    });
    assert(customerStatus.statusCode === 403, 'POST status customer -> 403');

    const providerStatus = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${existingProviderId}/status`,
      headers: { Authorization: `Bearer ${existingProviderToken}` },
      payload: { isActive: false },
    });
    assert(providerStatus.statusCode === 403, 'POST status provider -> 403');

    console.log('\n--- B. Provider Listing & Filtering ---');

    const listBody = JSON.parse(adminGet.payload);
    assert(listBody.success === true, 'Admin list response success is true');
    assert(Array.isArray(listBody.data.providers), 'Providers is an array');
    assert(listBody.data.providers.length >= 1, 'Contains at least seeded provider');

    // B.1 Only provider-role users appear (admin and customer omitted)
    const hasAdminOrCustomer = listBody.data.providers.some(
      (p: any) => p.role !== 'provider' || p.phone === adminPhone || p.phone === customerPhone
    );
    assert(!hasAdminOrCustomer, 'Only users with role="provider" appear in listing');

    // B.2 Category details returned
    const seededProv = listBody.data.providers.find((p: any) => p.id === existingProviderId);
    assert(seededProv !== undefined, 'Seeded provider found in listing');
    assert(seededProv.categoryId === 'electrician', 'Category ID matches electrician');
    assert(typeof seededProv.categoryTitleEn === 'string', 'categoryTitleEn is present');
    assert(typeof seededProv.categoryTitleHi === 'string', 'categoryTitleHi is present');
    assert(seededProv.serviceArea === 'Chandil', 'Service area matches Chandil');

    // B.3 is_active filter
    const activeFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/providers?is_active=true',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const activeFilterBody = JSON.parse(activeFilterRes.payload);
    assert(activeFilterBody.data.providers.every((p: any) => p.isActive === true), 'is_active=true filter returns only active providers');

    // B.4 category_id filter
    const catFilterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/providers?category_id=electrician',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catFilterBody = JSON.parse(catFilterRes.payload);
    assert(catFilterBody.data.providers.every((p: any) => p.categoryId === 'electrician'), 'category_id=electrician filter works');

    // B.5 Deterministic ordering
    const sorted = [...listBody.data.providers].sort((a: any, b: any) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
    });
    assert(
      JSON.stringify(listBody.data.providers.map((p: any) => p.id)) === JSON.stringify(sorted.map((p: any) => p.id)),
      'Listing has deterministic ordering (createdAt DESC, id DESC)'
    );

    console.log('\n--- C. Provider Detail ---');

    // C.1 Valid provider ID -> 200
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${existingProviderId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(detailRes.statusCode === 200, 'Valid provider ID -> 200 OK');
    const detailBody = JSON.parse(detailRes.payload);
    assert(detailBody.data.provider.id === existingProviderId, 'Detail ID matches requested ID');
    assert(detailBody.data.provider.phone === existingProviderPhone, 'Detail phone matches');
    assert(detailBody.data.provider.rating === 4.8, 'Rating returned as number');

    // C.2 Invalid UUID -> 400 INVALID_ID
    const badIdRes = await app.inject({
      method: 'GET',
      url: '/api/admin/providers/not-a-valid-uuid',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(badIdRes.statusCode === 400, 'Invalid UUID -> 400');
    const badIdBody = JSON.parse(badIdRes.payload);
    assert(badIdBody.error.code === 'INVALID_ID', 'Error code is INVALID_ID');

    // C.3 Unknown ID -> 404 PROVIDER_NOT_FOUND
    const unknownIdRes = await app.inject({
      method: 'GET',
      url: '/api/admin/providers/00000000-0000-0000-0000-000000000000',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(unknownIdRes.statusCode === 404, 'Unknown ID -> 404');
    const unknownIdBody = JSON.parse(unknownIdRes.payload);
    assert(unknownIdBody.error.code === 'PROVIDER_NOT_FOUND', 'Error code is PROVIDER_NOT_FOUND');

    // C.4 Customer/Admin ID cannot be treated as provider -> 404
    const customerAsProvRes = await app.inject({
      method: 'GET',
      url: `/api/admin/providers/${customerId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(customerAsProvRes.statusCode === 404, 'Customer ID requested as provider -> 404 PROVIDER_NOT_FOUND');

    console.log('\n--- D. Provider Creation & Validation ---');

    // D.1 Valid creation -> 201
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: newProviderPhone,
        fullName: 'Suraj Plumber',
        categoryId: 'plumber',
        preferredLanguage: 'hi',
        serviceArea: 'Station Colony',
      },
    });
    assert(createRes.statusCode === 201, 'Valid admin provider creation -> 201 Created');
    const createBody = JSON.parse(createRes.payload);
    assert(createBody.success === true, 'Creation response has success: true');
    const createdProv = createBody.data.provider;
    assert(createdProv.phone === newProviderPhone, 'Created phone matches');
    assert(createdProv.fullName === 'Suraj Plumber', 'Created fullName matches');
    assert(createdProv.categoryId === 'plumber', 'Created category matches plumber');
    assert(createdProv.serviceArea === 'Station Colony', 'Created serviceArea matches');
    assert(createdProv.isActive === true, 'Created provider is active');
    assert(createdProv.isAvailable === true, 'Created provider is available');

    // Verify in database directly
    const { rows: dbUsers } = await pool.query(
      'SELECT role, is_active, token_version FROM users WHERE id = $1',
      [createdProv.id]
    );
    assert(dbUsers[0].role === 'provider', 'Database users.role is strictly "provider"');
    assert(dbUsers[0].is_active === true, 'Database users.is_active is true');
    assert(dbUsers[0].token_version === 1, 'Database users.token_version is 1');

    const { rows: dbProfiles } = await pool.query(
      'SELECT category_id, service_area, is_available, rating FROM provider_profiles WHERE user_id = $1',
      [createdProv.id]
    );
    assert(dbProfiles.length === 1, 'Database provider_profiles row created');
    assert(dbProfiles[0].category_id === 'plumber', 'Database category_id is plumber');
    assert(dbProfiles[0].is_available === true, 'Database is_available is true');

    // D.2 Invalid phone format -> 400
    const badPhoneRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: '12345',
        fullName: 'Bad Phone',
        categoryId: 'plumber',
      },
    });
    assert(badPhoneRes.statusCode === 400, 'Invalid phone format -> 400');
    assert(JSON.parse(badPhoneRes.payload).error.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // D.3 Invalid name -> 400
    const emptyNameRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: '9800055099',
        fullName: '   ',
        categoryId: 'plumber',
      },
    });
    assert(emptyNameRes.statusCode === 400, 'Blank fullName -> 400 VALIDATION_ERROR');

    // D.4 Non-existent category -> 400 CATEGORY_NOT_FOUND
    const badCatRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: '9800055098',
        fullName: 'Bad Category',
        categoryId: 'non-existent-cat',
      },
    });
    assert(badCatRes.statusCode === 400, 'Non-existent category -> 400');
    assert(JSON.parse(badCatRes.payload).error.code === 'CATEGORY_NOT_FOUND', 'Error code is CATEGORY_NOT_FOUND');

    // D.5 Inactive category -> 400 CATEGORY_NOT_FOUND
    const inactiveCatRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: '9800055097',
        fullName: 'Inactive Cat Tech',
        categoryId: inactiveCategoryId,
      },
    });
    assert(inactiveCatRes.statusCode === 400, 'Inactive category rejected -> 400 CATEGORY_NOT_FOUND');
    assert(JSON.parse(inactiveCatRes.payload).error.code === 'CATEGORY_NOT_FOUND', 'Error code is CATEGORY_NOT_FOUND');

    // D.6 Duplicate phone -> 409 PHONE_ALREADY_REGISTERED
    const dupPhoneRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: newProviderPhone,
        fullName: 'Duplicate Provider',
        categoryId: 'plumber',
      },
    });
    assert(dupPhoneRes.statusCode === 409, 'Duplicate phone -> 409 Conflict');
    assert(JSON.parse(dupPhoneRes.payload).error.code === 'PHONE_ALREADY_REGISTERED', 'Error code is PHONE_ALREADY_REGISTERED');

    // Existing user not modified by duplicate phone failure
    const { rows: verifyUnchanged } = await pool.query('SELECT full_name FROM users WHERE phone = $1', [newProviderPhone]);
    assert(verifyUnchanged[0].full_name === 'Suraj Plumber', 'Existing user unmodified after duplicate phone rejection');

    // D.7 Client cannot force server-controlled fields
    const tamperRes = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: '9800055096',
        fullName: 'Tamper Tester',
        categoryId: 'plumber',
        role: 'admin',
        isActive: false,
        tokenVersion: 99,
        rating: 1.0,
      },
    });
    assert(tamperRes.statusCode === 400, 'Client attempt to supply role/isActive/tokenVersion rejected with 400 (strict validation)');

    // D.8 Newly provisioned provider has role=provider and can request passkey registration
    const provRegOptions = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: newProviderPhone },
    });
    assert(provRegOptions.statusCode === 200, 'Provisioned provider requests passkey options successfully');
    const { rows: provUserRows } = await pool.query('SELECT id, role, token_version FROM users WHERE phone = $1', [newProviderPhone]);
    assert(provUserRows.length === 1, 'Provider user exists in DB');
    assert(provUserRows[0].role === 'provider', 'Provisioned provider role is strictly "provider"');
    const newProvToken = app.jwt.sign(
      { id: provUserRows[0].id, phone: newProviderPhone, role: 'provider', tokenVersion: provUserRows[0].token_version },
      { expiresIn: '30d' }
    );

    // Verify provider can access provider feed
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/provider/jobs',
      headers: { Authorization: `Bearer ${newProvToken}` },
    });
    assert(feedRes.statusCode === 200, 'Provisioned provider can access provider job feed');

    console.log('\n--- E. Provider Update (PATCH) ---');

    // E.1 Update full name, category, language, service area
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${createdProv.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        fullName: 'Suraj Master Plumber',
        categoryId: 'electrician',
        preferredLanguage: 'en',
        serviceArea: 'Dam Road',
      },
    });
    assert(patchRes.statusCode === 200, 'PATCH provider -> 200 OK');
    const patchBody = JSON.parse(patchRes.payload);
    assert(patchBody.data.provider.fullName === 'Suraj Master Plumber', 'Full name updated');
    assert(patchBody.data.provider.categoryId === 'electrician', 'Category updated to electrician');
    assert(patchBody.data.provider.preferredLanguage === 'en', 'Language updated to en');
    assert(patchBody.data.provider.serviceArea === 'Dam Road', 'Service area updated to Dam Road');
    assert(patchBody.data.provider.phone === newProviderPhone, 'Phone number remains strictly unchanged');

    // E.2 Reject invalid category in PATCH
    const patchBadCat = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${createdProv.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { categoryId: 'non-existent' },
    });
    assert(patchBadCat.statusCode === 400, 'PATCH with non-existent category -> 400 CATEGORY_NOT_FOUND');

    // E.3 Reject inactive category in PATCH
    const patchInactiveCat = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${createdProv.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { categoryId: inactiveCategoryId },
    });
    assert(patchInactiveCat.statusCode === 400, 'PATCH with inactive category -> 400 CATEGORY_NOT_FOUND');

    // E.4 Reject phone update in PATCH
    const patchPhone = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${createdProv.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { phone: '9800055088' },
    });
    assert(patchPhone.statusCode === 400, 'Attempt to update phone rejected with 400 (strict validation)');

    // E.5 Reject role update in PATCH
    const patchRole = await app.inject({
      method: 'PATCH',
      url: `/api/admin/providers/${createdProv.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { role: 'admin' },
    });
    assert(patchRole.statusCode === 400, 'Attempt to update role rejected with 400 (strict validation)');

    // E.6 PATCH non-existent provider -> 404
    const patchMissing = await app.inject({
      method: 'PATCH',
      url: '/api/admin/providers/00000000-0000-0000-0000-000000000000',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { fullName: 'Nobody' },
    });
    assert(patchMissing.statusCode === 404, 'PATCH missing provider -> 404 PROVIDER_NOT_FOUND');

    console.log('\n--- F. Deactivation, Session Invalidation & Active Job Conflict ---');

    // F.1 Create a dedicated provider for deactivation testing
    const deactCreate = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: deactProviderPhone,
        fullName: 'Vikram Deact',
        categoryId: 'electrician',
      },
    });
    const deactProvId = JSON.parse(deactCreate.payload).data.provider.id;

    // Obtain active token for deact provider
    const deactToken = app.jwt.sign(
      { id: deactProvId, phone: deactProviderPhone, role: 'provider', tokenVersion: 1 },
      { expiresIn: '30d' }
    );

    // Verify active token works
    const feedBeforeDeact = await app.inject({
      method: 'GET',
      url: '/api/provider/jobs',
      headers: { Authorization: `Bearer ${deactToken}` },
    });
    assert(feedBeforeDeact.statusCode === 200, 'Provider token valid before deactivation');

    // F.2 Deactivate provider
    const deactRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${deactProvId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    assert(deactRes.statusCode === 200, 'Admin deactivates provider -> 200 OK');
    const deactBody = JSON.parse(deactRes.payload);
    assert(deactBody.data.provider.isActive === false, 'isActive is false');
    assert(deactBody.data.provider.isAvailable === false, 'isAvailable is false');

    // Verify token_version incremented
    const { rows: deactUserRows } = await pool.query('SELECT token_version, is_active FROM users WHERE id = $1', [deactProvId]);
    assert(deactUserRows[0].token_version === 2, 'token_version incremented from 1 to 2');
    assert(deactUserRows[0].is_active === false, 'users.is_active is false');

    // F.3 Existing JWT is now invalidated
    const feedAfterDeact = await app.inject({
      method: 'GET',
      url: '/api/provider/jobs',
      headers: { Authorization: `Bearer ${deactToken}` },
    });
    assert(feedAfterDeact.statusCode === 401, 'Existing provider JWT rejected with 401 after deactivation');

    // F.4 Deactivated provider cannot log in (ACCOUNT_DEACTIVATED)
    const deactLoginAttempt = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: deactProviderPhone },
    });
    assert(deactLoginAttempt.statusCode === 403, 'Deactivated provider passkey register rejected with 403 Forbidden');
    assert(JSON.parse(deactLoginAttempt.payload).error.code === 'ACCOUNT_DEACTIVATED', 'Error code is ACCOUNT_DEACTIVATED');

    // F.5 Repeated deactivation is idempotent (does NOT increment token_version again)
    const repeatDeactRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${deactProvId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    assert(repeatDeactRes.statusCode === 200, 'Repeated deactivation -> 200 OK');
    const { rows: repeatUserRows } = await pool.query('SELECT token_version FROM users WHERE id = $1', [deactProvId]);
    assert(repeatUserRows[0].token_version === 2, 'token_version not incremented on repeated deactivation (idempotent)');

    // F.6 Active booking conflict testing
    // Provision conflict provider
    const conflictCreate = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        phone: conflictProviderPhone,
        fullName: 'Kishore Conflict',
        categoryId: 'electrician',
      },
    });
    const conflictProvId = JSON.parse(conflictCreate.payload).data.provider.id;

    // Test each active status blocks deactivation
    const activeStatuses = [
      'PROVIDER_ASSIGNED',
      'PROVIDER_ACCEPTED',
      'PROVIDER_ON_THE_WAY',
      'SERVICE_STARTED',
      'SERVICE_COMPLETED',
      'PAYMENT_PENDING',
      'PAYMENT_COLLECTED',
    ] as const;

    for (const activeStatus of activeStatuses) {
      // Create a test booking assigned to this provider in activeStatus
      const idempotencyKey = `adm-prov-active-${activeStatus.toLowerCase()}`;
      await pool.query(
        `INSERT INTO bookings (
          idempotency_key, customer_id, provider_id, category_id,
          text_description, area_locality, status, visiting_fee, payment_method, payment_collected
        ) VALUES ($1, $2, $3, 'electrician', 'Test active conflict', 'station-colony', $4, 99.00, 'CASH', false)`,
        [idempotencyKey, customerId, conflictProvId, activeStatus]
      );

      // Attempt to deactivate
      const blockedDeact = await app.inject({
        method: 'POST',
        url: `/api/admin/providers/${conflictProvId}/status`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      assert(blockedDeact.statusCode === 409, `Provider with ${activeStatus} booking cannot be deactivated (409)`);
      assert(JSON.parse(blockedDeact.payload).error.code === 'ACTIVE_BOOKING_EXISTS', 'Error code is ACTIVE_BOOKING_EXISTS');

      // Verify no partial mutation occurred
      const { rows: verifyUnmutated } = await pool.query('SELECT is_active, token_version FROM users WHERE id = $1', [conflictProvId]);
      assert(verifyUnmutated[0].is_active === true, `is_active remains true on conflict (${activeStatus})`);
      assert(verifyUnmutated[0].token_version === 1, `token_version remains unchanged on conflict (${activeStatus})`);

      // Clean up test booking
      await pool.query('DELETE FROM bookings WHERE idempotency_key = $1', [idempotencyKey]);
    }

    console.log('\n--- G. Reactivation & Historical Booking Integrity ---');

    // G.1 Reactivate inactive provider
    const reactRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${deactProvId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: true },
    });
    assert(reactRes.statusCode === 200, 'Admin reactivates provider -> 200 OK');
    const reactBody = JSON.parse(reactRes.payload);
    assert(reactBody.data.provider.isActive === true, 'isActive restored to true');
    assert(reactBody.data.provider.isAvailable === true, 'isAvailable restored to true');

    // Verify token_version was NOT incremented on reactivation
    const { rows: reactUserRows } = await pool.query('SELECT token_version FROM users WHERE id = $1', [deactProvId]);
    assert(reactUserRows[0].token_version === 2, 'token_version NOT incremented on reactivation');

    // Reactivated provider can request passkey options again
    const reactLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: deactProviderPhone },
    });
    assert(reactLogin.statusCode === 200, 'Reactivated provider requests passkey options successfully (200 OK)');

    // Repeated activation is idempotent
    const repeatActiveRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${deactProvId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: true },
    });
    assert(repeatActiveRes.statusCode === 200, 'Repeated activation -> 200 OK (idempotent)');

    // G.2 Historical completed booking does NOT block deactivation and maintains foreign key
    const completedBookingKey = 'adm-prov-completed-history';
    const { rows: compBookRows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
        idempotency_key, customer_id, provider_id, category_id,
        text_description, area_locality, status, visiting_fee, payment_method, payment_collected
      ) VALUES ($1, $2, $3, 'electrician', 'Historical completed job', 'station-colony', 'BOOKING_COMPLETED', 99.00, 'CASH', true)
      RETURNING id`,
      [completedBookingKey, customerId, deactProvId]
    );
    const compBookingId = compBookRows[0].id;

    // Audit log
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by)
       VALUES ($1, 'PAYMENT_COLLECTED', 'BOOKING_COMPLETED', $2)`,
      [compBookingId, deactProvId]
    );

    // Deactivate provider with completed booking
    const compDeactRes = await app.inject({
      method: 'POST',
      url: `/api/admin/providers/${deactProvId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    assert(compDeactRes.statusCode === 200, 'Historical completed booking does NOT block deactivation');

    // Verify foreign keys in bookings and audit logs remain intact
    const { rows: compBookCheck } = await pool.query('SELECT provider_id FROM bookings WHERE id = $1', [compBookingId]);
    assert(compBookCheck[0].provider_id === deactProvId, 'Historical bookings.provider_id remains linked after deactivation');

    const { rows: auditCheck } = await pool.query('SELECT changed_by FROM booking_status_logs WHERE booking_id = $1', [compBookingId]);
    assert(auditCheck[0].changed_by === deactProvId, 'Historical booking_status_logs.changed_by remains linked after deactivation');

    console.log('\n============================================================');
    console.log(`ADMIN PROVIDER TESTS: ${passed} PASSED, ${failed} FAILED.`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Thorough fixture cleanup
    await cleanupFixtures();
    await app.close();
  }
}

runAdminProviderTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
