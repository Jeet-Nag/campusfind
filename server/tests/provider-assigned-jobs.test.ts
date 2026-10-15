import assert from 'node:assert';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { en, hi, ApiResponse, ProviderJob, BookingStatus } from '@shared';

async function runProviderAssignedJobsTests() {
  console.log('\n============================================================');
  console.log('MODULE 12D STEP 2 — PROVIDER ASSIGNED-JOB FLOW VERIFICATION');
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
  const customerPhone = '9800066001';
  const provider1Phone = '9800066002';
  const provider2Phone = '9800066003';
  const adminPhone = '9800066004';

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
     VALUES ($1, 'customer', 'Rajesh Customer', 'hi', true, 1) RETURNING id`,
    [customerPhone]
  );
  const customerId = custRows[0].id;

  const { rows: prov1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Sunil Electrician', 'hi', true, 1) RETURNING id`,
    [provider1Phone]
  );
  const provider1Id = prov1Rows[0].id;

  const { rows: prov2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, 'provider', 'Pooja Plumber', 'en', true, 1) RETURNING id`,
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
     VALUES ($1, 'admin', 'Admin Coordinator', 'en', true, 1) RETURNING id`,
    [adminPhone]
  );
  const adminId = adminRows[0].id;

  // 3. Generate tokens
  const customerToken = app.jwt.sign({ id: customerId, role: 'customer', tokenVersion: 1 });
  const provider1Token = app.jwt.sign({ id: provider1Id, role: 'provider', tokenVersion: 1 });
  const provider2Token = app.jwt.sign({ id: provider2Id, role: 'provider', tokenVersion: 1 });
  const adminToken = app.jwt.sign({ id: adminId, role: 'admin', tokenVersion: 1 });

  console.log('--- 1. RBAC & Authorization Guards ---');

  // 1.1 Unauthenticated requests
  const unauthFeed = await app.inject({ method: 'GET', url: '/api/provider/jobs' });
  testAssert(unauthFeed.statusCode === 401, '1. Unauthenticated feed request returns 401');

  const unauthAccept = await app.inject({ method: 'POST', url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/accept' });
  testAssert(unauthAccept.statusCode === 401, '2. Unauthenticated accept request returns 401');

  const unauthReject = await app.inject({ method: 'POST', url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/reject' });
  testAssert(unauthReject.statusCode === 401, '3. Unauthenticated reject request returns 401');

  // 1.2 Customer role rejected from provider endpoints
  const custFeed = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: { authorization: `Bearer ${customerToken}` } });
  testAssert(custFeed.statusCode === 403, '4. Customer role rejected from provider feed (403)');

  const custAccept = await app.inject({ method: 'POST', url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/accept', headers: { authorization: `Bearer ${customerToken}` } });
  testAssert(custAccept.statusCode === 403, '5. Customer role rejected from provider accept (403)');

  const custReject = await app.inject({ method: 'POST', url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000/reject', headers: { authorization: `Bearer ${customerToken}` } });
  testAssert(custReject.statusCode === 403, '6. Customer role rejected from provider reject (403)');

  // 1.3 Admin role rejected from provider endpoints
  const adminFeed = await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: { authorization: `Bearer ${adminToken}` } });
  testAssert(adminFeed.statusCode === 403, '7. Admin role rejected from provider feed (403)');

  console.log('\n--- 2. Job Feed Isolation & Filtering ---');

  // Seed 5 bookings with diverse assignment statuses
  const b1Key = `asgn-test-b1-${Date.now()}`;
  const { rows: b1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, 'electrician', 'chandil-bazar', 'Near Durga Mandir', 'Open broadcast ceiling fan repair', 99.00, 'SERVICE_REQUESTED', NOW() - INTERVAL '15 minutes')
     RETURNING id`,
    [b1Key, customerId]
  );
  const b1Id = b1Rows[0].id;

  const b2Key = `asgn-test-b2-${Date.now()}`;
  const { rows: b2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, $3, 'electrician', 'chowka', 'Near Bus Stand', 'Assigned directly to Sunil (Provider 1)', 99.00, 'PROVIDER_ASSIGNED', NOW() - INTERVAL '10 minutes')
     RETURNING id`,
    [b2Key, customerId, provider1Id]
  );
  const b2Id = b2Rows[0].id;

  const b3Key = `asgn-test-b3-${Date.now()}`;
  const { rows: b3Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, $3, 'plumber', 'station-colony', 'Platform Road', 'Assigned directly to Pooja (Provider 2)', 149.00, 'PROVIDER_ASSIGNED', NOW() - INTERVAL '5 minutes')
     RETURNING id`,
    [b3Key, customerId, provider2Id]
  );
  const b3Id = b3Rows[0].id;

  const b4Key = `asgn-test-b4-${Date.now()}`;
  const { rows: b4Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status, accepted_at, created_at)
     VALUES ($1, $2, $3, 'electrician', 'dam-road', 99.00, 'PROVIDER_ACCEPTED', NOW(), NOW() - INTERVAL '20 minutes')
     RETURNING id`,
    [b4Key, customerId, provider1Id]
  );
  const b4Id = b4Rows[0].id;

  const b5Key = `asgn-test-b5-${Date.now()}`;
  const { rows: b5Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status, accepted_at, created_at)
     VALUES ($1, $2, $3, 'plumber', 'chilgu', 149.00, 'PROVIDER_ACCEPTED', NOW(), NOW() - INTERVAL '25 minutes')
     RETURNING id`,
    [b5Key, customerId, provider2Id]
  );
  const b5Id = b5Rows[0].id;

  // 2.1 Provider 1 fetches feed
  const p1FeedRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(p1FeedRes.statusCode === 200, '8. Provider 1 fetches job feed with 200 OK');
  const p1Feed: ApiResponse<ProviderJob[]> = JSON.parse(p1FeedRes.payload);
  const p1Jobs = p1Feed.data || [];
  const p1JobIds = p1Jobs.map((j) => j.id);

  testAssert(p1JobIds.includes(b1Id), '9. Provider 1 sees open broadcast job b1 (SERVICE_REQUESTED)');
  testAssert(p1JobIds.includes(b2Id), '10. Provider 1 sees job b2 assigned to Provider 1 (PROVIDER_ASSIGNED)');
  testAssert(!p1JobIds.includes(b3Id), '11. Provider 1 NEVER sees job b3 assigned to Provider 2 (Isolation Guarantee)');
  testAssert(!p1JobIds.includes(b4Id), '12. Provider 1 does not see already accepted job b4');
  testAssert(!p1JobIds.includes(b5Id), '13. Provider 1 does not see job b5 accepted by Provider 2');

  const p1B2 = p1Jobs.find((j) => j.id === b2Id);
  testAssert(p1B2?.status === 'PROVIDER_ASSIGNED', '14. Assigned job b2 has status PROVIDER_ASSIGNED in response');
  testAssert(p1Jobs[0].id === b2Id, '15. Assigned job is prioritized at top of feed');

  // 2.2 Provider 2 fetches feed
  const p2FeedRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(p2FeedRes.statusCode === 200, '16. Provider 2 fetches job feed with 200 OK');
  const p2Feed: ApiResponse<ProviderJob[]> = JSON.parse(p2FeedRes.payload);
  const p2Jobs = p2Feed.data || [];
  const p2JobIds = p2Jobs.map((j) => j.id);

  testAssert(p2JobIds.includes(b1Id), '17. Provider 2 sees open broadcast job b1');
  testAssert(p2JobIds.includes(b3Id), '18. Provider 2 sees job b3 assigned to Provider 2');
  testAssert(!p2JobIds.includes(b2Id), '19. Provider 2 NEVER sees job b2 assigned to Provider 1 (Isolation Guarantee)');

  console.log('\n--- 3. Job Detail Visibility & Cross-Provider Privacy ---');

  // 3.1 Invalid UUIDs
  const malformedDetail = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs/invalid-uuid-123',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(malformedDetail.statusCode === 404, '20. Malformed job UUID returns 404');

  const nonExistentDetail = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(nonExistentDetail.statusCode === 404, '21. Non-existent job UUID returns 404');

  // 3.2 Open broadcast job b1
  const p1B1Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b1Id}`, headers: { authorization: `Bearer ${provider1Token}` } });
  testAssert(p1B1Detail.statusCode === 200, '22. Provider 1 can view open job b1 details');

  const p2B1Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b1Id}`, headers: { authorization: `Bearer ${provider2Token}` } });
  testAssert(p2B1Detail.statusCode === 200, '23. Provider 2 can view open job b1 details');

  // 3.3 Provider 1 assigned job b2
  const p1B2Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b2Id}`, headers: { authorization: `Bearer ${provider1Token}` } });
  testAssert(p1B2Detail.statusCode === 200, '24. Provider 1 can view details of assigned job b2');
  const p1B2Data = JSON.parse(p1B2Detail.payload).data;
  testAssert(p1B2Data.status === 'PROVIDER_ASSIGNED', '25. Status in detail view is PROVIDER_ASSIGNED');

  // 3.4 Cross-provider access to b2
  const p2B2Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b2Id}`, headers: { authorization: `Bearer ${provider2Token}` } });
  testAssert(p2B2Detail.statusCode === 404, '26. Provider 2 receives 404 when trying to inspect Provider 1 assigned job b2 (Privacy Isolation)');

  // 3.5 Provider 2 assigned job b3
  const p2B3Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b3Id}`, headers: { authorization: `Bearer ${provider2Token}` } });
  testAssert(p2B3Detail.statusCode === 200, '27. Provider 2 can view details of assigned job b3');

  const p1B3Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b3Id}`, headers: { authorization: `Bearer ${provider1Token}` } });
  testAssert(p1B3Detail.statusCode === 404, '28. Provider 1 receives 404 when trying to inspect Provider 2 assigned job b3');

  // 3.6 Accepted job b4
  const p1B4Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b4Id}`, headers: { authorization: `Bearer ${provider1Token}` } });
  testAssert(p1B4Detail.statusCode === 200, '29. Owner provider can view details of accepted job b4');

  const p2B4Detail = await app.inject({ method: 'GET', url: `/api/provider/jobs/${b4Id}`, headers: { authorization: `Bearer ${provider2Token}` } });
  testAssert(p2B4Detail.statusCode === 404, '30. Non-owner provider receives 404 inspecting accepted job b4');

  console.log('\n--- 4. Accepting Assigned Jobs (POST /api/provider/jobs/:id/accept) ---');

  // Complete earlier test bookings b3, b4 and b5 so providers have no active jobs in progress
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id IN ($1, $2, $3)", [b3Id, b4Id, b5Id]);

  // 4.1 Unauthorized provider (Provider 2) trying to accept Provider 1's assigned job b2
  const unauthorizedAccept = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b2Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(unauthorizedAccept.statusCode === 409, '31. Non-assigned provider receives 409 Conflict attempting to accept job (JOB_ALREADY_CLAIMED)');
  const unauthAcceptBody: ApiResponse = JSON.parse(unauthorizedAccept.payload);
  testAssert(unauthAcceptBody.error?.code === 'JOB_ALREADY_CLAIMED', '32. Error code is strictly JOB_ALREADY_CLAIMED');

  // Verify database was NOT modified
  const { rows: b2PreRows } = await pool.query<{ status: string; provider_id: string; accepted_at: Date | null }>(
    'SELECT status, provider_id, accepted_at FROM bookings WHERE id = $1',
    [b2Id]
  );
  testAssert(b2PreRows[0].status === 'PROVIDER_ASSIGNED', '33. Booking status remained PROVIDER_ASSIGNED after unauthorized accept attempt');
  testAssert(b2PreRows[0].provider_id === provider1Id, '34. Booking provider_id remained Provider 1');
  testAssert(b2PreRows[0].accepted_at === null, '35. accepted_at remained NULL');

  // 4.2 Legitimate assigned provider (Provider 1) accepts job b2
  const beforeAccept = Date.now();
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b2Id}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(acceptRes.statusCode === 200, '36. Assigned provider accepts job successfully (200 OK)');
  const acceptBody: ApiResponse<ProviderJob> = JSON.parse(acceptRes.payload);
  testAssert(acceptBody.success === true, '37. Success envelope is true');
  testAssert(acceptBody.data?.status === 'PROVIDER_ACCEPTED', '38. Returned job status is PROVIDER_ACCEPTED');

  // 4.3 Database state verification
  const { rows: b2PostRows } = await pool.query<{
    status: string;
    provider_id: string;
    accepted_at: Date | null;
    updated_at: Date;
  }>('SELECT status, provider_id, accepted_at, updated_at FROM bookings WHERE id = $1', [b2Id]);

  const b2Post = b2PostRows[0];
  testAssert(b2Post.status === 'PROVIDER_ACCEPTED', '39. Database status transitioned to PROVIDER_ACCEPTED');
  testAssert(b2Post.provider_id === provider1Id, '40. Database provider_id strictly preserved');
  testAssert(b2Post.accepted_at !== null, '41. Database accepted_at is set to current timestamp');
  testAssert(new Date(b2Post.accepted_at!).getTime() >= beforeAccept - 2000, '42. accepted_at timestamp is fresh');
  testAssert(new Date(b2Post.updated_at).getTime() >= beforeAccept - 2000, '43. updated_at timestamp refreshed');

  // 4.4 Audit log verification
  const { rows: b2LogRows } = await pool.query<{
    from_status: string;
    to_status: string;
    changed_by: string;
    notes: string;
  }>('SELECT from_status, to_status, changed_by, notes FROM booking_status_logs WHERE booking_id = $1 ORDER BY id DESC LIMIT 1', [b2Id]);

  testAssert(b2LogRows.length === 1, '44. Audit log entry recorded for acceptance');
  testAssert(b2LogRows[0].from_status === 'PROVIDER_ASSIGNED', '45. Audit from_status is strictly PROVIDER_ASSIGNED');
  testAssert(b2LogRows[0].to_status === 'PROVIDER_ACCEPTED', '46. Audit to_status is strictly PROVIDER_ACCEPTED');
  testAssert(b2LogRows[0].changed_by === provider1Id, '47. Audit changed_by is strictly the accepting provider ID');
  testAssert(b2LogRows[0].notes === 'Technician accepted assigned job', '48. Audit notes document assigned acceptance');

  // 4.5 Idempotency: repeated acceptance by same provider
  const repeatAcceptRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b2Id}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(repeatAcceptRes.statusCode === 200, '49. Repeated acceptance by same provider returns 200 (Idempotency)');

  const { rows: b2LogCountRows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM booking_status_logs WHERE booking_id = $1 AND to_status = $2',
    [b2Id, 'PROVIDER_ACCEPTED']
  );
  testAssert(b2LogCountRows[0].count === '1', '50. Zero duplicate audit logs created on repeated acceptance');

  // Complete b2Id so Provider 1 has no active job before claiming b1Id
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [b2Id]);

  // 4.6 Open broadcast claim verification
  const openClaimRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b1Id}/accept`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(openClaimRes.statusCode === 200, '51. Open broadcast job b1 accepted with 200 OK');
  const { rows: b1LogRows } = await pool.query<{ from_status: string; to_status: string }>(
    'SELECT from_status, to_status FROM booking_status_logs WHERE booking_id = $1 ORDER BY id DESC LIMIT 1',
    [b1Id]
  );
  testAssert(b1LogRows[0].from_status === 'SERVICE_REQUESTED', '52. Open claim audit log has from_status SERVICE_REQUESTED');
  testAssert(b1LogRows[0].to_status === 'PROVIDER_ACCEPTED', '53. Open claim audit log has to_status PROVIDER_ACCEPTED');

  // Complete b1Id so Provider 1 has no lingering active job
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [b1Id]);

  console.log('\n--- 5. Declining / Relinquishing Assigned Jobs (POST /api/provider/jobs/:id/reject) ---');

  // Seed new assigned job b6
  const b6Key = `asgn-test-b6-${Date.now()}`;
  const { rows: b6Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status)
     VALUES ($1, $2, $3, 'electrician', 'kandra-road', 'Near Railway Bridge', 'Assigned job to decline', 99.00, 'PROVIDER_ASSIGNED')
     RETURNING id`,
    [b6Key, customerId, provider1Id]
  );
  const b6Id = b6Rows[0].id;

  // 5.1 Provider 2 cannot decline Provider 1's assigned job
  const unauthRejectRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b6Id}/reject`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(unauthRejectRes.statusCode === 409, '54. Other provider cannot decline assigned job (409 Conflict)');
  const unauthRejBody: ApiResponse = JSON.parse(unauthRejectRes.payload);
  testAssert(unauthRejBody.error?.code === 'JOB_NO_LONGER_ASSIGNED', '55. Error code is JOB_NO_LONGER_ASSIGNED');

  // 5.2 Open job b7 cannot be rejected
  const b7Key = `asgn-test-b7-${Date.now()}`;
  const { rows: b7Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, visiting_fee, status)
     VALUES ($1, $2, 'plumber', 'manikpur', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [b7Key, customerId]
  );
  const b7Id = b7Rows[0].id;

  const rejectOpenRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b7Id}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(rejectOpenRes.statusCode === 409, '56. Open broadcast job cannot be rejected (409 Conflict)');

  // 5.3 Provider 1 legitimately declines assigned job b6
  const beforeDecline = Date.now();
  const declineRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b6Id}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(declineRes.statusCode === 200, '57. Assigned provider successfully declines job (200 OK)');
  const declineBody: ApiResponse<ProviderJob> = JSON.parse(declineRes.payload);
  testAssert(declineBody.success === true, '58. Success envelope is true');
  testAssert(declineBody.data?.status === 'SERVICE_REQUESTED', '59. Returned job status is reverted to SERVICE_REQUESTED');

  // 5.4 Database state verification
  const { rows: b6PostRows } = await pool.query<{
    status: string;
    provider_id: string | null;
    accepted_at: Date | null;
    updated_at: Date;
  }>('SELECT status, provider_id, accepted_at, updated_at FROM bookings WHERE id = $1', [b6Id]);

  const b6Post = b6PostRows[0];
  testAssert(b6Post.status === 'SERVICE_REQUESTED', '60. Database status reverted strictly to SERVICE_REQUESTED');
  testAssert(b6Post.provider_id === null, '61. Database provider_id cleared strictly to NULL');
  testAssert(b6Post.accepted_at === null, '62. Database accepted_at is NULL');
  testAssert(new Date(b6Post.updated_at).getTime() >= beforeDecline - 2000, '63. updated_at timestamp refreshed');

  // 5.5 Audit log verification
  const { rows: b6LogRows } = await pool.query<{
    from_status: string;
    to_status: string;
    changed_by: string;
    notes: string;
  }>('SELECT from_status, to_status, changed_by, notes FROM booking_status_logs WHERE booking_id = $1 ORDER BY id ASC', [b6Id]);

  testAssert(b6LogRows.length === 2, '64. Audit log entries recorded for decline and recovery');
  testAssert(b6LogRows[0].from_status === 'PROVIDER_ASSIGNED', '65. Audit log 1 from_status is strictly PROVIDER_ASSIGNED');
  testAssert(b6LogRows[0].to_status === 'REJECTED_BY_PROVIDER', '66. Audit log 1 to_status is strictly REJECTED_BY_PROVIDER');
  testAssert(b6LogRows[0].changed_by === provider1Id, '67. Audit log 1 changed_by is Provider 1');
  testAssert(b6LogRows[0].notes === 'Technician declined assigned job', '68. Audit notes document declined assigned job');
  testAssert(b6LogRows[1].from_status === 'REJECTED_BY_PROVIDER', '68a. Audit log 2 from_status is strictly REJECTED_BY_PROVIDER');
  testAssert(b6LogRows[1].to_status === 'SERVICE_REQUESTED', '68b. Audit log 2 to_status is strictly SERVICE_REQUESTED');
  testAssert(b6LogRows[1].notes === 'Recovered to open broadcast pool', '68c. Audit notes document recovered booking');

  // 5.6 Feed re-availability for other providers
  const feedAfterDeclineRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  const feedAfterDecline: ApiResponse<ProviderJob[]> = JSON.parse(feedAfterDeclineRes.payload);
  const releasedJobFound = (feedAfterDecline.data || []).some((j) => j.id === b6Id);
  testAssert(releasedJobFound, '69. Declined job b6 immediately reappears in broadcast feed for Provider 2');

  // Provider 2 can now claim the released job
  const claimReleasedRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b6Id}/accept`,
    headers: { authorization: `Bearer ${provider2Token}` },
  });
  testAssert(claimReleasedRes.statusCode === 200, '70. Provider 2 can claim the released job (200 OK)');

  // 5.7 Repeated decline by Provider 1 returns 409
  const repeatDeclineRes = await app.inject({
    method: 'POST',
    url: `/api/provider/jobs/${b6Id}/reject`,
    headers: { authorization: `Bearer ${provider1Token}` },
  });
  testAssert(repeatDeclineRes.statusCode === 409, '71. Repeated decline on already released job returns 409 Conflict');

  console.log('\n--- 6. Concurrency & Race Conditions ---');

  // Complete b6Id so Provider 2 has no active job
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [b6Id]);

  // 6.1 Concurrent accept on open job by two providers
  const raceKey1 = `race-open-${Date.now()}`;
  const { rows: race1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, visiting_fee, status)
     VALUES ($1, $2, 'electrician', 'gangdih', 99.00, 'SERVICE_REQUESTED')
     RETURNING id`,
    [raceKey1, customerId]
  );
  const raceJob1Id = race1Rows[0].id;

  const [race1ResA, race1ResB] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJob1Id}/accept`, headers: { authorization: `Bearer ${provider1Token}` } }),
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJob1Id}/accept`, headers: { authorization: `Bearer ${provider2Token}` } }),
  ]);

  const race1Codes = [race1ResA.statusCode, race1ResB.statusCode].sort();
  testAssert(race1Codes[0] === 200 && race1Codes[1] === 409, '72. Concurrent accept race: exactly one 200 OK, one 409 Conflict');

  // Verify single claim in database
  const { rows: race1DbRows } = await pool.query<{ status: string; provider_id: string }>(
    'SELECT status, provider_id FROM bookings WHERE id = $1',
    [raceJob1Id]
  );
  testAssert(race1DbRows[0].status === 'PROVIDER_ACCEPTED', '73. Race job status is strictly PROVIDER_ACCEPTED');
  testAssert(race1DbRows[0].provider_id === provider1Id || race1DbRows[0].provider_id === provider2Id, '74. Exactly one provider claimed race job');

  // Complete raceJob1Id so winning provider has no lingering active job
  await pool.query("UPDATE bookings SET status = 'BOOKING_COMPLETED' WHERE id = $1", [raceJob1Id]);

  // 6.2 Concurrent accept by assigned provider (Provider 1) and unassigned provider (Provider 2)
  const raceKey2 = `race-asgn-${Date.now()}`;
  const { rows: race2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, visiting_fee, status)
     VALUES ($1, $2, $3, 'electrician', 'bhalukocha', 99.00, 'PROVIDER_ASSIGNED')
     RETURNING id`,
    [raceKey2, customerId, provider1Id]
  );
  const raceJob2Id = race2Rows[0].id;

  const [race2ResP1, race2ResP2] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJob2Id}/accept`, headers: { authorization: `Bearer ${provider1Token}` } }),
    app.inject({ method: 'POST', url: `/api/provider/jobs/${raceJob2Id}/accept`, headers: { authorization: `Bearer ${provider2Token}` } }),
  ]);

  testAssert(race2ResP1.statusCode === 200, '75a. Assigned provider accepts assigned job (200)');
  testAssert(race2ResP2.statusCode === 409, '75b. Unassigned provider receives 409 in concurrent accept');

  console.log('\n--- 7. i18n Dictionary Parity & Natural Hindi ---');

  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  testAssert(enKeys.length === hiKeys.length, `76. EN and HI have matching key counts (${enKeys.length} keys each)`);

  const step2Keys = [
    'provider.assigned_to_you',
    'provider.open_jobs',
    'provider.assigned_jobs',
    'provider.all_jobs',
    'provider.assigned_job_banner',
    'provider.accept_assigned_job',
    'provider.decline_assigned_job',
    'provider.assigned_notice',
  ];

  for (const k of step2Keys) {
    testAssert(k in en, `77. Key "${k}" exists in English dictionary`);
    testAssert(k in hi, `78. Key "${k}" exists in Hindi dictionary`);
    const hiVal = (hi as any)[k];
    testAssert(Boolean(hiVal) && hiVal.trim().length > 0, `79. Hindi value for "${k}" is non-empty`);
    testAssert(!/[()]/.test(hiVal), `80. Hindi value for "${k}" contains zero parenthetical English`);
  }

  // 8. Final Cleanup
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
  console.log(`PROVIDER ASSIGNED-JOB TESTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProviderAssignedJobsTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
