import assert from 'node:assert';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { en, hi, ApiResponse, ProviderJob, BookingDetail } from '@shared';

async function runProviderAcceptanceTests() {
  console.log('\n============================================================');
  console.log('MODULE 8 — PROVIDER JOB ACCEPTANCE & CONCURRENCY VERIFICATION');
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

  // Test accounts
  const customerPhone = '9800088001';
  const provider1Phone = '9800088002';
  const provider2Phone = '9800088003';
  const adminPhone = '9800088004';

  // Cleanup old test fixtures
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

  // Insert Users
  const { rows: custRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'customer', 'Ramesh Customer', 'hi', true, 1) RETURNING id`,
    [customerPhone]
  );
  const customerId = custRows[0].id;

  const { rows: p1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Mahesh Electrician', 'hi', true, 1) RETURNING id`,
    [provider1Phone]
  );
  const provider1Id = p1Rows[0].id;

  await pool.query(
    `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
     VALUES ($1, 'electrician', 'Chandil', true, 'VERIFIED')`,
    [provider1Id]
  );

  const { rows: p2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Dinesh Plumber', 'en', true, 1) RETURNING id`,
    [provider2Phone]
  );
  const provider2Id = p2Rows[0].id;

  await pool.query(
    `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
     VALUES ($1, 'plumber', 'Chandil', true, 'VERIFIED')`,
    [provider2Id]
  );

  const { rows: adminRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'admin', 'Super Admin', 'en', true, 1) RETURNING id`,
    [adminPhone]
  );
  const adminId = adminRows[0].id;

  // Sign JWT Tokens
  const customerToken = app.jwt.sign({ id: customerId, phone: customerPhone, role: 'customer', tokenVersion: 1 });
  const provider1Token = app.jwt.sign({ id: provider1Id, phone: provider1Phone, role: 'provider', tokenVersion: 1 });
  const provider2Token = app.jwt.sign({ id: provider2Id, phone: provider2Phone, role: 'provider', tokenVersion: 1 });
  const adminToken = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

  // Create an initial available booking
  const b1Key = `accept-test-b1-${Date.now()}`;
  const { rows: b1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status)
     VALUES ($1, $2, 'electrician', 'chandil-bazar', 'Near Temple', 'Ceiling fan capacitor burned', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [b1Key, customerId]
  );
  const b1Id = b1Rows[0].id;

  console.log('--- 1. Authorization Guards (Requirements 1-5) ---');

  // 1.1 Unauthenticated request returns 401
  const unauthRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
  });
  testAssert(unauthRes.statusCode === 401, 'Unauthenticated acceptance receives 401 Unauthorized (Requirement 4)');

  // 1.2 Customer role returns 403 Forbidden
  const custRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custRes.statusCode === 403, 'Customer role cannot accept jobs (403 Forbidden) (Requirement 2)');

  // 1.3 Admin role returns 403 Forbidden
  const adminRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  testAssert(adminRes.statusCode === 403, 'Admin role cannot accept jobs (403 Forbidden) (Requirement 3)');

  // 1.3b Category Mismatch: Dinesh Plumber cannot accept Electrician job
  const mismatchRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(mismatchRes.statusCode === 400, 'Provider with mismatched category cannot accept job (400 CATEGORY_MISMATCH)');
  const mismatchBody = JSON.parse(mismatchRes.payload);
  testAssert(mismatchBody.error?.code === 'CATEGORY_MISMATCH', 'Error code is strictly CATEGORY_MISMATCH');
  testAssert(mismatchBody.error?.messageEn === 'Provider category does not match booking category.', 'Bilingual English message matches contract');
  testAssert(mismatchBody.error?.messageHi === 'मिस्त्री की श्रेणी बुकिंग श्रेणी से मेल नहीं खाती।', 'Bilingual Hindi message matches contract');

  const { rows: mismatchDbCheck } = await pool.query<{ status: string; provider_id: string | null }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [b1Id]
  );
  testAssert(mismatchDbCheck[0].status === 'SERVICE_REQUESTED', 'Booking status remains SERVICE_REQUESTED after mismatched category attempt');
  testAssert(mismatchDbCheck[0].provider_id === null, 'No provider assigned after mismatched category attempt');

  // 1.4 Attempting to spoof providerId in body is ignored
  const spoofRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
    payload: { providerId: provider2Id }, // malicious body attempting to assign another provider
  });
  testAssert(spoofRes.statusCode === 200, 'Provider 1 successfully accepted job (Requirement 1)');

  const { rows: spoofCheck } = await pool.query<{ provider_id: string }>(
    'SELECT provider_id FROM bookings WHERE id = $1',
    [b1Id]
  );
  testAssert(spoofCheck[0].provider_id === provider1Id, 'Provider ID is strictly taken from auth JWT session, NOT from payload body (Requirement 5)');

  console.log('\n--- 2. Validation & Terminal State Rejections (Requirements 6-11) ---');

  // 2.1 Malformed UUID
  const malformedRes = await app.inject({
    method: 'POST',
    url: '/api/provider/jobs/not-a-valid-uuid/accept',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(malformedRes.statusCode === 404, 'Malformed UUID returns 404 BOOKING_NOT_FOUND (Requirement 6)');

  // 2.2 Missing/Nonexistent booking
  const notFoundRes = await app.inject({
    method: 'POST',
    url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/accept',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(notFoundRes.statusCode === 404, 'Missing booking returns 404 BOOKING_NOT_FOUND (Requirement 7)');

  // 2.3 Already assigned job rejected for a different provider (Requirement 8)
  const alreadyClaimedRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(alreadyClaimedRes.statusCode === 409, 'Different provider attempting to claim already assigned job receives 409 Conflict (Requirement 8)');
  const alreadyClaimedBody: ApiResponse = JSON.parse(alreadyClaimedRes.payload);
  testAssert(alreadyClaimedBody.error?.code === 'JOB_ALREADY_CLAIMED', 'Error code is JOB_ALREADY_CLAIMED');

  // 2.4 Cancelled job rejected (Requirement 10)
  const bCancelKey = `accept-test-cancel-${Date.now()}`;
  const { rows: cancelRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'chowka', 'Cancelled tap leak', 99.00, 'CANCELLED_BY_CUSTOMER')
     RETURNING id`,
    [bCancelKey, customerId]
  );
  const cancelId = cancelRows[0].id;

  const cancelRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${cancelId}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(cancelRes.statusCode === 409, 'Cancelled job cannot be accepted (409 Conflict) (Requirement 10)');

  // 2.5 Completed job rejected (Requirement 11)
  const bDoneKey = `accept-test-done-${Date.now()}`;
  const { rows: doneRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'chowka', 'Completed work', 99.00, 'BOOKING_COMPLETED')
     RETURNING id`,
    [bDoneKey, customerId]
  );
  const doneId = doneRows[0].id;

  const doneRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${doneId}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(doneRes.statusCode === 409, 'Completed job cannot be accepted (409 Conflict) (Requirement 11)');

  console.log('\n--- 3. Successful Acceptance State & Customer Visibility (Requirements 12-19) ---');

  // Verify Booking 1 state in DB
  const { rows: b1StateRows } = await pool.query<{
    status: string;
    provider_id: string;
    accepted_at: Date;
    updated_at: Date;
  }>(
    'SELECT status, provider_id, accepted_at, updated_at FROM bookings WHERE id = $1',
    [b1Id]
  );
  const b1State = b1StateRows[0];

  testAssert(b1State.status === 'PROVIDER_ACCEPTED', 'Booking status transitioned to PROVIDER_ACCEPTED (Requirement 12)');
  testAssert(b1State.provider_id === provider1Id, 'provider_id assigned correctly (Requirement 13)');
  testAssert(b1State.accepted_at !== null, 'accepted_at timestamp is populated (Requirement 14)');
  testAssert(b1State.updated_at !== null, 'updated_at timestamp is populated (Requirement 15)');

  // Verify Status Log entry in DB
  const { rows: b1LogRows } = await pool.query<{
    from_status: string;
    to_status: string;
    changed_by: string;
  }>(
    'SELECT from_status, to_status, changed_by FROM booking_status_logs WHERE booking_id = $1',
    [b1Id]
  );
  testAssert(b1LogRows.length === 1, 'Exactly one status log created for acceptance (Requirement 16)');
  testAssert(b1LogRows[0].from_status === 'SERVICE_REQUESTED', 'Log from_status is SERVICE_REQUESTED (Requirement 17)');
  testAssert(b1LogRows[0].to_status === 'PROVIDER_ACCEPTED', 'Log to_status is PROVIDER_ACCEPTED (Requirement 17)');
  testAssert(b1LogRows[0].changed_by === provider1Id, 'Log changed_by is authenticated provider');

  // Verify provider available jobs feed excludes this claimed booking (Requirement 18)
  const feedRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  const feedJobs: ProviderJob[] = JSON.parse(feedRes.payload).data;
  testAssert(!feedJobs.some((j) => j.id === b1Id), 'Provider feed no longer returns the claimed job (Requirement 18)');

  // Verify customer visibility on booking detail (Requirement 19)
  const custDetailRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${b1Id}`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custDetailRes.statusCode === 200, 'Customer can retrieve booking detail');
  const custDetailBody: ApiResponse<BookingDetail> = JSON.parse(custDetailRes.payload);
  testAssert(custDetailBody.data?.status === 'PROVIDER_ACCEPTED', 'Customer sees updated PROVIDER_ACCEPTED status (Requirement 19)');
  testAssert(custDetailBody.data?.provider?.name === 'Mahesh Electrician', 'Customer sees assigned technician name (Requirement 19)');

  console.log('\n--- 4. Same Provider Repeated Acceptance / Idempotency (Requirements 23-25) ---');

  // Same provider calls accept again on the same job they already claimed
  const repeatRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(repeatRes.statusCode === 200, 'Same provider repeated acceptance returns 200 OK safely (Requirement 23)');

  const { rows: b1LogsAfterRepeat } = await pool.query(
    'SELECT id FROM booking_status_logs WHERE booking_id = $1',
    [b1Id]
  );
  testAssert(b1LogsAfterRepeat.length === 1, 'No duplicate status log created on repeated acceptance (Requirement 24)');

  const { rows: b1StateAfterRepeat } = await pool.query<{ status: string; provider_id: string }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [b1Id]
  );
  testAssert(b1StateAfterRepeat[0].status === 'PROVIDER_ACCEPTED' && b1StateAfterRepeat[0].provider_id === provider1Id, 'No duplicate state transition or ownership change (Requirement 25)');

  console.log('\n--- 5. Atomicity & Rollback Protection (Requirements 20-22) ---');

  // Test rollback: If transaction aborts before commit, booking claim does NOT persist
  const bRollbackKey = `accept-test-rollback-${Date.now()}`;
  const { rows: rbRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'electrician', 'chandil-bazar', 'Testing rollback', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bRollbackKey, customerId]
  );
  const rbId = rbRows[0].id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "UPDATE bookings SET provider_id = $1, status = 'PROVIDER_ACCEPTED' WHERE id = $2",
      [provider1Id, rbId]
    );
    // Simulate error during status log insertion or explicit rollback
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  const { rows: rbCheck } = await pool.query<{ status: string; provider_id: string | null }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [rbId]
  );
  testAssert(rbCheck[0].status === 'SERVICE_REQUESTED', 'Failed transaction rolls back status to SERVICE_REQUESTED (Requirement 20)');
  testAssert(rbCheck[0].provider_id === null, 'No partial provider assignment on rollback (Requirement 22)');

  const { rows: rbLogsCheck } = await pool.query(
    'SELECT id FROM booking_status_logs WHERE booking_id = $1',
    [rbId]
  );
  testAssert(rbLogsCheck.length === 0, 'No orphan status log on rollback (Requirement 21)');

  console.log('\n--- 6. CONCURRENCY — CRITICAL (Requirements 26-30) ---');

  // Complete earlier booking b1Id so provider1 has no active booking in progress
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [b1Id]);

  // Create a brand new unassigned SERVICE_REQUESTED booking for the race condition test
  const raceKey = `accept-test-race-${Date.now()}`;
  const { rows: raceRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Water pipe bursting in bathroom', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [raceKey, customerId]
  );
  const raceId = raceRows[0].id;

  // Both providers must have approved category 'plumber' to compete in the race
  await pool.query("UPDATE provider_profiles SET category_id = 'plumber' WHERE user_id = $1", [provider1Id]);

  // Two different authenticated providers concurrently claim the SAME booking
  const [raceRes1, raceRes2] = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${raceId}/accept`,
      headers: { authorization: `Bearer ${provider1Token}` },
    }),
    app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${raceId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    }),
  ]);

  const statusCodes = [raceRes1.statusCode, raceRes2.statusCode].sort();
  testAssert(statusCodes[0] === 200 && statusCodes[1] === 409, 'Concurrently claiming same job: exactly one succeeds (200) and one receives conflict (409) (Requirements 26-28)');

  const winnerBody = raceRes1.statusCode === 200 ? JSON.parse(raceRes1.payload) : JSON.parse(raceRes2.payload);
  const loserBody = raceRes1.statusCode === 409 ? JSON.parse(raceRes1.payload) : JSON.parse(raceRes2.payload);

  testAssert(winnerBody.success === true, 'Winning provider receives success envelope');
  testAssert(loserBody.error?.code === 'JOB_ALREADY_CLAIMED', 'Losing provider receives JOB_ALREADY_CLAIMED error code (Requirement 28)');

  // Verify DB state after the race
  const { rows: raceDbRows } = await pool.query<{ status: string; provider_id: string }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [raceId]
  );
  testAssert(raceDbRows[0].status === 'PROVIDER_ACCEPTED', 'Post-race booking status is PROVIDER_ACCEPTED');
  testAssert(
    raceDbRows[0].provider_id === provider1Id || raceDbRows[0].provider_id === provider2Id,
    'Exactly one provider_id remains assigned in database (Requirement 29)'
  );

  const { rows: raceLogRows } = await pool.query(
    'SELECT id, changed_by FROM booking_status_logs WHERE booking_id = $1',
    [raceId]
  );
  testAssert(raceLogRows.length === 1, 'Exactly one successful transition exists in DB logs after race (Requirement 30)');

  // Complete raceId booking so winning provider has no lingering active booking in progress
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [raceId]);

  console.log('\n--- 6b. IN-TRANSACTION PROVIDER ROLE & STATUS RE-VALIDATION (PHASE 2F REGRESSION) ---');

  // Capture original provider2 state before any mutation
  const { rows: origUserRows } = await pool.query<{ role: string; is_active: boolean }>(
    'SELECT role, is_active FROM users WHERE id = $1',
    [provider2Id]
  );
  testAssert(origUserRows.length === 1, 'Provider 2 user row exists before regression tests');
  const origRole = origUserRows[0].role;
  const origIsActive = origUserRows[0].is_active;

  // Test 6b.1: Demoted provider receives 403 and cannot accept booking
  const demoteKey = `accept-test-demote-${Date.now()}`;
  const { rows: demoteRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Leaking bathroom pipe', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [demoteKey, customerId]
  );
  const demoteBookingId = demoteRows[0].id;

  try {
    // Demote provider2 to customer in the database
    await pool.query("UPDATE users SET role = 'customer' WHERE id = $1", [provider2Id]);

    const demoteRes = await app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${demoteBookingId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    });
    testAssert(demoteRes.statusCode === 403, 'Demoted provider attempting to accept job receives 403 Forbidden');
    const demoteBody = JSON.parse(demoteRes.payload);
    testAssert(demoteBody.error?.code === 'FORBIDDEN', 'Demoted provider error code is FORBIDDEN');

    const { rows: demoteDbRows } = await pool.query<{ status: string; provider_id: string | null }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [demoteBookingId]
    );
    testAssert(demoteDbRows[0].status === 'SERVICE_REQUESTED', 'Booking status remains SERVICE_REQUESTED after demoted accept attempt');
    testAssert(demoteDbRows[0].provider_id === null, 'No provider assigned after demoted accept attempt');
  } finally {
    // Restore provider2 to captured original role
    try {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [origRole, provider2Id]);
    } catch (restoreErr) {
      console.error('Failed to restore provider2 role in cleanup:', restoreErr);
    }
  }

  // Test 6b.2: Deactivated provider receives 401 or 403 and cannot accept booking
  const inactiveKey = `accept-test-inactive-${Date.now()}`;
  const { rows: inactiveRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Kitchen sink leakage', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [inactiveKey, customerId]
  );
  const inactiveBookingId = inactiveRows[0].id;

  try {
    // Deactivate provider2 in database
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [provider2Id]);

    const inactiveRes = await app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${inactiveBookingId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    });
    testAssert(inactiveRes.statusCode === 401 || inactiveRes.statusCode === 403, 'Inactive provider attempting to accept receives 401 or 403');

    const { rows: inactiveDbRows } = await pool.query<{ status: string; provider_id: string | null }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [inactiveBookingId]
    );
    testAssert(inactiveDbRows[0].status === 'SERVICE_REQUESTED', 'Booking status remains SERVICE_REQUESTED after inactive accept attempt');
    testAssert(inactiveDbRows[0].provider_id === null, 'No provider assigned after inactive accept attempt');
  } finally {
    // Reactivate provider2 to captured original is_active state
    try {
      await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [origIsActive, provider2Id]);
    } catch (restoreErr) {
      console.error('Failed to restore provider2 is_active in cleanup:', restoreErr);
    }
  }

  // Test 6b.3: In-flight race simulation — holder transaction modifies users row with FOR UPDATE
  const lockKey = `accept-test-lock-${Date.now()}`;
  const { rows: lockRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Burst main pipe', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [lockKey, customerId]
  );
  const lockBookingId = lockRows[0].id;

  let holderClient: any = null;
  let acceptPromise: Promise<any> | null = null;

  try {
    // Acquire row lock on provider2 and demote inside an open transaction
    holderClient = await pool.connect();
    const { rows: pidRows } = await holderClient.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const holderPid = pidRows[0].pid;

    await holderClient.query('BEGIN');
    await holderClient.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [provider2Id]);
    await holderClient.query("UPDATE users SET role = 'customer' WHERE id = $1", [provider2Id]);

    // Launch accept request asynchronously while row lock is held
    acceptPromise = app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${lockBookingId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    });

    // Explicitly observe that the acceptance request backend PID is waiting on holderPid's lock
    let blockedPid: number | null = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const { rows: blockedRows } = await pool.query<{ pid: number; query: string; wait_event_type: string }>(
        `SELECT pid, query, wait_event_type
         FROM pg_stat_activity
         WHERE $1 = ANY(pg_blocking_pids(pid))
           AND query ILIKE '%FROM users WHERE id = $1 FOR UPDATE%'
           AND wait_event_type = 'Lock'`,
        [holderPid]
      );
      if (blockedRows.length > 0) {
        blockedPid = blockedRows[0].pid;
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }

    testAssert(blockedPid !== null, 'Acceptance request backend PID verified blocked on users row lock held by demotion transaction');

    // Commit the demotion transaction, releasing the users row lock
    await holderClient.query('COMMIT');

    // Await the unblocked accept request
    const blockedAcceptRes = await acceptPromise;
    testAssert(blockedAcceptRes.statusCode === 403, 'Concurrent accept unblocks and returns 403 Forbidden after demotion commits');
    const blockedBody = JSON.parse(blockedAcceptRes.payload);
    testAssert(blockedBody.error?.code === 'FORBIDDEN', 'Blocked accept receives FORBIDDEN error code');

    const { rows: lockDbRows } = await pool.query<{ status: string; provider_id: string | null }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [lockBookingId]
    );
    testAssert(lockDbRows[0].status === 'SERVICE_REQUESTED', 'Booking remains SERVICE_REQUESTED after concurrent demotion race');
    testAssert(lockDbRows[0].provider_id === null, 'No provider assigned after concurrent demotion race');
  } finally {
    if (holderClient) {
      try {
        await holderClient.query('ROLLBACK');
      } catch {
        // Swallowed if already committed
      }
      try {
        holderClient.release();
      } catch (releaseErr) {
        console.error('Failed to release holderClient in cleanup:', releaseErr);
      }
    }

    // Guaranteed restoration of provider2 state to captured original values
    try {
      await pool.query('UPDATE users SET role = $1, is_active = $2 WHERE id = $3', [
        origRole,
        origIsActive,
        provider2Id,
      ]);
    } catch (restoreErr) {
      console.error('Failed to restore provider2 state in cleanup:', restoreErr);
    }

    // Settle pending promise to prevent dangling async activity
    if (acceptPromise) {
      try {
        await acceptPromise;
      } catch {
        // Swallowed to prevent masking test failure
      }
    }
  }

  // Normal acceptance verification once restored
  const normalAcceptRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${lockBookingId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(normalAcceptRes.statusCode === 200, 'Provider 2 accepts job normally once role is restored to provider (200 OK)');

  const { rows: finalDbRows } = await pool.query<{ status: string; provider_id: string }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [lockBookingId]
  );
  testAssert(finalDbRows[0].status === 'PROVIDER_ACCEPTED', 'Final booking status is PROVIDER_ACCEPTED');
  testAssert(finalDbRows[0].provider_id === provider2Id, 'Booking provider_id correctly assigned to Provider 2');

  console.log('\n--- 6c. WORKER VERIFICATION, AVAILABILITY & SINGLE ACTIVE JOB ENFORCEMENT ---');

  // Complete lockBookingId so provider2 is free
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [lockBookingId]);

  // Test 6c.1: Pending verification worker receives 403 FORBIDDEN
  const bPendingKey = `accept-test-pending-${Date.now()}`;
  const { rows: bPendingRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Tap leaking', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bPendingKey, customerId]
  );
  const bPendingId = bPendingRows[0].id;

  await pool.query("UPDATE provider_profiles SET verification_status = 'PENDING_VERIFICATION' WHERE user_id = $1", [provider2Id]);
  const resPendingAccept = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bPendingId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resPendingAccept.statusCode === 403, 'Pending verification worker receives 403 Forbidden on accept');
  const bodyPendingAccept = JSON.parse(resPendingAccept.payload);
  testAssert(bodyPendingAccept.error?.code === 'FORBIDDEN', 'Pending verification error code is FORBIDDEN');

  // Test 6c.2: Rejected worker receives 403 FORBIDDEN
  await pool.query("UPDATE provider_profiles SET verification_status = 'REJECTED' WHERE user_id = $1", [provider2Id]);
  const resRejectedAccept = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bPendingId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resRejectedAccept.statusCode === 403, 'Rejected worker receives 403 Forbidden on accept');
  const bodyRejectedAccept = JSON.parse(resRejectedAccept.payload);
  testAssert(bodyRejectedAccept.error?.code === 'FORBIDDEN', 'Rejected worker error code is FORBIDDEN');

  // Restore verification_status to VERIFIED
  await pool.query("UPDATE provider_profiles SET verification_status = 'VERIFIED' WHERE user_id = $1", [provider2Id]);

  // Test 6c.3: Unavailable worker receives 400 PROVIDER_UNAVAILABLE
  await pool.query("UPDATE provider_profiles SET is_available = false WHERE user_id = $1", [provider2Id]);
  const resUnavailAccept = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bPendingId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resUnavailAccept.statusCode === 400, 'Unavailable worker receives 400 Bad Request on accept');
  const bodyUnavailAccept = JSON.parse(resUnavailAccept.payload);
  testAssert(bodyUnavailAccept.error?.code === 'PROVIDER_UNAVAILABLE', 'Unavailable worker error code is PROVIDER_UNAVAILABLE');

  // Restore is_available to true
  await pool.query("UPDATE provider_profiles SET is_available = true WHERE user_id = $1", [provider2Id]);

  // Test 6c.4: Worker with active job claiming new job receives 409 ACTIVE_BOOKING_EXISTS
  // Accept bPendingId first to establish active job
  const resActiveInitial = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bPendingId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resActiveInitial.statusCode === 200, 'Provider 2 accepts first job normally (200 OK)');

  // Now create second job bSecondKey
  const bSecondKey = `accept-test-second-${Date.now()}`;
  const { rows: bSecondRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Pipe repair', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bSecondKey, customerId]
  );
  const bSecondId = bSecondRows[0].id;

  const resActiveConflict = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bSecondId}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resActiveConflict.statusCode === 409, 'Provider with existing active job receives 409 Conflict');
  const bodyActiveConflict = JSON.parse(resActiveConflict.payload);
  testAssert(bodyActiveConflict.error?.code === 'ACTIVE_BOOKING_EXISTS', 'Active job conflict error code is ACTIVE_BOOKING_EXISTS');

  // Complete the active jobs so provider2 is clean
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id IN ($1, $2)", [bPendingId, bSecondId]);

  // Test 6c.4b: Worker with PROVIDER_ASSIGNED job claiming open broadcast job receives 409 ACTIVE_BOOKING_EXISTS
  const bAsgnKey = `accept-test-asgn-${Date.now()}`;
  const { rows: bAsgnRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'plumber', 'station-colony', 'Assigned offer', 99.00, 'PROVIDER_ASSIGNED')
     RETURNING id`,
    [bAsgnKey, customerId, provider2Id]
  );
  const bAsgnId = bAsgnRows[0].id;

  const bOpenKey1 = `accept-test-open1-${Date.now()}`;
  const { rows: bOpen1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Open Job 1', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bOpenKey1, customerId]
  );
  const bOpen1Id = bOpen1Rows[0].id;

  const resAsgnConflict = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bOpen1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resAsgnConflict.statusCode === 409, 'Provider with PROVIDER_ASSIGNED job receives 409 when claiming open job');
  testAssert(JSON.parse(resAsgnConflict.payload).error?.code === 'ACTIVE_BOOKING_EXISTS', 'Error code is ACTIVE_BOOKING_EXISTS for PROVIDER_ASSIGNED');

  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [bAsgnId]);

  // Test 6c.4c: Worker with SERVICE_COMPLETED job claiming open broadcast job receives 409 ACTIVE_BOOKING_EXISTS
  const bSCompKey = `accept-test-scomp-${Date.now()}`;
  const { rows: bSCompRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'plumber', 'station-colony', 'Service completed job', 99.00, 'SERVICE_COMPLETED')
     RETURNING id`,
    [bSCompKey, customerId, provider2Id]
  );
  const bSCompId = bSCompRows[0].id;

  const resSCompConflict = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bOpen1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resSCompConflict.statusCode === 409, 'Provider with SERVICE_COMPLETED job receives 409 when claiming open job');
  testAssert(JSON.parse(resSCompConflict.payload).error?.code === 'ACTIVE_BOOKING_EXISTS', 'Error code is ACTIVE_BOOKING_EXISTS for SERVICE_COMPLETED');

  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [bSCompId]);

  // Test 6c.4d: Worker with PAYMENT_COLLECTED job claiming open broadcast job receives 409 ACTIVE_BOOKING_EXISTS
  const bPCollKey = `accept-test-pcoll-${Date.now()}`;
  const { rows: bPCollRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'plumber', 'station-colony', 'Payment collected job', 99.00, 'PAYMENT_COLLECTED')
     RETURNING id`,
    [bPCollKey, customerId, provider2Id]
  );
  const bPCollId = bPCollRows[0].id;

  const resPCollConflict = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bOpen1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resPCollConflict.statusCode === 409, 'Provider with PAYMENT_COLLECTED job receives 409 when claiming open job');
  testAssert(JSON.parse(resPCollConflict.payload).error?.code === 'ACTIVE_BOOKING_EXISTS', 'Error code is ACTIVE_BOOKING_EXISTS for PAYMENT_COLLECTED');

  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [bPCollId]);

  // Test 6c.4e: With previous bookings BOOKING_COMPLETED, worker can claim open job -> 200 OK
  const resOpen1Success = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${bOpen1Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(resOpen1Success.statusCode === 200, 'Provider with only BOOKING_COMPLETED historical jobs can claim open job (200 OK)');

  // Complete bOpen1Id before next test
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [bOpen1Id]);

  // Test 6c.5: Two concurrent claims for two different bookings by the same provider (one 200, one 409)
  const bConcAKey = `accept-test-conca-${Date.now()}`;
  const bConcBKey = `accept-test-concb-${Date.now()}`;
  const { rows: bConcARows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Concurrent Job A', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bConcAKey, customerId]
  );
  const { rows: bConcBRows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'station-colony', 'Concurrent Job B', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [bConcBKey, customerId]
  );
  const bConcAId = bConcARows[0].id;
  const bConcBId = bConcBRows[0].id;

  const [concResA, concResB] = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${bConcAId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    }),
    app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${bConcBId}/accept`,
      headers: { authorization: `Bearer ${provider2Token}` },
    }),
  ]);

  const concCodes = [concResA.statusCode, concResB.statusCode].sort();
  testAssert(concCodes[0] === 200 && concCodes[1] === 409, 'Same provider claiming two different jobs concurrently: exactly one 200, exactly one 409');

  const concConflictBody = concResA.statusCode === 409 ? JSON.parse(concResA.payload) : JSON.parse(concResB.payload);
  testAssert(concConflictBody.error?.code === 'ACTIVE_BOOKING_EXISTS', 'Failing concurrent claim error code is ACTIVE_BOOKING_EXISTS');

  const { rows: concDbRows } = await pool.query<{ id: string; status: string; provider_id: string | null }>(
    'SELECT id, status, provider_id FROM bookings WHERE id IN ($1, $2)',
    [bConcAId, bConcBId]
  );
  const acceptedJobs = concDbRows.filter((r) => r.status === 'PROVIDER_ACCEPTED' && r.provider_id === provider2Id);
  const requestedJobs = concDbRows.filter((r) => r.status === 'SERVICE_REQUESTED' && r.provider_id === null);
  testAssert(acceptedJobs.length === 1, 'Exactly one booking transitioned to PROVIDER_ACCEPTED for the provider');
  testAssert(requestedJobs.length === 1, 'The other booking remains SERVICE_REQUESTED and unclaimed');

  // Complete concurrent jobs
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id IN ($1, $2)", [bConcAId, bConcBId]);

  console.log('\n--- 7. Bilingual i18n Key Symmetry Audit for Module 8 ---');

  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  testAssert(enKeys.length === hiKeys.length, `Matching dictionary sizes (${enKeys.length} keys each) (Requirement 31)`);

  let allKeysPresent = true;
  let allNonEmpty = true;
  let noMixedHindi = true;

  for (const k of enKeys) {
    if (!hi[k as keyof typeof hi]) {
      allKeysPresent = false;
      console.error(`  Missing Hindi key: ${k}`);
    }
    const enVal = en[k as keyof typeof en];
    const hiVal = hi[k as keyof typeof hi];
    if (!enVal || enVal.trim() === '') allNonEmpty = false;
    if (!hiVal || hiVal.trim() === '') allNonEmpty = false;

    if (k !== 'lang.choose_title') {
      if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
        noMixedHindi = false;
        console.error(`  Leaked parenthetical English in Hindi key "${k}": ${hiVal}`);
      }
    }
  }

  testAssert(allKeysPresent, 'All translation keys exist in both English and Hindi (Requirement 31)');
  testAssert(allNonEmpty, 'No translation strings are blank or empty');
  testAssert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary (Requirement 32)');

  // Clean up fixtures
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

  console.log('\n============================================================');
  console.log(`PROVIDER ACCEPTANCE & CONCURRENCY TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  await app.close();
  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runProviderAcceptanceTests().catch((err) => {
  console.error('Acceptance test runner fatal error:', err);
  process.exit(1);
});
