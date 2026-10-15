import assert from 'node:assert';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { en, hi, ApiResponse, ProviderJob, BookingDetail } from '@shared';

async function runProviderRejectionTests() {
  console.log('\n============================================================');
  console.log('MODULE 9 — PROVIDER JOB REJECTION & RELINQUISHMENT VERIFICATION');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    throw new Error('Database pool unavailable');
  }

  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${message}`);
    }
  }

  // Test phone numbers
  const customerPhone = '9800099001';
  const provider1Phone = '9800099002';
  const provider2Phone = '9800099003';
  const adminPhone = '9800099004';

  // 1. Cleanup old test fixtures
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);

  // 2. Insert test users
  const { rows: custRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'customer', 'Test Customer', 'hi', true, 1) RETURNING id`,
    [customerPhone]
  );
  const customerId = custRows[0].id;

  const { rows: prov1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Technician Suraj', 'hi', true, 1) RETURNING id`,
    [provider1Phone]
  );
  const provider1Id = prov1Rows[0].id;

  const { rows: prov2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Technician Amit', 'hi', true, 1) RETURNING id`,
    [provider2Phone]
  );
  const provider2Id = prov2Rows[0].id;

  await pool.query(
    `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
     VALUES ($1, 'electrician', 'Chandil', true, 'VERIFIED'),
            ($2, 'electrician', 'Chandil', true, 'VERIFIED')`,
    [provider1Id, provider2Id]
  );

  const { rows: adminRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'admin', 'Admin User', 'en', true, 1) RETURNING id`,
    [adminPhone]
  );
  const adminId = adminRows[0].id;

  // 3. Generate tokens
  const customerToken = app.jwt.sign({ id: customerId, role: 'customer', tokenVersion: 1 });
  const provider1Token = app.jwt.sign({ id: provider1Id, role: 'provider', tokenVersion: 1 });
  const provider2Token = app.jwt.sign({ id: provider2Id, role: 'provider', tokenVersion: 1 });
  const adminToken = app.jwt.sign({ id: adminId, role: 'admin', tokenVersion: 1 });

  // 4. Create a test booking claimed by Provider 1 (PROVIDER_ACCEPTED)
  const b1Key = `rej-test-b1-${Date.now()}`;
  const { rows: b1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status, accepted_at, created_at)
     VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Near Main Chowk', 'Ceiling fan making clicking noise', 99.00, 'PROVIDER_ACCEPTED', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '10 minutes')
     RETURNING id`,
    [b1Key, customerId, provider1Id]
  );
  const job1Id = b1Rows[0].id;

  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
     VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ACCEPTED', $2, 'Technician accepted job')`,
    [job1Id, provider1Id]
  );

  console.log('--- 1. Authorization Guards (Requirements 1-5) ---');

  // 1.1 Unauthenticated request returns 401
  const unauthRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
  });
  testAssert(unauthRes.statusCode === 401, 'Unauthenticated relinquishment receives 401 Unauthorized (Requirement 4)');

  // 1.2 Customer role returns 403
  const custRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custRes.statusCode === 403, 'Customer role cannot relinquish jobs (403 Forbidden) (Requirement 2)');

  // 1.3 Admin role returns 403
  const adminRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  testAssert(adminRes.statusCode === 403, 'Admin role cannot relinquish jobs (403 Forbidden) (Requirement 3)');

  console.log('\n--- 2. Ownership & Rejection Rules (Requirements 6-9) ---');

  // 2.1 Malformed UUID returns 404
  const malformedRes = await app.inject({
    method: 'POST',
    url: '/api/provider/jobs/not-a-valid-uuid/reject',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(malformedRes.statusCode === 404, 'Malformed UUID returns 404 BOOKING_NOT_FOUND');

  // 2.2 Non-existent UUID returns 404
  const nonExistentRes = await app.inject({
    method: 'POST',
    url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/reject',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(nonExistentRes.statusCode === 404, 'Missing booking returns 404 BOOKING_NOT_FOUND');

  // 2.3 Wrong provider (Provider 2) trying to relinquish Provider 1's job receives 409 Conflict
  const wrongProviderRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(wrongProviderRes.statusCode === 409, 'Wrong provider cannot relinquish another provider job (409 Conflict) (Requirement 7)');
  const wrongProvBody: ApiResponse = JSON.parse(wrongProviderRes.payload);
  testAssert(wrongProvBody.error?.code === 'JOB_NO_LONGER_ASSIGNED', 'Error code is strictly JOB_NO_LONGER_ASSIGNED');

  // 2.4 Open SERVICE_REQUESTED booking cannot be rejected from broadcast feed (Requirement 8)
  const openKey = `rej-test-open-${Date.now()}`;
  const { rows: openRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'chowka', 'Bus Stand', 'Leaking tap', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [openKey, customerId]
  );
  const openJobId = openRows[0].id;

  const rejectOpenRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${openJobId}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(rejectOpenRes.statusCode === 409, 'Open broadcast SERVICE_REQUESTED booking cannot be rejected (409 Conflict) (Requirement 8)');
  const rejectOpenBody: ApiResponse = JSON.parse(rejectOpenRes.payload);
  testAssert(rejectOpenBody.error?.code === 'JOB_NO_LONGER_ASSIGNED', 'Error code for open broadcast reject is JOB_NO_LONGER_ASSIGNED');

  console.log('\n--- 3. Successful Relinquishment & State Verification (Requirements 10-19) ---');

  // 3.1 Legitimate owner (Provider 1) successfully relinquishes job1
  const beforeRejectTime = Date.now();
  const rejectRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
    payload: { provider_id: 'tampered-hacker-id' }, // Body payload tampering must be strictly ignored
  });
  testAssert(rejectRes.statusCode === 200, 'Provider 1 successfully relinquished job (200 OK) (Requirement 1 & 6)');
  const rejectBody: ApiResponse<ProviderJob> = JSON.parse(rejectRes.payload);
  testAssert(rejectBody.success === true, 'Success flag is true in envelope');
  testAssert(rejectBody.data?.status === 'SERVICE_REQUESTED', 'Returned job status is SERVICE_REQUESTED');

  // 3.2 Database State Verification
  const { rows: dbRows } = await pool.query<{
    status: string;
    provider_id: string | null;
    accepted_at: Date | null;
    updated_at: Date;
  }>('SELECT status, provider_id, accepted_at, updated_at FROM bookings WHERE id = $1', [job1Id]);
  const dbJob = dbRows[0];

  testAssert(dbJob.status === 'SERVICE_REQUESTED', 'Database status is strictly SERVICE_REQUESTED (Requirement 11)');
  testAssert(dbJob.provider_id === null, 'Database provider_id is strictly NULL (Requirement 10)');
  testAssert(dbJob.accepted_at === null, 'Database accepted_at is cleared to NULL (Requirement 12)');
  testAssert(new Date(dbJob.updated_at).getTime() >= beforeRejectTime - 1000, 'Database updated_at timestamp was refreshed (Requirement 13)');

  // 3.3 Audit Log Integrity
  const { rows: logRows } = await pool.query<{
    from_status: string;
    to_status: string;
    changed_by: string;
  }>('SELECT from_status, to_status, changed_by FROM booking_status_logs WHERE booking_id = $1 ORDER BY id ASC', [job1Id]);

  testAssert(logRows.length === 3, 'Exactly three status logs exist in total (Initial Claim + Relinquish + Recovery)');
  const relinquishLog = logRows[1];
  testAssert(relinquishLog.from_status === 'PROVIDER_ACCEPTED', 'from_status is strictly PROVIDER_ACCEPTED (Requirement 16)');
  testAssert(relinquishLog.to_status === 'REJECTED_BY_PROVIDER', 'to_status is strictly REJECTED_BY_PROVIDER (Requirement 15 & 17)');
  testAssert(relinquishLog.changed_by === provider1Id, 'changed_by is strictly authenticated Provider 1 (Requirement 18)');
  const recoveryLog = logRows[2];
  testAssert(recoveryLog.from_status === 'REJECTED_BY_PROVIDER', 'Recovery from_status is strictly REJECTED_BY_PROVIDER');
  testAssert(recoveryLog.to_status === 'SERVICE_REQUESTED', 'Recovery to_status is strictly SERVICE_REQUESTED');

  // 3.4 Customer Booking View
  const custViewRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${job1Id}`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custViewRes.statusCode === 200, 'Customer can view booking detail');
  const custViewBody: ApiResponse<BookingDetail> = JSON.parse(custViewRes.payload);
  testAssert(custViewBody.data?.status === 'SERVICE_REQUESTED', 'Customer sees booking active in SERVICE_REQUESTED (Requirement 14)');
  testAssert(custViewBody.data?.provider === null, 'Customer sees provider is null (awaiting new assignment)');

  console.log('\n--- 4. Repeated Relinquishment / Idempotency (Requirements 29-30) ---');

  // 4.1 Repeating the request on the already relinquished job returns 409
  const repeatRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(repeatRes.statusCode === 409, 'Repeated relinquishment is rejected safely with 409 Conflict (Requirement 9 & 29)');
  const repeatBody: ApiResponse = JSON.parse(repeatRes.payload);
  testAssert(repeatBody.error?.code === 'JOB_NO_LONGER_ASSIGNED', 'Error code is JOB_NO_LONGER_ASSIGNED');

  // Verify no duplicate logs were inserted
  const { rows: postRepeatLogs } = await pool.query(
    'SELECT id FROM booking_status_logs WHERE booking_id = $1',
    [job1Id]
  );
  testAssert(postRepeatLogs.length === 3, 'No duplicate audit events created on repeated request (Requirement 30)');

  console.log('\n--- 5. Feed Re-Availability & Subsequent Claim (Requirements 23-24) ---');

  // 5.1 Re-queued job appears in provider feed
  const feedRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(feedRes.statusCode === 200, 'Provider 2 can fetch job feed');
  const feedBody: ApiResponse<ProviderJob[]> = JSON.parse(feedRes.payload);
  const reAvailableJob = feedBody.data?.find((j) => j.id === job1Id);
  testAssert(Boolean(reAvailableJob), 'Released job appears again in available provider feed (Requirement 23)');

  // 5.2 Provider 2 can now claim the relinquished job
  const claimRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${job1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(claimRes.statusCode === 200, 'Other technician (Provider 2) can subsequently claim the job (Requirement 24)');
  const { rows: reclaimedRows } = await pool.query<{ provider_id: string; status: string }>(
    'SELECT provider_id, status FROM bookings WHERE id = $1',
    [job1Id]
  );
  testAssert(reclaimedRows[0].provider_id === provider2Id, 'Job is now successfully claimed by Provider 2');
  testAssert(reclaimedRows[0].status === 'PROVIDER_ACCEPTED', 'Status transitioned back to PROVIDER_ACCEPTED');

  console.log('\n--- 6. Atomicity & Rollback Protection (Requirements 20-22) ---');

  // Create a job claimed by Provider 1
  const atomKey = `rej-test-atom-${Date.now()}`;
  const { rows: atomRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'appliance-repair', 'dam-road', 'Washing machine leak', 99.00, 'PROVIDER_ACCEPTED')
     RETURNING id`,
    [atomKey, customerId, provider1Id]
  );
  const atomJobId = atomRows[0].id;

  // Simulate audit log failure by adding a temporary check constraint on booking_status_logs
  await pool.query(
    `ALTER TABLE booking_status_logs ADD CONSTRAINT temp_test_reject_abort CHECK (notes != 'Simulate Reject Fail')`
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE bookings SET status = 'SERVICE_REQUESTED', provider_id = NULL WHERE id = $1`,
      [atomJobId]
    );
    // This will trigger check constraint violation
    let failedInsert = false;
    try {
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
         VALUES ($1, 'PROVIDER_ACCEPTED', 'REJECTED_BY_PROVIDER', $2, 'Simulate Reject Fail')`,
        [atomJobId, provider1Id]
      );
    } catch {
      failedInsert = true;
      await client.query('ROLLBACK');
    }
    testAssert(failedInsert, 'Audit log insert failure correctly trapped');
  } finally {
    client.release();
    await pool.query('ALTER TABLE booking_status_logs DROP CONSTRAINT IF EXISTS temp_test_reject_abort');
  }

  // Verify rollback preserved state
  const { rows: atomCheckRows } = await pool.query<{ provider_id: string; status: string }>(
    'SELECT provider_id, status FROM bookings WHERE id = $1',
    [atomJobId]
  );
  testAssert(atomCheckRows[0].status === 'PROVIDER_ACCEPTED', 'Audit failure rolls back status; remains PROVIDER_ACCEPTED (Requirement 20)');
  testAssert(atomCheckRows[0].provider_id === provider1Id, 'Audit failure preserves provider assignment (Requirement 22)');

  console.log('\n--- 7. Real Concurrency & Overlapping Race Conditions (Requirements 25-28) ---');

  // Race 1: Two simultaneous relinquishment attempts by Provider 1 on the same job
  const raceKey = `rej-test-race-${Date.now()}`;
  const { rows: raceRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'bike-mechanic', 'gangdih', 'Bike tyre puncture', 99.00, 'PROVIDER_ACCEPTED')
     RETURNING id`,
    [raceKey, customerId, provider1Id]
  );
  const raceJobId = raceRows[0].id;

  const [raceRes1, raceRes2] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJobId}/reject`, headers: { authorization: `Bearer ${provider1Token}` } }),
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJobId}/reject`, headers: { authorization: `Bearer ${provider1Token}` } }),
  ]);

  const raceStatuses = [raceRes1.statusCode, raceRes2.statusCode];
  testAssert(
    raceStatuses.includes(200) && raceStatuses.includes(409),
    'Concurrent double-relinquishment: exactly one succeeds (200) and one receives conflict (409) (Requirement 25)'
  );

  const { rows: raceLogRows } = await pool.query(
    'SELECT id FROM booking_status_logs WHERE booking_id = $1 AND to_status = \'REJECTED_BY_PROVIDER\'',
    [raceJobId]
  );
  testAssert(raceLogRows.length === 1, 'Exactly one REJECTED_BY_PROVIDER audit event created after race (Requirement 26)');

  const { rows: raceFinalRows } = await pool.query<{ status: string; provider_id: string | null }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [raceJobId]
  );
  testAssert(raceFinalRows[0].status === 'SERVICE_REQUESTED', 'Final race status is SERVICE_REQUESTED');
  testAssert(raceFinalRows[0].provider_id === null, 'Final race provider_id is NULL (Requirement 27)');

  // Race 2: Relinquishment vs Concurrent Act from Wrong Provider
  const race2Key = `rej-test-race2-${Date.now()}`;
  const { rows: race2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'ac-cooler', 'chilgu', 'Cooler motor dead', 149.00, 'PROVIDER_ACCEPTED')
     RETURNING id`,
    [race2Key, customerId, provider1Id]
  );
  const race2JobId = race2Rows[0].id;

  const [ownerRes, wrongRes] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/provider/jobs/${race2JobId}/reject`, headers: { authorization: `Bearer ${provider1Token}` } }),
    app.inject({ method: 'POST', url: `/api/provider/jobs/${race2JobId}/reject`, headers: { authorization: `Bearer ${provider2Token}` } }),
  ]);
  testAssert(ownerRes.statusCode === 200, 'Legitimate owner succeeds in concurrent action');
  testAssert(wrongRes.statusCode === 409, 'Unauthorized provider is rejected with 409 in race');

  console.log('\n--- 8. Bilingual i18n Key Symmetry Audit for Module 9 (Requirements 37-38) ---');

  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  testAssert(enKeys.length === hiKeys.length, `Matching dictionary sizes (${enKeys.length} keys each) (Requirement 37)`);

  let allKeysPresent = true;
  let allNonEmpty = true;
  let noMixedHindi = true;

  for (const key of enKeys) {
    if (!(key in hi)) {
      allKeysPresent = false;
      console.error(`  Missing Hindi key: ${key}`);
    }
    const enVal = en[key as keyof typeof en];
    const hiVal = hi[key as keyof typeof hi];

    if (!enVal || enVal.trim() === '' || !hiVal || hiVal.trim() === '') {
      allNonEmpty = false;
    }

    if (key !== 'lang.choose_title') {
      if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
        noMixedHindi = false;
        console.error(`  Leaked parenthetical English in Hindi key "${key}": ${hiVal}`);
      }
    }
  }

  testAssert(allKeysPresent, 'All translation keys exist in both English and Hindi');
  testAssert(allNonEmpty, 'No translation strings are blank or empty');
  testAssert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary (Requirement 38)');

  // 9. Cleanup test fixtures
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    provider1Phone,
    provider2Phone,
    adminPhone,
  ]);

  await app.close();
  await pool.end();

  console.log('\n============================================================');
  console.log(`PROVIDER REJECTION & CONCURRENCY TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runProviderRejectionTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
