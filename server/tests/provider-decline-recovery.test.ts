import { buildApp } from '../src/app';
import { db } from '../src/db';
import { ApiResponse, BookingDetail, ProviderJob, AdminBookingDetail } from '@shared';
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

async function runDeclineRecoveryTests() {
  console.log('\n============================================================');
  console.log('PHASE 4 — PROVIDER JOB DECLINE & RECOVERY TEST SUITE');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  // Test phone numbers
  const custPhone = '9800099101';
  const prov1Phone = '9800099102'; // Electrician 1
  const prov2Phone = '9800099103'; // Electrician 2 (peer)
  const provPlumberPhone = '9800099104'; // Plumber (different category)
  const adminPhone = '9800099105';

  async function cleanup() {
    await pool!.query(
      `DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4, $5))`,
      [custPhone, prov1Phone, prov2Phone, provPlumberPhone, adminPhone]
    );
    await pool!.query(
      `DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1))
          OR provider_id IN (SELECT id FROM users WHERE phone IN ($2, $3, $4))`,
      [custPhone, prov1Phone, prov2Phone, provPlumberPhone]
    );
    await pool!.query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))`,
      [prov1Phone, prov2Phone, provPlumberPhone]
    );
    await pool!.query(
      `DELETE FROM users WHERE phone IN ($1, $2, $3, $4, $5)`,
      [custPhone, prov1Phone, prov2Phone, provPlumberPhone, adminPhone]
    );
  }

  try {
    await cleanup();

    // 1. Seed users & obtain tokens
    const cust = await createTestCustomer(app, custPhone, 'Rahul Verma');
    const prov1 = await createTestProvider(app, prov1Phone, 'Sunil Electrician');
    const prov2 = await createTestProvider(app, prov2Phone, 'Amit Electrician');
    const provPlumber = await createTestProvider(app, provPlumberPhone, 'Raju Plumber');
    const admin = await createTestAdmin(app, adminPhone, 'Admin Officer');

    // Seed profiles
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
       VALUES ($1, 'electrician', 'Chandil', true, 'VERIFIED'),
              ($2, 'electrician', 'Chandil', true, 'VERIFIED'),
              ($3, 'plumber', 'Chandil', true, 'VERIFIED')`,
      [prov1.id, prov2.id, provPlumber.id]
    );

    // ─────────────────────────────────────────────────────────────
    console.log('--- 1. Decline of Directly Assigned Job (PROVIDER_ASSIGNED) ---');
    // ─────────────────────────────────────────────────────────────
    const b1Key = `p4-assign-${Date.now()}`;
    const { rows: b1Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Near Durga Mandir', 'Switchboard sparking', 99.00, 'PROVIDER_ASSIGNED')
       RETURNING id`,
      [b1Key, cust.id, prov1.id]
    );
    const b1Id = b1Rows[0].id;
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', $2, 'Assigned by admin')`,
      [b1Id, admin.id]
    );

    // Prov1 declines the assigned job
    const decAssignedRes = await app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${b1Id}/reject`,
      headers: prov1.headers,
    });
    assert(decAssignedRes.statusCode === 200, 'Assigned provider can decline job (200 OK)');
    const decAssignedBody: ApiResponse<ProviderJob> = JSON.parse(decAssignedRes.payload);
    assert(decAssignedBody.success === true, 'Success envelope is true');
    assert(decAssignedBody.data?.status === 'SERVICE_REQUESTED', 'Returned job status is SERVICE_REQUESTED');

    // Verify database recovery
    const { rows: b1Db } = await pool.query<{ status: string; provider_id: string | null; accepted_at: Date | null }>(
      'SELECT status, provider_id, accepted_at FROM bookings WHERE id = $1',
      [b1Id]
    );
    assert(b1Db[0].status === 'SERVICE_REQUESTED', 'Database status recovered strictly to SERVICE_REQUESTED');
    assert(b1Db[0].provider_id === null, 'Database provider_id reset to NULL');
    assert(b1Db[0].accepted_at === null, 'Database accepted_at is NULL');

    // Verify sequential audit logs
    const { rows: b1Logs } = await pool.query<{ from_status: string; to_status: string; changed_by: string; notes: string }>(
      'SELECT from_status, to_status, changed_by, notes FROM booking_status_logs WHERE booking_id = $1 ORDER BY id ASC',
      [b1Id]
    );
    assert(b1Logs.length === 3, 'Exactly three status logs exist (Assign + Decline + Recovery)');
    assert(b1Logs[1].from_status === 'PROVIDER_ASSIGNED', 'Log 2 from_status is PROVIDER_ASSIGNED');
    assert(b1Logs[1].to_status === 'REJECTED_BY_PROVIDER', 'Log 2 to_status is REJECTED_BY_PROVIDER');
    assert(b1Logs[1].changed_by === prov1.id, 'Log 2 changed_by is declining Provider 1');
    assert(b1Logs[2].from_status === 'REJECTED_BY_PROVIDER', 'Log 3 from_status is REJECTED_BY_PROVIDER');
    assert(b1Logs[2].to_status === 'SERVICE_REQUESTED', 'Log 3 to_status is SERVICE_REQUESTED');
    assert(b1Logs[2].notes === 'Recovered to open broadcast pool', 'Log 3 notes document recovery');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Decline of Accepted Broadcast Job (PROVIDER_ACCEPTED) ---');
    // ─────────────────────────────────────────────────────────────
    const b2Key = `p4-accept-${Date.now()}`;
    const { rows: b2Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status, accepted_at)
       VALUES ($1, $2, $3, 'electrician', 'station-colony', 'Platform 1', 'Main MCB tripping', 99.00, 'PROVIDER_ACCEPTED', NOW())
       RETURNING id`,
      [b2Key, cust.id, prov1.id]
    );
    const b2Id = b2Rows[0].id;
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ACCEPTED', $2, 'Technician accepted job')`,
      [b2Id, prov1.id]
    );

    // Prov1 declines/relinquishes accepted job
    const decAcceptedRes = await app.inject({
      method: 'POST',
      url: `/api/provider/jobs/${b2Id}/reject`,
      headers: prov1.headers,
    });
    assert(decAcceptedRes.statusCode === 200, 'Accepted provider can relinquish job (200 OK)');
    const decAcceptedBody: ApiResponse<ProviderJob> = JSON.parse(decAcceptedRes.payload);
    assert(decAcceptedBody.data?.status === 'SERVICE_REQUESTED', 'Returned job status is SERVICE_REQUESTED');

    // Verify sequential audit logs
    const { rows: b2Logs } = await pool.query<{ from_status: string; to_status: string; changed_by: string }>(
      'SELECT from_status, to_status, changed_by FROM booking_status_logs WHERE booking_id = $1 ORDER BY id ASC',
      [b2Id]
    );
    assert(b2Logs.length === 3, 'Exactly three status logs exist (Claim + Relinquish + Recovery)');
    assert(b2Logs[1].from_status === 'PROVIDER_ACCEPTED', 'Log 2 from_status is PROVIDER_ACCEPTED');
    assert(b2Logs[1].to_status === 'REJECTED_BY_PROVIDER', 'Log 2 to_status is REJECTED_BY_PROVIDER');
    assert(b2Logs[2].from_status === 'REJECTED_BY_PROVIDER', 'Log 3 from_status is REJECTED_BY_PROVIDER');
    assert(b2Logs[2].to_status === 'SERVICE_REQUESTED', 'Log 3 to_status is SERVICE_REQUESTED');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Authorization & Status Guards ---');
    // ─────────────────────────────────────────────────────────────
    // Unauthenticated
    const unauth = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/reject` });
    assert(unauth.statusCode === 401, 'Unauthenticated reject returns 401');

    // Customer
    const custReject = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/reject`, headers: cust.headers });
    assert(custReject.statusCode === 403, 'Customer role reject returns 403');

    // Admin
    const adminReject = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/reject`, headers: admin.headers });
    assert(adminReject.statusCode === 403, 'Admin role reject returns 403');

    // Unrelated provider (Prov2 trying to reject a job assigned to Prov1)
    const b3Key = `p4-unrelated-${Date.now()}`;
    const { rows: b3Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'gangdih', 99.00, 'PROVIDER_ACCEPTED') RETURNING id`,
      [b3Key, cust.id, prov1.id]
    );
    const b3Id = b3Rows[0].id;
    const unrelatedRes = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b3Id}/reject`, headers: prov2.headers });
    assert(unrelatedRes.statusCode === 409, 'Unrelated provider receives 409 Conflict');
    const unrelatedBody: ApiResponse = JSON.parse(unrelatedRes.payload);
    assert(unrelatedBody.error?.code === 'JOB_NO_LONGER_ASSIGNED', 'Error code is JOB_NO_LONGER_ASSIGNED');

    // Downstream state (PROVIDER_ON_THE_WAY cannot be rejected)
    await pool.query(`UPDATE bookings SET status = 'PROVIDER_ON_THE_WAY' WHERE id = $1`, [b3Id]);
    const downstreamRes = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b3Id}/reject`, headers: prov1.headers });
    assert(downstreamRes.statusCode === 409, 'PROVIDER_ON_THE_WAY cannot be rejected (409 Conflict)');
    await pool.query(`UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1`, [b3Id]);

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Broadcast Feed Isolation & Customer PII Protection ---');
    // ─────────────────────────────────────────────────────────────
    // For booking b1Id (declined by Prov1):
    // 4.1 Declined provider (Prov1) fetches feed: b1Id MUST NOT appear
    const prov1FeedRes = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: prov1.headers });
    const prov1Feed: ApiResponse<ProviderJob[]> = JSON.parse(prov1FeedRes.payload);
    const prov1HasB1 = (prov1Feed.data || []).some((j) => j.id === b1Id);
    assert(!prov1HasB1, 'Declined job b1 does NOT appear in Prov1 broadcast feed');

    // 4.2 Peer provider (Prov2) fetches feed: b1Id MUST appear
    const prov2FeedRes = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: prov2.headers });
    const prov2Feed: ApiResponse<ProviderJob[]> = JSON.parse(prov2FeedRes.payload);
    const prov2HasB1 = (prov2Feed.data || []).some((j) => j.id === b1Id);
    assert(prov2HasB1, 'Declined job b1 DOES appear in Prov2 broadcast feed');

    // 4.3 Plumber fetches feed: b1Id (electrician) MUST NOT appear (Category isolation)
    const plumberFeedRes = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: provPlumber.headers });
    const plumberFeed: ApiResponse<ProviderJob[]> = JSON.parse(plumberFeedRes.payload);
    const plumberHasB1 = (plumberFeed.data || []).some((j) => j.id === b1Id);
    assert(!plumberHasB1, 'Electrician job does NOT appear in Plumber broadcast feed');

    // 4.4 Prov1 attempts to inspect b1Id detail: MUST receive 404
    const prov1DetailRes = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b1Id}`, headers: prov1.headers });
    assert(prov1DetailRes.statusCode === 404, 'Declined provider receives 404 on open job detail (PII protected)');

    // 4.5 Prov2 inspects b1Id detail: 200 OK
    const prov2DetailRes = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b1Id}`, headers: prov2.headers });
    assert(prov2DetailRes.statusCode === 200, 'Eligible peer provider can inspect open job detail (200 OK)');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Re-Acceptance Guard & Recovery to Peer Technician ---');
    // ─────────────────────────────────────────────────────────────
    // 5.1 Prov1 attempts to accept b1Id (stale/repeated accept) -> 409 JOB_ALREADY_DECLINED
    const prov1AcceptRes = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/accept`, headers: prov1.headers });
    assert(prov1AcceptRes.statusCode === 409, 'Declined provider cannot accept open job (409 Conflict)');
    const prov1AcceptBody: ApiResponse = JSON.parse(prov1AcceptRes.payload);
    assert(prov1AcceptBody.error?.code === 'JOB_ALREADY_DECLINED', 'Error code is JOB_ALREADY_DECLINED');

    // 5.2 Plumber attempts to accept b1Id (category mismatch) -> 400 CATEGORY_MISMATCH
    const plumberAcceptRes = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/accept`, headers: provPlumber.headers });
    assert(plumberAcceptRes.statusCode === 400, 'Mismatched category provider cannot accept job (400)');
    const plumberAcceptBody: ApiResponse = JSON.parse(plumberAcceptRes.payload);
    assert(plumberAcceptBody.error?.code === 'CATEGORY_MISMATCH', 'Error code is CATEGORY_MISMATCH');

    // 5.3 Prov2 accepts b1Id -> 200 OK
    const prov2AcceptRes = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b1Id}/accept`, headers: prov2.headers });
    assert(prov2AcceptRes.statusCode === 200, 'Eligible peer provider successfully claims recovered job (200 OK)');
    const { rows: b1Claimed } = await pool.query<{ status: string; provider_id: string }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [b1Id]
    );
    assert(b1Claimed[0].status === 'PROVIDER_ACCEPTED', 'Booking transitioned to PROVIDER_ACCEPTED');
    assert(b1Claimed[0].provider_id === prov2.id, 'Booking claimed by Provider 2');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Explicit Admin Reassignment to Previously Declined Provider ---');
    // ─────────────────────────────────────────────────────────────
    // Create new job b4Id, assigned to Prov1, then Prov1 declines it
    const b4Key = `p4-reassign-${Date.now()}`;
    const { rows: b4Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'chilgu', 99.00, 'PROVIDER_ASSIGNED') RETURNING id`,
      [b4Key, cust.id, prov1.id]
    );
    const b4Id = b4Rows[0].id;
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', $2, 'Assigned by admin')`,
      [b4Id, admin.id]
    );

    // Prov1 declines b4Id
    await app.inject({ method: 'POST', url: `/api/provider/jobs/${b4Id}/reject`, headers: prov1.headers });

    // Verify b4Id is in SERVICE_REQUESTED
    const { rows: b4PreReassign } = await pool.query<{ status: string; provider_id: string | null }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [b4Id]
    );
    assert(b4PreReassign[0].status === 'SERVICE_REQUESTED' && b4PreReassign[0].provider_id === null, 'Job b4 is in SERVICE_REQUESTED pool');

    // Admin explicitly reassigns b4Id BACK to Prov1
    const reassignRes = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${b4Id}/assign`,
      headers: admin.headers,
      payload: { providerId: prov1.id },
    });
    assert(reassignRes.statusCode === 200, 'Admin can reassign booking back to Provider 1 (200 OK)');
    const reassignBody: ApiResponse<{ booking: any }> = JSON.parse(reassignRes.payload);
    assert(reassignBody.data?.booking.status === 'PROVIDER_ASSIGNED', 'Status updated to PROVIDER_ASSIGNED');

    // Prov1 now sees b4Id in feed because it is assigned to Prov1
    const prov1FeedAfterReassign = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: prov1.headers });
    const prov1FeedAfterBody: ApiResponse<ProviderJob[]> = JSON.parse(prov1FeedAfterReassign.payload);
    const hasReassignedB4 = (prov1FeedAfterBody.data || []).some((j) => j.id === b4Id);
    assert(hasReassignedB4, 'Reassigned job b4 appears in Prov1 feed as assigned job');

    // Prov1 can inspect b4Id detail
    const prov1B4Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b4Id}`, headers: prov1.headers });
    assert(prov1B4Detail.statusCode === 200, 'Prov1 can inspect explicitly reassigned job detail (200 OK)');

    // Prov1 can accept the newly assigned job
    const prov1AcceptReassigned = await app.inject({ method: 'POST', url: `/api/provider/jobs/${b4Id}/accept`, headers: prov1.headers });
    assert(prov1AcceptReassigned.statusCode === 200, 'Prov1 accepts explicitly reassigned job (200 OK)');
    const { rows: b4Final } = await pool.query<{ status: string; provider_id: string }>(
      'SELECT status, provider_id FROM bookings WHERE id = $1',
      [b4Id]
    );
    assert(b4Final[0].status === 'PROVIDER_ACCEPTED', 'Status is PROVIDER_ACCEPTED after accept');
    assert(b4Final[0].provider_id === prov1.id, 'Provider 1 is confirmed provider');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 7. Real Concurrency Races ---');
    // ─────────────────────────────────────────────────────────────
    // Race 1: Customer cancellation racing with provider decline
    const bRace1Key = `p4-race1-${Date.now()}`;
    const { rows: r1Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'kandra', 99.00, 'PROVIDER_ACCEPTED') RETURNING id`,
      [bRace1Key, cust.id, prov1.id]
    );
    const r1Id = r1Rows[0].id;

    const [race1CancelRes, race1DeclineRes] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/bookings/${r1Id}/cancel`, headers: cust.headers, payload: { reason: 'No longer needed' } }),
      app.inject({ method: 'POST', url: `/api/provider/jobs/${r1Id}/reject`, headers: prov1.headers }),
    ]);

    // Either Customer Cancel won (cancel 200, decline 409) OR Provider Decline won (decline 200, cancel 200 because customer can cancel SERVICE_REQUESTED)
    if (race1CancelRes.statusCode === 200 && race1DeclineRes.statusCode === 409) {
      assert(true, 'Race 1: Customer cancel won (200), provider decline conflict (409)');
    } else if (race1CancelRes.statusCode === 200 && race1DeclineRes.statusCode === 200) {
      assert(true, 'Race 1: Provider decline committed first (200), customer successfully cancelled recovered job (200)');
    } else {
      assert(false, `Race 1 unexpected status combination: cancel=${race1CancelRes.statusCode}, decline=${race1DeclineRes.statusCode}`);
    }

    const { rows: r1Final } = await pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [r1Id]);
    assert(r1Final[0].status === 'CANCELLED_BY_CUSTOMER', 'Race 1 final status is CANCELLED_BY_CUSTOMER');

    // Race 2: Concurrent double decline by same provider
    const bRace2Key = `p4-race2-${Date.now()}`;
    const { rows: r2Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'bhalukocha', 99.00, 'PROVIDER_ACCEPTED') RETURNING id`,
      [bRace2Key, cust.id, prov1.id]
    );
    const r2Id = r2Rows[0].id;

    const [r2A, r2B] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/provider/jobs/${r2Id}/reject`, headers: prov1.headers }),
      app.inject({ method: 'POST', url: `/api/provider/jobs/${r2Id}/reject`, headers: prov1.headers }),
    ]);

    const r2Statuses = [r2A.statusCode, r2B.statusCode].sort();
    assert(r2Statuses[0] === 200 && r2Statuses[1] === 409, 'Race 2: Exactly one 200 OK and one 409 Conflict in double-decline');

    const { rows: r2Logs } = await pool.query<{ to_status: string }>(
      `SELECT to_status FROM booking_status_logs WHERE booking_id = $1 AND to_status = 'REJECTED_BY_PROVIDER'`,
      [r2Id]
    );
    assert(r2Logs.length === 1, 'Race 2: Exactly one REJECTED_BY_PROVIDER audit log created');

    // Race 3: Provider 1 decline vs Provider 2 accept
    const bRace3Key = `p4-race3-${Date.now()}`;
    const { rows: r3Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'dam-road', 99.00, 'PROVIDER_ASSIGNED') RETURNING id`,
      [bRace3Key, cust.id, prov1.id]
    );
    const r3Id = r3Rows[0].id;

    const [r3Decline, r3Accept] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/provider/jobs/${r3Id}/reject`, headers: prov1.headers }),
      app.inject({ method: 'POST', url: `/api/provider/jobs/${r3Id}/accept`, headers: prov2.headers }),
    ]);

    // If decline was first, accept may succeed (200) or if accept was first, accept failed (409) because job was assigned to prov1
    assert(r3Decline.statusCode === 200, 'Race 3: Assigned provider successfully declined');
    assert([200, 409].includes(r3Accept.statusCode), 'Race 3: Peer accept handled deterministically (200 or 409)');

    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 8. Customer & Admin Truthfulness Verification ---');
    // ─────────────────────────────────────────────────────────────
    // For a booking in recovery (b2Id was declined and not re-claimed yet, let's create a fresh b5Id)
    const b5Key = `p4-customer-${Date.now()}`;
    const { rows: b5Rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
       VALUES ($1, $2, $3, 'electrician', 'asangi', 99.00, 'PROVIDER_ACCEPTED') RETURNING id`,
      [b5Key, cust.id, prov1.id]
    );
    const b5Id = b5Rows[0].id;
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ACCEPTED', $2, 'Technician accepted job')`,
      [b5Id, prov1.id]
    );

    // Prov1 declines b5
    await app.inject({ method: 'POST', url: `/api/provider/jobs/${b5Id}/reject`, headers: prov1.headers });

    // Customer checks booking detail
    const custDetailRes = await app.inject({ method: 'GET', url: `/api/bookings/${b5Id}`, headers: cust.headers });
    assert(custDetailRes.statusCode === 200, 'Customer fetches booking detail during recovery (200 OK)');
    const custDetail: ApiResponse<BookingDetail> = JSON.parse(custDetailRes.payload);
    assert(custDetail.data?.status === 'SERVICE_REQUESTED', 'Customer truthfully sees status SERVICE_REQUESTED');
    assert(custDetail.data?.provider === null, 'Customer truthfully sees provider is null (no fake provider or ETA)');
    assert((custDetail.data?.statusLogs || []).length === 3, 'Customer timeline reflects full progression');

    // Admin checks booking detail
    const adminDetailRes = await app.inject({ method: 'GET', url: `/api/admin/bookings/${b5Id}`, headers: admin.headers });
    assert(adminDetailRes.statusCode === 200, 'Admin fetches booking detail during recovery (200 OK)');
    const adminDetail: ApiResponse<AdminBookingDetail> = JSON.parse(adminDetailRes.payload);
    assert(adminDetail.data?.booking.status === 'SERVICE_REQUESTED', 'Admin sees recovered booking status');
    assert(adminDetail.data?.provider === null, 'Admin sees provider is null');
    assert((adminDetail.data?.timeline || []).length === 3, 'Admin timeline reflects full audit logs');

    await cleanup();
  } finally {
    await app.close();
  }

  console.log('\n============================================================');
  console.log(`PHASE 4 DECLINE & RECOVERY TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeclineRecoveryTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
