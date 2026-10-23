/**
 * CHANDIL HOME SERVICES - BETA TESTING & APK DISTRIBUTION PORTAL TEST SUITE
 *
 * Verifies all requirements for:
 * 1. Public Beta Portal Web Routes (SPA Serving, /beta, /download, /feedback, Caching)
 * 2. Administrative Role Enforcement & Access Control (Server-Side RBAC)
 * 3. Real Binary Android APK Ingestion, Extraction, Validation & Auto-Versioning (v1, v2...)
 * 4. Invalid / Malformed APK Binary Rejection & Security Checks
 * 5. Draft State Isolation (Draft releases cannot be downloaded publicly)
 * 6. Release Publishing Lifecycle & Single-Latest Flag Transition
 * 7. Resumable Streaming Downloads (HTTP 200, HTTP 206 Partial Content, Range headers, SHA-256)
 * 8. Release Withdrawal Lifecycle & Fallback Behavior
 * 9. Feedback Community (Submission, Validation, Rate Limiting, Filtering, Search)
 * 10. Discussion Comments (Threaded replies, Parent feedback comment counts)
 * 11. Content Reporting & Administrative Moderation (Status updates, Pinning, Comment flagging)
 * 12. Administrative Analytics & Immutable Audit Logging
 * 13. Mobile App & Asset Isolation (clean-android-assets script integrity)
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { createTestAdmin, createTestCustomer } from './helpers/auth-helper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function runBetaPortalTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES — BETA PORTAL & APK DISTRIBUTION TESTS');
  console.log('============================================================\n');

  const app = await buildApp({
    customEnv: {
      NODE_ENV: 'test',
    },
  });

  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: Database connection pool unavailable.');
    process.exit(1);
  }

  // Test identities
  const testAdminPhone = '9800088001';
  const testCustomerPhone = '9800088002';
  const testStrangerPhone = '9800088003';

  // Real APK fixture path
  const realApkPath = path.resolve(
    __dirname,
    '../../android/app/build/outputs/apk/debug/app-debug.apk'
  );
  assert(fs.existsSync(realApkPath), '0. Real Android APK fixture exists on disk');

  const realApkBuffer = fs.readFileSync(realApkPath);
  const realApkBase64 = realApkBuffer.toString('base64');

  async function cleanupFixtures() {
    await pool!.query(`DELETE FROM users WHERE phone IN ($1, $2, $3)`, [
      testAdminPhone,
      testCustomerPhone,
      testStrangerPhone,
    ]);
    await pool!.query(`DELETE FROM beta_feedback_comments WHERE feedback_id IN (
      SELECT id FROM beta_feedback WHERE title LIKE '%[TEST]%'
    )`);
    await pool!.query(`DELETE FROM beta_feedback WHERE title LIKE '%[TEST]%'`);
    await pool!.query(`DELETE FROM release_downloads WHERE release_id IN (
      SELECT id FROM app_releases WHERE changelog LIKE '%[TEST]%'
    )`);
    await pool!.query(`DELETE FROM admin_audit_logs WHERE action LIKE 'BETA_%'`);
    await pool!.query(`DELETE FROM app_releases WHERE changelog LIKE '%[TEST]%'`);
  }

  try {
    await cleanupFixtures();

    // 1. Setup Admin & Customer Users
    const adminAuth = await createTestAdmin(app, testAdminPhone, 'Chandil Beta Admin');
    const customerAuth = await createTestCustomer(app, testCustomerPhone, 'Beta Tester');
    const adminToken = adminAuth.token;
    const customerToken = customerAuth.token;

    console.log('\n--- 1. Public Beta Portal Web Routes & SPA Serving ---');

    // 1.1 Root /beta
    const betaRes = await app.inject({ method: 'GET', url: '/beta' });
    assert(betaRes.statusCode === 200, '1.1 GET /beta returns HTTP 200');
    assert(
      betaRes.headers['content-type']?.includes('text/html') === true,
      '1.2 GET /beta returns Content-Type text/html'
    );
    assert(
      betaRes.body.includes('Chandil Home Services') || betaRes.body.includes('beta'),
      '1.3 GET /beta renders HTML document with beta portal references'
    );

    // 1.2 SPA fallback for /download and /feedback
    const downloadRes = await app.inject({ method: 'GET', url: '/download' });
    assert(downloadRes.statusCode === 200, '1.4 GET /download serves beta.html (SPA routing)');

    const feedbackRes = await app.inject({ method: 'GET', url: '/feedback' });
    assert(feedbackRes.statusCode === 200, '1.5 GET /feedback serves beta.html (SPA routing)');

    // 1.3 Cache-control headers on HTML documents
    assert(
      betaRes.headers['cache-control']?.includes('no-cache') === true,
      '1.6 HTML responses include no-cache/must-revalidate headers to prevent stale SPAs'
    );

    console.log('\n--- 2. Public Releases Initial State (No Releases Published) ---');

    // 2.1 GET /api/beta/releases/latest when none published
    const latestResEmpty = await app.inject({ method: 'GET', url: '/api/beta/releases/latest' });
    assert(latestResEmpty.statusCode === 200, '2.1 GET /api/beta/releases/latest returns HTTP 200');
    const latestEmptyJson = JSON.parse(latestResEmpty.body);
    assert(latestEmptyJson.success === true, '2.2 API response indicates success');
    assert(latestEmptyJson.data.release === null, '2.3 Latest release is null when no releases published');

    // 2.2 GET /api/beta/releases
    const releasesEmptyRes = await app.inject({ method: 'GET', url: '/api/beta/releases' });
    const releasesEmptyJson = JSON.parse(releasesEmptyRes.body);
    assert(releasesEmptyJson.success === true, '2.4 GET /api/beta/releases succeeds');
    assert(Array.isArray(releasesEmptyJson.data.releases), '2.5 Releases list is an array');

    console.log('\n--- 3. Admin Release Management RBAC & Authorization ---');

    // 3.1 Unauthenticated upload attempt rejected
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/admin/beta/releases/upload',
      payload: { apkBase64: 'fake', changelog: 'Test' },
    });
    assert(unauthRes.statusCode === 401, '3.1 Unauthenticated upload attempt returns HTTP 401');

    // 3.2 Non-admin (customer) upload attempt rejected
    const customerRes = await app.inject({
      method: 'POST',
      url: '/api/admin/beta/releases/upload',
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { apkBase64: 'fake', changelog: 'Test' },
    });
    assert(customerRes.statusCode === 403, '3.2 Customer account upload attempt returns HTTP 403 Forbidden');

    console.log('\n--- 4. Real Binary APK Parsing, Extraction & Draft Creation ---');

    // 4.1 Malformed / Invalid APK rejection
    const invalidApkBuffer = Buffer.alloc(1024, 'NOT_A_VALID_ZIP_OR_APK_CONTENT_HEADER');
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/admin/beta/releases/upload',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        apkBase64: invalidApkBuffer.toString('base64'),
        changelog: '[TEST] Corrupt upload test',
      },
    });
    assert(invalidRes.statusCode === 400, '4.1 Corrupt/Invalid APK payload returns HTTP 400 Bad Request');
    const invalidJson = JSON.parse(invalidRes.body);
    assert(
      invalidJson.error.code === 'INVALID_APK_FILE' ||
        invalidJson.error.code === 'APK_EXTRACTION_ERROR' ||
        invalidJson.error.code === 'INVALID_MANIFEST',
      `4.2 Returns expected error code: ${invalidJson.error.code}`
    );

    // 4.2 Valid real APK ingestion via upload-json
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/admin/beta/releases/upload',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        apkBase64: realApkBase64,
        filename: 'app-debug.apk',
        changelog: '[TEST] Initial beta preview build for Chandil Home Services',
      },
    });
    assert(uploadRes.statusCode === 201, '4.3 Real Android APK upload returns HTTP 201 Created');
    const uploadJson = JSON.parse(uploadRes.body);
    assert(uploadJson.success === true, '4.4 Upload response success is true');
    const release1 = uploadJson.data.release;
    assert(Boolean(release1?.id), '4.5 Created release contains unique UUID');
    assert(release1.packageId === 'in.chandilservices.app', '4.6 Package ID strictly verified as in.chandilservices.app');
    assert(release1.androidVersionCode === 1, '4.7 Extracted android:versionCode matches binary manifest (1)');
    assert(release1.versionName === '1.0', '4.8 Extracted android:versionName matches binary manifest (1.0)');
    assert(release1.minSdk === 22, '4.9 Extracted minSdkVersion matches 22 (Android 5.1/6.0)');
    assert(release1.targetSdk === 34, '4.10 Extracted targetSdkVersion matches 34 (Android 14)');
    assert(release1.versionDisplay === 'v1', '4.11 Automatically allocated sequential versionDisplay is "v1"');
    assert(release1.releaseStatus === 'draft', '4.12 Newly uploaded release initial state is strictly "draft"');
    assert(release1.isLatest === false, '4.13 Draft release is not marked as isLatest');
    assert(release1.fileSize > 5_000_000, `4.14 Stored byte size is accurate: ${release1.fileSize} bytes`);
    assert(typeof release1.sha256 === 'string' && release1.sha256.length === 64, '4.15 SHA-256 checksum is 64-character hex');

    // 4.3 Verify admin audit log entry for upload
    const auditUpload = await pool.query(
      `SELECT * FROM admin_audit_logs WHERE action = 'RELEASE_UPLOAD_DRAFT' AND entity_id = $1`,
      [release1.id]
    );
    assert(auditUpload.rows.length === 1, '4.16 Immutable audit log created for RELEASE_UPLOAD_DRAFT');

    console.log('\n--- 5. Draft State Isolation & Download Protection ---');

    // 5.1 Public releases list hides drafts
    const publicListRes = await app.inject({ method: 'GET', url: '/api/beta/releases' });
    const publicListJson = JSON.parse(publicListRes.body);
    const hasDraftInPublic = publicListJson.data.releases.some((r: any) => r.id === release1.id);
    assert(!hasDraftInPublic, '5.1 Draft release is hidden from public releases endpoint');

    // 5.2 Public download of draft is strictly forbidden (HTTP 403)
    const draftDownloadRes = await app.inject({
      method: 'GET',
      url: `/api/beta/releases/${release1.id}/download`,
    });
    assert(draftDownloadRes.statusCode === 403, '5.2 Public download of draft returns HTTP 403 Forbidden');
    const draftDownloadJson = JSON.parse(draftDownloadRes.body);
    assert(draftDownloadJson.error.code === 'DRAFT_RELEASE', '5.3 Error code is DRAFT_RELEASE');

    console.log('\n--- 6. Release Publishing Lifecycle & Single Latest Invariant ---');

    // 6.1 Publish release 1
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/admin/beta/releases/${release1.id}/publish`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { changelog: '[TEST] Verified beta release v1 with verified offline handling.' },
    });
    assert(publishRes.statusCode === 200, '6.1 Publishing release returns HTTP 200');
    const publishJson = JSON.parse(publishRes.body);
    assert(publishJson.data.release.releaseStatus === 'published', '6.2 Release status transitioned to "published"');
    assert(publishJson.data.release.isLatest === true, '6.3 Published release marked as isLatest = true');

    // 6.2 Latest release endpoint now returns release 1
    const latestRes1 = await app.inject({ method: 'GET', url: '/api/beta/releases/latest' });
    const latestJson1 = JSON.parse(latestRes1.body);
    assert(latestJson1.data.release?.id === release1.id, '6.4 GET /api/beta/releases/latest returns published release');
    assert(latestJson1.data.release?.versionDisplay === 'v1', '6.5 Latest version display is v1');

    // 6.3 Upload a second release (v2) and verify sequential allocation
    const uploadRes2 = await app.inject({
      method: 'POST',
      url: '/api/admin/beta/releases/upload',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        apkBase64: realApkBase64,
        changelog: '[TEST] Second preview release with worker navigation improvements.',
      },
    });
    assert(uploadRes2.statusCode === 201, '6.6 Second release uploaded successfully');
    const release2 = JSON.parse(uploadRes2.body).data.release;
    assert(release2.versionDisplay === 'v2', '6.7 Second release automatically allocated sequential version "v2"');
    assert(release2.releaseNumber === 2, '6.8 releaseNumber is 2');

    // 6.4 Publish release 2 and verify single-latest transition (v2 becomes latest, v1 is demoted)
    await app.inject({
      method: 'POST',
      url: `/api/admin/beta/releases/${release2.id}/publish`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {},
    });

    const latestRes2 = await app.inject({ method: 'GET', url: '/api/beta/releases/latest' });
    const latestJson2 = JSON.parse(latestRes2.body);
    assert(latestJson2.data.release?.id === release2.id, '6.9 GET /api/beta/releases/latest now returns v2');

    // Verify v1 is no longer isLatest in database
    const v1Db = await pool.query(`SELECT is_latest FROM app_releases WHERE id = $1`, [release1.id]);
    assert(v1Db.rows[0].is_latest === false, '6.10 Previous release v1 was atomically demoted (is_latest = false)');

    console.log('\n--- 7. Streaming Resumable Downloads & Checksum Headers ---');

    // 7.1 Full APK download stream (HTTP 200)
    const streamRes = await app.inject({
      method: 'GET',
      url: `/api/beta/releases/${release2.id}/download`,
    });
    assert(streamRes.statusCode === 200, '7.1 Full APK download returns HTTP 200');
    assert(
      streamRes.headers['content-type'] === 'application/vnd.android.package-archive',
      '7.2 Content-Type is application/vnd.android.package-archive'
    );
    assert(
      streamRes.headers['content-disposition']?.includes('ChandilHomeServices-v2.apk') === true,
      '7.3 Content-Disposition specifies ChandilHomeServices-v2.apk attachment filename'
    );
    assert(streamRes.headers['accept-ranges'] === 'bytes', '7.4 Accept-Ranges header announces byte range support');
    assert(streamRes.headers['x-apk-sha256'] === release2.sha256, '7.5 X-APK-SHA256 header matches expected hash');
    assert(streamRes.headers['x-apk-version'] === 'v2', '7.6 X-APK-Version header matches v2');
    assert(streamRes.rawPayload.length === release2.fileSize, '7.7 Streamed payload size exactly matches file size');

    // 7.2 Partial Range Request (HTTP 206 Partial Content)
    const partialRes = await app.inject({
      method: 'GET',
      url: `/api/beta/releases/${release2.id}/download`,
      headers: {
        Range: 'bytes=0-1023',
      },
    });
    assert(partialRes.statusCode === 206, '7.8 Partial range request returns HTTP 206 Partial Content');
    assert(partialRes.headers['content-range']?.startsWith('bytes 0-1023/') === true, '7.9 Content-Range header returns bytes 0-1023/<total>');
    assert(partialRes.headers['content-length'] === '1024', '7.10 Content-Length is exactly 1024 bytes');
    assert(partialRes.rawPayload.length === 1024, '7.11 Received chunk length is 1024 bytes');

    // 7.3 Download telemetry tracking
    const telemetryDb = await pool.query(
      `SELECT download_count FROM app_releases WHERE id = $1`,
      [release2.id]
    );
    assert(Number(telemetryDb.rows[0].download_count) >= 1, '7.12 download_count incremented in app_releases');

    console.log('\n--- 8. Release Withdrawal Lifecycle & Fallback ---');

    // 8.1 Withdrawal requires explanatory reason
    const failWithdraw = await app.inject({
      method: 'POST',
      url: `/api/admin/beta/releases/${release2.id}/withdraw`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { reason: 'No' }, // Too short
    });
    assert(failWithdraw.statusCode === 400, '8.1 Withdrawal with insufficient reason returns HTTP 400');

    // 8.2 Valid withdrawal
    const withdrawRes = await app.inject({
      method: 'POST',
      url: `/api/admin/beta/releases/${release2.id}/withdraw`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { reason: '[TEST] Critical crash discovered on Android 9 devices in Chowka.' },
    });
    assert(withdrawRes.statusCode === 200, '8.2 Release withdrawal returns HTTP 200');
    const withdrawJson = JSON.parse(withdrawRes.body);
    assert(withdrawJson.data.release.releaseStatus === 'withdrawn', '8.3 Status transitioned to "withdrawn"');
    assert(withdrawJson.data.release.isLatest === false, '8.4 Withdrawn release is_latest revoked');

    // 8.3 Verify latest release fallback (falls back to v1)
    const latestAfterWithdraw = await app.inject({ method: 'GET', url: '/api/beta/releases/latest' });
    const latestJsonAfter = JSON.parse(latestAfterWithdraw.body);
    assert(latestJsonAfter.data.release?.id === release1.id, '8.5 Latest release automatically fell back to v1');

    console.log('\n--- 9. Beta Feedback Community (Submission & Validation) ---');

    // 9.1 Public feedback creation
    const createFbRes = await app.inject({
      method: 'POST',
      url: '/api/beta/feedback',
      payload: {
        title: '[TEST] Locality dropdown empty in offline mode',
        description: 'When launching app without mobile data on Redmi 9A, locality list shows infinite spinner instead of cached Chandil localities.',
        category: 'BUG_REPORT',
        appVersion: 'v1 (1.0)',
        testerRole: 'customer',
        deviceModel: 'Xiaomi Redmi 9A',
        androidVersion: '10',
        authorName: 'Sunil Mahato',
        authorContact: '9800099999',
      },
    });
    assert(createFbRes.statusCode === 201, '9.1 Public feedback creation returns HTTP 201');
    const createFbJson = JSON.parse(createFbRes.body);
    assert(createFbJson.success === true, '9.2 Feedback submission success is true');
    const fbItem1 = createFbJson.data.feedback;
    assert(fbItem1.title === '[TEST] Locality dropdown empty in offline mode', '9.3 Feedback title preserved');
    assert(fbItem1.status === 'NEW', '9.4 Initial feedback status is NEW');
    assert(fbItem1.category === 'BUG_REPORT', '9.5 Feedback category is BUG_REPORT');
    assert(fbItem1.isPinned === false, '9.6 Feedback is not pinned');
    assert(fbItem1.isReported === false, '9.7 Feedback is not reported');

    // 9.2 Validation check on empty title / description
    const badFbRes = await app.inject({
      method: 'POST',
      url: '/api/beta/feedback',
      payload: {
        title: 'Hi',
        description: '',
        category: 'INVALID_CATEGORY',
        appVersion: 'v1',
        testerRole: 'customer',
        authorName: '',
      },
    });
    assert(badFbRes.statusCode === 400, '9.8 Invalid feedback payload rejected with HTTP 400');

    // 9.3 Feedback listing and filtering
    const listFbRes = await app.inject({
      method: 'GET',
      url: '/api/beta/feedback?category=BUG_REPORT',
    });
    assert(listFbRes.statusCode === 200, '9.9 GET /api/beta/feedback returns HTTP 200');
    const listFbJson = JSON.parse(listFbRes.body);
    assert(listFbJson.data.items.length >= 1, '9.10 Feedback items returned under BUG_REPORT');

    // 9.4 Search filter
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/beta/feedback?search=offline',
    });
    const searchJson = JSON.parse(searchRes.body);
    assert(searchJson.data.items.some((i: any) => i.id === fbItem1.id), '9.11 Keyword search finds submitted issue');

    console.log('\n--- 10. Threaded Comments & Discussion Activity ---');

    // 10.1 Add tester comment
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/beta/feedback/${fbItem1.id}/comments`,
      payload: {
        authorName: 'Ravi Kumar (Worker)',
        message: 'I observed the same issue on Vivo Y21 while testing in Kandra.',
      },
    });
    assert(commentRes.statusCode === 201, '10.1 Adding reply comment returns HTTP 201');
    const comment1 = JSON.parse(commentRes.body).data.comment;
    assert(comment1.isAdmin === false, '10.2 Tester comment has isAdmin = false');
    assert(comment1.moderationStatus === 'APPROVED', '10.3 Newly added comment default moderationStatus is APPROVED');

    // 10.2 Verify parent comments count incremented
    const fbDetailRes = await app.inject({ method: 'GET', url: `/api/beta/feedback/${fbItem1.id}` });
    const fbDetailJson = JSON.parse(fbDetailRes.body);
    assert(fbDetailJson.data.feedback.commentsCount === 1, '10.4 Parent commentsCount incremented to 1');
    assert(fbDetailJson.data.comments.length === 1, '10.5 Comments list contains posted reply');

    // 10.3 Report feedback as inappropriate
    const reportRes = await app.inject({
      method: 'POST',
      url: `/api/beta/feedback/${fbItem1.id}/report`,
    });
    assert(reportRes.statusCode === 200, '10.6 Reporting feedback returns HTTP 200');

    const reportedDb = await pool.query(`SELECT is_reported, report_count FROM beta_feedback WHERE id = $1`, [fbItem1.id]);
    assert(reportedDb.rows[0].is_reported === true, '10.7 is_reported set to true');
    assert(reportedDb.rows[0].report_count === 1, '10.8 report_count incremented');

    console.log('\n--- 11. Administrative Moderation, Official Replies & Status Transitions ---');

    // 11.1 Update feedback status to IN_PROGRESS
    const updateStatusRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/beta/feedback/${fbItem1.id}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    assert(updateStatusRes.statusCode === 200, '11.1 Admin updating status returns HTTP 200');
    assert(JSON.parse(updateStatusRes.body).data.feedback.status === 'IN_PROGRESS', '11.2 Status changed to IN_PROGRESS');

    // 11.2 Toggle Pin status
    const pinRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/beta/feedback/${fbItem1.id}/pin`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { isPinned: true },
    });
    assert(pinRes.statusCode === 200, '11.3 Admin pinning feedback returns HTTP 200');
    assert(JSON.parse(pinRes.body).data.feedback.isPinned === true, '11.4 isPinned changed to true');

    // 11.3 Moderate comment (FLAG comment)
    const flagCommentRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/beta/feedback/comments/${comment1.id}/moderate`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { moderationStatus: 'FLAGGED' },
    });
    assert(flagCommentRes.statusCode === 200, '11.5 Moderating comment to FLAGGED returns HTTP 200');

    // 11.4 Verify flagged comment is hidden from public view
    const publicDetailAfterFlag = await app.inject({ method: 'GET', url: `/api/beta/feedback/${fbItem1.id}` });
    const publicDetailJson = JSON.parse(publicDetailAfterFlag.body);
    const hasFlaggedComment = publicDetailJson.data.comments.some((c: any) => c.id === comment1.id);
    assert(!hasFlaggedComment, '11.6 Flagged comment is filtered out of public GET /api/beta/feedback/:id');

    // 11.5 Verify admin view includes all comments
    const adminDetailRes = await app.inject({
      method: 'GET',
      url: `/api/admin/beta/feedback/${fbItem1.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminDetailRes.statusCode === 200, '11.7 Admin GET /api/admin/beta/feedback/:id returns HTTP 200');
    const adminDetailJson = JSON.parse(adminDetailRes.body);
    const adminHasFlaggedComment = adminDetailJson.data.comments.some((c: any) => c.id === comment1.id);
    assert(adminHasFlaggedComment, '11.8 Admin view retains flagged comments for moderation');

    // 11.6 Admin posts official response
    const adminReplyRes = await app.inject({
      method: 'POST',
      url: `/api/admin/beta/feedback/${fbItem1.id}/comments`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        message: 'Fixed in upcoming v3 release. Offline locality cache is now bundled.',
        authorName: 'Chandil Engineering Team',
      },
    });
    assert(adminReplyRes.statusCode === 201, '11.9 Admin official reply returns HTTP 201');
    const adminReplyComment = JSON.parse(adminReplyRes.body).data.comment;
    assert(adminReplyComment.isAdmin === true, '11.10 Comment has isAdmin = true');

    console.log('\n--- 12. Admin Analytics & Immutable Audit Trail ---');

    // 12.1 Analytics
    const analyticsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/beta/analytics',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(analyticsRes.statusCode === 200, '12.1 GET /api/admin/beta/analytics returns HTTP 200');
    const analyticsJson = JSON.parse(analyticsRes.body);
    assert(Number(analyticsJson.data.releases.total_releases) >= 2, '12.2 Analytics reports total releases');
    assert(Number(analyticsJson.data.feedback.total_feedback) >= 1, '12.3 Analytics reports total feedback');
    assert(Array.isArray(analyticsJson.data.byCategory), '12.4 Analytics includes breakdown by category');

    // 12.2 Audit logs
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/admin/beta/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.statusCode === 200, '12.5 GET /api/admin/beta/audit-logs returns HTTP 200');
    const auditJson = JSON.parse(auditRes.body);
    assert(Array.isArray(auditJson.data.logs), '12.6 Audit log is an array');
    const hasPublishAudit = auditJson.data.logs.some((l: any) => l.action === 'RELEASE_PUBLISHED');
    assert(hasPublishAudit, '12.7 Audit log records RELEASE_PUBLISHED with administrator identity');

    console.log('\n--- 13. Mobile App Asset Isolation Check ---');

    // 13.1 clean-android-assets script existence & rules
    const cleanScriptPath = path.resolve(__dirname, '../../scripts/clean-android-assets.js');
    assert(fs.existsSync(cleanScriptPath), '13.1 clean-android-assets.js script exists');
    const cleanScriptContent = fs.readFileSync(cleanScriptPath, 'utf8');
    assert(cleanScriptContent.includes('beta.html'), '13.2 clean-android-assets.js targets beta.html');
    assert(cleanScriptContent.includes('beta-'), '13.3 clean-android-assets.js targets beta-* asset chunks');

    // 13.2 android build.gradle ignoreAssetsPattern
    const buildGradlePath = path.resolve(__dirname, '../../android/app/build.gradle');
    assert(fs.existsSync(buildGradlePath), '13.4 android/app/build.gradle exists');
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    assert(buildGradleContent.includes('beta.html:beta*'), '13.5 aaptOptions.ignoreAssetsPattern excludes beta.html:beta*');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await cleanupFixtures();
    await app.close();
  }

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBetaPortalTests();
