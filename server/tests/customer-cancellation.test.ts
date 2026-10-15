import { buildApp } from '../src/app';
import { db } from '../src/db';
import { ApiResponse, Booking, BookingDetail, BookingStatus, canTransition } from '@shared';
import { createTestCustomer, createTestProvider, createTestAdmin } from './helpers/auth-helper';

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

async function runCustomerCancellationTests() {
  console.log('\n============================================================');
  console.log('MODULE 13 — CUSTOMER BOOKING CANCELLATION TEST SUITE');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  // Test phone numbers for fixtures
  const c1Phone = '9800099001';
  const c2Phone = '9800099002';
  const pPhone = '9800099003';
  const adminPhone = '9800099004';

  async function cleanupFixtures() {
    await pool!.query(
      `DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))`,
      [c1Phone, c2Phone, pPhone, adminPhone]
    );
    await pool!.query(
      `DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2))
          OR provider_id IN (SELECT id FROM users WHERE phone IN ($3))`,
      [c1Phone, c2Phone, pPhone]
    );
    await pool!.query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1))`,
      [pPhone]
    );
    await pool!.query(
      `DELETE FROM users WHERE phone IN ($1, $2, $3, $4)`,
      [c1Phone, c2Phone, pPhone, adminPhone]
    );
  }

  try {
    await cleanupFixtures();

    // 1. Seed users & obtain tokens via central auth helper
    const authC1 = await createTestCustomer(app, c1Phone, 'Customer One');
    const c1Id = authC1.id;
    const c1Token = authC1.token;

    const authC2 = await createTestCustomer(app, c2Phone, 'Customer Two');
    const c2Id = authC2.id;
    const c2Token = authC2.token;

    const authP = await createTestProvider(app, pPhone, 'Provider Ramesh');
    const pId = authP.id;
    const pToken = authP.token;

    const authAdmin = await createTestAdmin(app, adminPhone, 'Admin Staff');
    const adminId = authAdmin.id;
    const adminToken = authAdmin.token;

    // Seed provider profile for electrician
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
       VALUES ($1, 'electrician', 'Chandil Bazar', true, 'VERIFIED')`,
      [pId]
    );

    // Helper: Seed a booking directly
    async function seedBooking(opts: {
      customerId?: string;
      providerId?: string | null;
      status?: BookingStatus;
      keySuffix?: string;
      visitingFee?: number;
      finalAmount?: number | null;
      paymentCollected?: boolean;
      acceptedAt?: Date | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }): Promise<string> {
      const bRes = await pool!.query<{ id: string }>(
        `INSERT INTO bookings (
           idempotency_key, customer_id, provider_id, category_id,
           area_locality, landmark, text_description, status,
           visiting_fee, final_amount, payment_method, payment_collected,
           accepted_at, started_at, completed_at
         ) VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Near Temple', 'Fan issue', $4, $5, $6, 'CASH', $7, $8, $9, $10)
         RETURNING id`,
        [
          `idem-canc-${Date.now()}-${opts.keySuffix || Math.random().toString(36).substring(7)}`,
          opts.customerId || c1Id,
          opts.providerId || null,
          opts.status || 'SERVICE_REQUESTED',
          opts.visitingFee || 149.0,
          opts.finalAmount !== undefined ? opts.finalAmount : null,
          opts.paymentCollected || false,
          opts.acceptedAt || null,
          opts.startedAt || null,
          opts.completedAt || null,
        ]
      );
      const bId = bRes.rows[0].id;
      await pool!.query(
        `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
         VALUES ($1, NULL, $2, $3, 'Initial creation')`,
        [bId, opts.status || 'SERVICE_REQUESTED', opts.customerId || c1Id]
      );
      return bId;
    }

    // ============================================================
    // --- 1. AUTHENTICATION & RBAC ---
    // ============================================================
    console.log('--- 1. Authentication & RBAC Verification ---');

    const bAuthTestId = await seedBooking({ status: 'SERVICE_REQUESTED' });

    // 1. Missing token -> 401
    const resNoToken = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAuthTestId}/cancel`,
      payload: {},
    });
    assert(resNoToken.statusCode === 401, '1a. Missing authentication token returns 401 Unauthorized');
    assert(resNoToken.json().error.code === 'UNAUTHORIZED', '1b. Error code is UNAUTHORIZED');

    // 1c. Invalid / malformed token -> 401
    const resBadToken = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAuthTestId}/cancel`,
      headers: { authorization: 'Bearer invalid.token.payload' },
      payload: {},
    });
    assert(resBadToken.statusCode === 401, '1c. Malformed token returns 401 Unauthorized');

    // 2. Provider role forbidden -> 403
    const resProviderRole = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAuthTestId}/cancel`,
      headers: { authorization: `Bearer ${pToken}` },
      payload: {},
    });
    assert(resProviderRole.statusCode === 403, '2a. Provider role is rejected with 403 Forbidden');
    assert(resProviderRole.json().error.code === 'FORBIDDEN', '2b. Error code is FORBIDDEN');

    // 2c. Admin role forbidden on customer cancellation endpoint -> 403
    const resAdminRole = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAuthTestId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    assert(resAdminRole.statusCode === 403, '2c. Admin role rejected on customer cancellation endpoint with 403 Forbidden');

    // ============================================================
    // --- 2. INPUT VALIDATION & UUID SAFETY ---
    // ============================================================
    console.log('\n--- 2. Input Validation & UUID Safety ---');

    // 3. Invalid UUID format -> 400 INVALID_ID
    const resInvalidUuid = await app.inject({
      method: 'POST',
      url: '/api/bookings/not-a-valid-uuid/cancel',
      headers: { authorization: `Bearer ${c1Token}` },
      payload: {},
    });
    assert(resInvalidUuid.statusCode === 400, '3a. Invalid UUID format returns 400 Bad Request');
    assert(resInvalidUuid.json().error.code === 'INVALID_ID', '3b. Error code is INVALID_ID');

    // 4. Booking not found -> 404 BOOKING_NOT_FOUND
    const nonExistentUuid = 'b0000000-9999-4444-8888-000000000099';
    const resNotFound = await app.inject({
      method: 'POST',
      url: `/api/bookings/${nonExistentUuid}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: {},
    });
    assert(resNotFound.statusCode === 404, '4a. Non-existent booking returns 404 Not Found');
    assert(resNotFound.json().error.code === 'BOOKING_NOT_FOUND', '4b. Error code is BOOKING_NOT_FOUND');

    // ============================================================
    // --- 3. CUSTOMER OWNERSHIP & PRIVACY ---
    // ============================================================
    console.log('\n--- 3. Customer Ownership & Privacy ---');

    // 5. Customer 1 owns booking A -> can cancel
    const bC1OwnId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'c1-own' });
    const resC1Own = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bC1OwnId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'No longer needed' },
    });
    assert(resC1Own.statusCode === 200, '5a. Customer successfully cancels own booking (200 OK)');
    assert(resC1Own.json().data.status === 'CANCELLED_BY_CUSTOMER', '5b. Resulting status is CANCELLED_BY_CUSTOMER');

    // 6. Another customer's booking -> 403 FORBIDDEN
    const bC2OwnId = await seedBooking({ customerId: c2Id, status: 'SERVICE_REQUESTED', keySuffix: 'c2-own' });
    const resC1Steal = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bC2OwnId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Unauthorized cancellation attempt' },
    });
    assert(resC1Steal.statusCode === 403, '6a. Attempt to cancel another customer booking returns 403 Forbidden');
    assert(resC1Steal.json().error.code === 'FORBIDDEN', '6b. Error code is FORBIDDEN');

    // Verify booking C2 remains uncancelled in database
    const { rows: checkC2Unchanged } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [bC2OwnId]
    );
    assert(checkC2Unchanged[0].status === 'SERVICE_REQUESTED', '6c. Another customer booking status remains unmutated');

    // ============================================================
    // --- 4. VALID CANCELLATION STATE TRANSITIONS ---
    // ============================================================
    console.log('\n--- 4. Valid Cancellation State Transitions ---');

    // 7. SERVICE_REQUESTED -> CANCELLED_BY_CUSTOMER
    const bReqId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'req' });
    const resReq = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bReqId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: {},
    });
    assert(resReq.statusCode === 200, '7a. SERVICE_REQUESTED cancels successfully (200 OK)');
    assert(resReq.json().data.status === 'CANCELLED_BY_CUSTOMER', '7b. Status changed to CANCELLED_BY_CUSTOMER');

    // 8. PROVIDER_ASSIGNED -> CANCELLED_BY_CUSTOMER
    const bAssignedId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ASSIGNED',
      keySuffix: 'assigned',
    });
    const resAssigned = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAssignedId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Change of plans' },
    });
    assert(resAssigned.statusCode === 200, '8a. PROVIDER_ASSIGNED cancels successfully (200 OK)');
    assert(resAssigned.json().data.status === 'CANCELLED_BY_CUSTOMER', '8b. Status changed to CANCELLED_BY_CUSTOMER');

    // 9. PROVIDER_ACCEPTED -> CANCELLED_BY_CUSTOMER
    const bAcceptedId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ACCEPTED',
      acceptedAt: new Date(),
      keySuffix: 'accepted',
    });
    const resAccepted = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAcceptedId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Problem fixed by neighbour' },
    });
    assert(resAccepted.statusCode === 200, '9a. PROVIDER_ACCEPTED cancels successfully (200 OK)');
    assert(resAccepted.json().data.status === 'CANCELLED_BY_CUSTOMER', '9b. Status changed to CANCELLED_BY_CUSTOMER');

    // ============================================================
    // --- 5. INVALID CANCELLATION STATE TRANSITIONS (409) ---
    // ============================================================
    console.log('\n--- 5. Invalid Cancellation State Transitions (409 Conflict) ---');

    // 10. PROVIDER_ON_THE_WAY rejected
    const bOnTheWayId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'PROVIDER_ON_THE_WAY', keySuffix: 'otw' });
    const resOtw = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bOnTheWayId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resOtw.statusCode === 409, '10a. PROVIDER_ON_THE_WAY cancellation rejected with 409 Conflict');
    assert(resOtw.json().error.code === 'INVALID_STATUS_TRANSITION', '10b. Error code is INVALID_STATUS_TRANSITION');

    // 11. SERVICE_STARTED rejected
    const bStartedId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'SERVICE_STARTED', keySuffix: 'started' });
    const resStarted = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bStartedId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resStarted.statusCode === 409, '11. SERVICE_STARTED cancellation rejected with 409 Conflict');

    // 12. SERVICE_COMPLETED rejected
    const bCompletedId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'SERVICE_COMPLETED', keySuffix: 'completed' });
    const resCompleted = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bCompletedId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resCompleted.statusCode === 409, '12. SERVICE_COMPLETED cancellation rejected with 409 Conflict');

    // 13. PAYMENT_PENDING rejected
    const bPayPendingId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'PAYMENT_PENDING', keySuffix: 'paypend' });
    const resPayPending = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bPayPendingId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resPayPending.statusCode === 409, '13. PAYMENT_PENDING cancellation rejected with 409 Conflict');

    // 14. PAYMENT_COLLECTED rejected
    const bPayCollectedId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'PAYMENT_COLLECTED', keySuffix: 'paycoll' });
    const resPayCollected = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bPayCollectedId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resPayCollected.statusCode === 409, '14. PAYMENT_COLLECTED cancellation rejected with 409 Conflict');

    // 15. BOOKING_COMPLETED rejected
    const bBookingDoneId = await seedBooking({ customerId: c1Id, providerId: pId, status: 'BOOKING_COMPLETED', keySuffix: 'done' });
    const resBookingDone = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bBookingDoneId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resBookingDone.statusCode === 409, '15. BOOKING_COMPLETED cancellation rejected with 409 Conflict');

    // 16. Already CANCELLED_BY_CUSTOMER rejected
    const bAlreadyCustCancId = await seedBooking({ customerId: c1Id, status: 'CANCELLED_BY_CUSTOMER', keySuffix: 'custcanc' });
    const resAlreadyCustCanc = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAlreadyCustCancId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resAlreadyCustCanc.statusCode === 409, '16. Already CANCELLED_BY_CUSTOMER rejected with 409 Conflict');

    // 17. CANCELLED_BY_ADMIN rejected
    const bAdminCancId = await seedBooking({ customerId: c1Id, status: 'CANCELLED_BY_ADMIN', keySuffix: 'admincanc' });
    const resAdminCanc = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAdminCancId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
    });
    assert(resAdminCanc.statusCode === 409, '17. CANCELLED_BY_ADMIN rejected with 409 Conflict');

    // ============================================================
    // --- 6. REASON VALIDATION & SERVER NOTES ---
    // ============================================================
    console.log('\n--- 6. Reason Validation & Server Notes ---');

    // 18. Optional reason: omitted entirely
    const bOptReasonId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'opt-reason' });
    const resNoReason = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bOptReasonId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      // no payload
    });
    assert(resNoReason.statusCode === 200, '18a. Cancellation with omitted reason succeeds (200 OK)');
    const { rows: optLogRows } = await pool.query<{ notes: string }>(
      'SELECT notes FROM booking_status_logs WHERE booking_id = $1 AND to_status = $2',
      [bOptReasonId, 'CANCELLED_BY_CUSTOMER']
    );
    assert(optLogRows[0].notes === 'Cancelled by customer', '18b. Server-generated default note recorded');

    // 19. Reason trimming: leading and trailing whitespace trimmed
    const bTrimReasonId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'trim-reason' });
    const resTrim = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bTrimReasonId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: '   Problem resolved on its own   ' },
    });
    assert(resTrim.statusCode === 200, '19a. Whitespace padded reason accepted (200 OK)');
    const { rows: trimLogRows } = await pool.query<{ notes: string }>(
      'SELECT notes FROM booking_status_logs WHERE booking_id = $1 AND to_status = $2',
      [bTrimReasonId, 'CANCELLED_BY_CUSTOMER']
    );
    assert(trimLogRows[0].notes === 'Problem resolved on its own', '19b. Reason stored cleanly trimmed in audit log');

    // 20. Reason max length: > 255 chars rejected -> 400 VALIDATION_ERROR
    const bLongReasonId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'long-reason' });
    const hugeReason = 'A'.repeat(256);
    const resLongReason = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bLongReasonId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: hugeReason },
    });
    assert(resLongReason.statusCode === 400, '20a. Reason > 255 chars rejected with 400 Bad Request');
    assert(resLongReason.json().error.code === 'VALIDATION_ERROR', '20b. Error code is VALIDATION_ERROR');

    // 21. Empty / whitespace-only reason rejected -> 400 VALIDATION_ERROR
    const bEmptyReasonId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'empty-reason' });
    const resEmptyReason = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bEmptyReasonId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: '    ' },
    });
    assert(resEmptyReason.statusCode === 400, '21a. Whitespace-only reason rejected with 400 Bad Request');
    assert(resEmptyReason.json().error.code === 'VALIDATION_ERROR', '21b. Error code is VALIDATION_ERROR');

    // Non-string reason rejected
    const resNonStringReason = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bEmptyReasonId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 12345 as any },
    });
    assert(resNonStringReason.statusCode === 400, '21c. Non-string reason rejected with 400 Bad Request');

    // ============================================================
    // --- 7. AUDIT LOG & TRANSACTIONAL INTEGRITY ---
    // ============================================================
    console.log('\n--- 7. Audit Log & Transactional Integrity ---');

    // 22. Audit log correctness
    const bAuditId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ASSIGNED',
      keySuffix: 'audit-verify',
    });
    const resAudit = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bAuditId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Found local technician' },
    });
    assert(resAudit.statusCode === 200, '22a. Cancellation returns 200');

    const { rows: auditRows } = await pool.query<{
      booking_id: string;
      from_status: string;
      to_status: string;
      changed_by: string;
      notes: string;
      created_at: Date;
    }>(
      `SELECT booking_id, from_status, to_status, changed_by, notes, created_at
       FROM booking_status_logs
       WHERE booking_id = $1 AND to_status = 'CANCELLED_BY_CUSTOMER'`,
      [bAuditId]
    );
    assert(auditRows.length === 1, '22b. Exactly one cancellation audit log created');
    assert(auditRows[0].from_status === 'PROVIDER_ASSIGNED', '22c. from_status is accurately captured as PROVIDER_ASSIGNED');
    assert(auditRows[0].to_status === 'CANCELLED_BY_CUSTOMER', '22d. to_status is CANCELLED_BY_CUSTOMER');
    assert(auditRows[0].changed_by === c1Id, '22e. changed_by matches authenticated customer ID');
    assert(auditRows[0].notes === 'Found local technician', '22f. notes matches submitted reason');
    assert(auditRows[0].created_at instanceof Date, '22g. created_at is valid timestamp');

    // 23. Transactional rollback verification: no orphan audit log on rejected cancellation
    const bRollbackCheckId = await seedBooking({ customerId: c1Id, status: 'PROVIDER_ON_THE_WAY', keySuffix: 'no-orphan' });
    await app.inject({
      method: 'POST',
      url: `/api/bookings/${bRollbackCheckId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Should fail' },
    });
    const { rows: orphanCheck } = await pool.query(
      `SELECT * FROM booking_status_logs WHERE booking_id = $1 AND to_status = 'CANCELLED_BY_CUSTOMER'`,
      [bRollbackCheckId]
    );
    assert(orphanCheck.length === 0, '23. Zero orphan audit logs created when cancellation transition is rejected');

    // ============================================================
    // --- 8. CONCURRENCY & RACE CONDITIONS ---
    // ============================================================
    console.log('\n--- 8. Concurrency & Race Conditions ---');

    // 24. Two simultaneous customer cancellation requests
    const bConcId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'conc-2cust' });
    const [concRes1, concRes2] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/bookings/${bConcId}/cancel`, headers: { authorization: `Bearer ${c1Token}` }, payload: { reason: 'Req 1' } }),
      app.inject({ method: 'POST', url: `/api/bookings/${bConcId}/cancel`, headers: { authorization: `Bearer ${c1Token}` }, payload: { reason: 'Req 2' } }),
    ]);

    const statusCodesConc = [concRes1.statusCode, concRes2.statusCode].sort();
    assert(statusCodesConc[0] === 200 && statusCodesConc[1] === 409, '24a. Concurrent customer cancellations: exactly one 200 OK, one 409 Conflict');

    const { rows: concLogRows } = await pool.query(
      `SELECT * FROM booking_status_logs WHERE booking_id = $1 AND to_status = 'CANCELLED_BY_CUSTOMER'`,
      [bConcId]
    );
    assert(concLogRows.length === 1, '24b. Exactly one cancellation log inserted under concurrency');

    // 25. Customer cancellation vs Provider Acceptance
    // Complete any prior active bookings for provider P so provider is eligible to accept
    await pool.query(
      `UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE provider_id = $1 AND status IN ('PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COLLECTED')`,
      [pId]
    );

    // 25a. If customer cancels, provider cannot accept (receives 409 Conflict)
    const bCancelBeforeAcceptId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ASSIGNED',
      keySuffix: 'canc-before-acc',
    });

    const resCustCancelFirst = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bCancelBeforeAcceptId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Cancelled before technician acceptance' },
    });
    assert(resCustCancelFirst.statusCode === 200, '25a. Customer cancellation succeeds (200 OK)');

    const resProvAcceptAfterCancel = await app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${bCancelBeforeAcceptId}/accept`,
      headers: { authorization: `Bearer ${pToken}` },
    });
    assert(resProvAcceptAfterCancel.statusCode === 409, '25b. Provider acceptance on cancelled booking receives 409 Conflict');
    assert(resProvAcceptAfterCancel.json().error.code === 'JOB_ALREADY_CLAIMED', '25c. Provider error code is JOB_ALREADY_CLAIMED');

    // 25d. Concurrent cancellation vs acceptance race:
    // Guarantees atomic serialization, final state CANCELLED_BY_CUSTOMER, and zero data corruption
    const bRaceAcceptId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ASSIGNED',
      keySuffix: 'race-accept',
    });
    const [raceCustRes, raceProvRes] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/bookings/${bRaceAcceptId}/cancel`, headers: { authorization: `Bearer ${c1Token}` }, payload: { reason: 'Race cancel' } }),
      app.inject({ method: 'POST', url: `/api/provider/jobs/${bRaceAcceptId}/accept`, headers: { authorization: `Bearer ${pToken}` } }),
    ]);

    const { rows: raceAcceptFinal } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [bRaceAcceptId]
    );
    assert(
      raceAcceptFinal[0].status === 'CANCELLED_BY_CUSTOMER',
      '25d. Concurrently raced booking resolves strictly to CANCELLED_BY_CUSTOMER'
    );
    assert(
      (raceCustRes.statusCode === 200 && raceProvRes.statusCode === 409) ||
      (raceCustRes.statusCode === 200 && raceProvRes.statusCode === 200),
      '25e. Concurrent race handles serialization safely without 500 error or deadlock'
    );

    // 26. Cancellation vs Admin Cancellation race
    const bRaceAdminId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'race-admin' });
    const [raceAdminCustRes, raceAdminRes] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/bookings/${bRaceAdminId}/cancel`, headers: { authorization: `Bearer ${c1Token}` }, payload: { reason: 'Cust race' } }),
      app.inject({ method: 'POST', url: `/api/admin/bookings/${bRaceAdminId}/cancel`, headers: { authorization: `Bearer ${adminToken}` }, payload: { reason: 'Admin race cancel' } }),
    ]);

    const raceAdminCodes = [raceAdminCustRes.statusCode, raceAdminRes.statusCode].sort();
    assert(raceAdminCodes[0] === 200 && raceAdminCodes[1] === 409, '26a. Customer cancellation vs Admin cancellation: exactly one 200 OK, one 409 Conflict');

    const { rows: raceAdminFinal } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [bRaceAdminId]
    );
    assert(
      raceAdminFinal[0].status === 'CANCELLED_BY_CUSTOMER' || raceAdminFinal[0].status === 'CANCELLED_BY_ADMIN',
      '26b. Final status is strictly consistent with the winning race transaction'
    );

    // 27. Cancellation vs Provider Progression (on-the-way) race
    const bRaceOtwId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ACCEPTED',
      acceptedAt: new Date(),
      keySuffix: 'race-otw',
    });
    const [raceOtwCustRes, raceOtwProvRes] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/bookings/${bRaceOtwId}/cancel`, headers: { authorization: `Bearer ${c1Token}` }, payload: { reason: 'Cancelling before OTW' } }),
      app.inject({ method: 'POST', url: `/api/provider/jobs/${bRaceOtwId}/status`, headers: { authorization: `Bearer ${pToken}` }, payload: { status: 'PROVIDER_ON_THE_WAY' } }),
    ]);

    const raceOtwCodes = [raceOtwCustRes.statusCode, raceOtwProvRes.statusCode].sort();
    assert(raceOtwCodes[0] === 200 && raceOtwCodes[1] === 409, '27a. Customer cancel vs Provider on-the-way: exactly one 200 OK, one 409 Conflict');

    const { rows: raceOtwFinal } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [bRaceOtwId]
    );
    assert(
      raceOtwFinal[0].status === 'CANCELLED_BY_CUSTOMER' || raceOtwFinal[0].status === 'PROVIDER_ON_THE_WAY',
      '27b. Final status strictly consistent with winning transition'
    );

    // 28. Repeated cancellation after successful cancellation
    const bRepeatId = await seedBooking({ customerId: c1Id, status: 'SERVICE_REQUESTED', keySuffix: 'repeat' });
    const resRepeat1 = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bRepeatId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'First cancel' },
    });
    assert(resRepeat1.statusCode === 200, '28a. First cancellation succeeds (200 OK)');

    const resRepeat2 = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bRepeatId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Second cancel attempt' },
    });
    assert(resRepeat2.statusCode === 409, '28b. Repeated cancellation rejected with 409 Conflict');

    const { rows: repeatLogs } = await pool.query(
      `SELECT * FROM booking_status_logs WHERE booking_id = $1 AND to_status = 'CANCELLED_BY_CUSTOMER'`,
      [bRepeatId]
    );
    assert(repeatLogs.length === 1, '28c. Repeated cancellation created zero duplicate status logs');

    // ============================================================
    // --- 9. INVARIANT PRESERVATION ---
    // ============================================================
    console.log('\n--- 9. Invariant Preservation ---');

    const acceptedTimestamp = new Date('2026-03-01T12:00:00Z');
    const bInvariantId = await seedBooking({
      customerId: c1Id,
      providerId: pId,
      status: 'PROVIDER_ACCEPTED',
      visitingFee: 199.5,
      finalAmount: 350.0,
      paymentCollected: false,
      acceptedAt: acceptedTimestamp,
      keySuffix: 'invariants',
    });

    const resInvCancel = await app.inject({
      method: 'POST',
      url: `/api/bookings/${bInvariantId}/cancel`,
      headers: { authorization: `Bearer ${c1Token}` },
      payload: { reason: 'Verify invariants' },
    });
    assert(resInvCancel.statusCode === 200, '29a. Invariant test booking cancelled successfully (200 OK)');

    const { rows: invCheckRows } = await pool.query<{
      status: string;
      provider_id: string | null;
      visiting_fee: string | number;
      final_amount: string | number | null;
      payment_method: string;
      payment_collected: boolean;
      accepted_at: Date | null;
      started_at: Date | null;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT status, provider_id, visiting_fee, final_amount, payment_method,
              payment_collected, accepted_at, started_at, completed_at, updated_at
       FROM bookings WHERE id = $1`,
      [bInvariantId]
    );

    const inv = invCheckRows[0];

    // 29. Financial invariants
    assert(parseFloat(String(inv.visiting_fee)) === 199.5, '29b. visiting_fee preserved (199.5)');
    assert(parseFloat(String(inv.final_amount)) === 350.0, '29c. final_amount preserved (350.0)');
    assert(inv.payment_method === 'CASH', '29d. payment_method preserved (CASH)');
    assert(inv.payment_collected === false, '29e. payment_collected preserved (false)');

    // 30. Provider & timestamp invariants
    assert(inv.provider_id === pId, '30a. provider_id preserved (historical attribution maintained, not nullified)');
    assert(
      inv.accepted_at?.toISOString() === acceptedTimestamp.toISOString(),
      '30b. accepted_at timestamp preserved intact'
    );
    assert(inv.started_at === null, '30c. started_at remains null');
    assert(inv.completed_at === null, '30d. completed_at remains null');
    assert(inv.status === 'CANCELLED_BY_CUSTOMER', '30e. status is CANCELLED_BY_CUSTOMER');

    console.log('\n============================================================');
    console.log(`CUSTOMER CANCELLATION TESTS: ${passed} passed, ${failed} failed`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await cleanupFixtures();
    await app.close();
  }
}

runCustomerCancellationTests()
  .then(() => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Unhandled failure in customer cancellation tests:', err);
    process.exit(1);
  });
