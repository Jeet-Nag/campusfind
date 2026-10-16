import fs from 'fs';
import path from 'path';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { audioService } from '../src/services/audio.service';
import { ApiResponse, Booking, en, hi, CHANDIL_LOCALITIES } from '@shared';
import { createTestCustomer, createTestProvider } from './helpers/auth-helper';

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

/**
 * Synthesizes a valid audio buffer simulating Opus/WebM audio at ~16 kbps.
 */
function createSimulatedAudioBuffer(seconds: number): Buffer {
  // 16 kbps = 2,000 bytes per second
  const byteLength = Math.round(seconds * 2000);
  const buffer = Buffer.alloc(byteLength);
  // Fill with dummy audio pattern
  for (let i = 0; i < byteLength; i++) {
    buffer[i] = (i * 37) % 256;
  }
  return buffer;
}

async function runBookingTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 5 BOOKING CREATION VERIFICATION');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  const customerAPhone = '9876543501';
  const customerBPhone = '9876543502';
  const providerPhone = '9876543503';

  // Clean up fixtures from previous runs
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3)', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);

  // Obtain tokens via central auth helper
  const authA = await createTestCustomer(app, customerAPhone, 'Customer One');
  const tokenA = authA.token;
  const userAId = authA.id;

  const authB = await createTestCustomer(app, customerBPhone, 'Customer Two');
  const tokenB = authB.token;

  const authP = await createTestProvider(app, providerPhone, 'Provider Mistri');
  const tokenP = authP.token;

  console.log('--- 1. Audio Storage & Physical Size Measurements ---');

  // Measure audio sizes for 5s, 15s, 30s at 16 kbps Opus profile (2000 bytes/sec)
  const audio5s = createSimulatedAudioBuffer(5);
  const audio15s = createSimulatedAudioBuffer(15);
  const audio30s = createSimulatedAudioBuffer(30);

  const base64Audio5s = audio5s.toString('base64');
  const base64Audio15s = audio15s.toString('base64');
  const base64Audio30s = audio30s.toString('base64');

  const makeSamplePayload = (b64: string, dur: number) => ({
    idempotencyKey: 'idemp-measurement-key-12345678',
    categoryId: 'electrician',
    areaLocality: 'chandil-bazar',
    landmark: 'Near Shiv Mandir',
    textDescription: 'Ceiling fan is making buzzing noise and spinning slowly',
    audioBase64: b64,
    audioDurationSeconds: dur,
  });

  const payload5sStr = JSON.stringify(makeSamplePayload(base64Audio5s, 5));
  const payload15sStr = JSON.stringify(makeSamplePayload(base64Audio15s, 15));
  const payload30sStr = JSON.stringify(makeSamplePayload(base64Audio30s, 30));

  const httpPayload5sBytes = Buffer.byteLength(payload5sStr, 'utf8');
  const httpPayload15sBytes = Buffer.byteLength(payload15sStr, 'utf8');
  const httpPayload30sBytes = Buffer.byteLength(payload30sStr, 'utf8');

  console.log(`  [MEASURE 5s]  Binary: ${audio5s.length} B (${(audio5s.length / 1024).toFixed(2)} KB) | Base64: ${Buffer.byteLength(base64Audio5s)} B (${(Buffer.byteLength(base64Audio5s) / 1024).toFixed(2)} KB) | Complete HTTP Request: ${httpPayload5sBytes} B (${(httpPayload5sBytes / 1024).toFixed(2)} KB)`);
  console.log(`  [MEASURE 15s] Binary: ${audio15s.length} B (${(audio15s.length / 1024).toFixed(2)} KB) | Base64: ${Buffer.byteLength(base64Audio15s)} B (${(Buffer.byteLength(base64Audio15s) / 1024).toFixed(2)} KB) | Complete HTTP Request: ${httpPayload15sBytes} B (${(httpPayload15sBytes / 1024).toFixed(2)} KB)`);
  console.log(`  [MEASURE 30s] Binary: ${audio30s.length} B (${(audio30s.length / 1024).toFixed(2)} KB) | Base64: ${Buffer.byteLength(base64Audio30s)} B (${(Buffer.byteLength(base64Audio30s) / 1024).toFixed(2)} KB) | Complete HTTP Request: ${httpPayload30sBytes} B (${(httpPayload30sBytes / 1024).toFixed(2)} KB)`);

  assert(audio5s.length === 10000, '5s audio binary matches target 16kbps profile (10,000 bytes)');
  assert(Buffer.byteLength(base64Audio5s) === 13336, '5s base64 payload size matches 4/3 overhead (13,336 bytes)');
  assert(audio15s.length === 30000, '15s audio binary matches target 16kbps profile (30,000 bytes)');
  assert(Buffer.byteLength(base64Audio15s) === 40000, '15s base64 payload size matches 4/3 overhead (40,000 bytes)');
  assert(audio30s.length === 60000, '30s audio binary matches target 16kbps profile (60,000 bytes)');
  assert(Buffer.byteLength(base64Audio30s) === 80000, '30s base64 payload size matches 4/3 overhead (80,000 bytes)');
  assert(httpPayload30sBytes < 1024 * 1024, '30s complete HTTP request payload (~80 KB) fits comfortably within Fastify 1 MB default limit');

  // Save audio via service
  const savedAudio = await audioService.saveAudioBase64(base64Audio15s, 'audio/webm');
  assert(typeof savedAudio.audioUrl === 'string' && savedAudio.audioUrl.startsWith('/api/audio/'), 'Audio saved with valid URL route');
  assert(savedAudio.byteSize === 30000, 'Saved audio file on disk matches byte size');

  // Insert temporary booking to satisfy audio authorization
  const tempKey = `temp-audio-test-${Date.now()}`;
  await pool.query(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, text_description, audio_url, visiting_fee)
     VALUES ($1, $2, 'electrician', 'chandil-bazar', 'Audio streaming test', $3, 99.00)`,
    [tempKey, userAId, savedAudio.audioUrl]
  );

  // Test audio retrieval route with authorized token
  const audioStreamRes = await app.inject({
    method: 'GET',
    url: savedAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(audioStreamRes.statusCode === 200, 'GET /api/audio/:filename streams audio with HTTP 200');
  assert(audioStreamRes.headers['content-type'] === 'audio/webm', 'Content-Type header is audio/webm');
  assert(audioStreamRes.rawPayload.length === 30000, 'Streamed audio bytes match original size');

  // Clean up test booking and file
  await pool.query('DELETE FROM bookings WHERE idempotency_key = $1', [tempKey]);
  await audioService.deleteAudioFile(savedAudio.filename);

  console.log('\n--- 2. Authorization & RBAC Boundaries ---');

  // 2.1 Unauthenticated request returns 401
  const unauthRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    payload: {
      idempotencyKey: 'test-unauth-key-01',
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      textDescription: 'Fan not working',
    },
  });
  assert(unauthRes.statusCode === 401, 'Unauthenticated POST /api/bookings returns 401');

  // 2.2 Provider role returns 403 Forbidden
  const provRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenP}` },
    payload: {
      idempotencyKey: 'test-prov-key-01',
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      textDescription: 'Provider attempting to create booking',
    },
  });
  assert(provRes.statusCode === 403, 'Provider role is rejected with 403 Forbidden');

  console.log('\n--- 3. Validation Guards ---');

  // 3.1 Missing idempotency key
  const noKeyRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      textDescription: 'Fan not working',
    },
  });
  assert(noKeyRes.statusCode === 400, 'Missing idempotencyKey rejected with 400');

  // 3.2 Nonexistent category ID
  const badCatRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: 'test-badcat-key-01',
      categoryId: 'nonexistent-service',
      areaLocality: 'chandil-bazar',
      textDescription: 'Some problem',
    },
  });
  assert(badCatRes.statusCode === 400, 'Nonexistent category rejected with 400');
  assert(JSON.parse(badCatRes.payload).error.code === 'CATEGORY_NOT_FOUND', 'Error code is CATEGORY_NOT_FOUND');

  // 3.3 Inactive category rejection
  await pool.query("UPDATE service_categories SET is_active = false WHERE id = 'bike-mechanic'");
  const inactiveCatRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: 'test-inactive-key-01',
      categoryId: 'bike-mechanic',
      areaLocality: 'chandil-bazar',
      textDescription: 'Bike puncture',
    },
  });
  assert(inactiveCatRes.statusCode === 400, 'Inactive category booking rejected with 400');
  assert(JSON.parse(inactiveCatRes.payload).error.code === 'CATEGORY_INACTIVE', 'Error code is CATEGORY_INACTIVE');
  await pool.query("UPDATE service_categories SET is_active = true WHERE id = 'bike-mechanic'");

  // 3.4 Missing problem description and audio
  const noDescRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: 'test-nodesc-key-01',
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
    },
  });
  assert(noDescRes.statusCode === 400, 'Missing both text and audio rejected with 400');
  assert(JSON.parse(noDescRes.payload).error.code === 'DESCRIPTION_REQUIRED', 'Error code is DESCRIPTION_REQUIRED');

  // 3.5 Invalid locality
  const badLocRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: 'test-badloc-key-01',
      categoryId: 'electrician',
      areaLocality: 'new-york-city',
      textDescription: 'Fix light',
    },
  });
  assert(badLocRes.statusCode === 400, 'Invalid non-Chandil locality rejected with 400');
  assert(JSON.parse(badLocRes.payload).error.code === 'INVALID_LOCALITY', 'Error code is INVALID_LOCALITY');

  // 3.6 Other locality requires landmark
  const otherNoLandmarkRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: 'test-other-nolandmark',
      categoryId: 'electrician',
      areaLocality: 'other',
      textDescription: 'Fix switchboard',
    },
  });
  assert(otherNoLandmarkRes.statusCode === 400, 'Selecting other locality without landmark rejected with 400');

  console.log('\n--- 4. Valid Booking Creation & Integrity ---');

  const booking1Key = `book-${Date.now()}-a1`;
  const create1Res = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: booking1Key,
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      landmark: 'Near Shiv Mandir',
      textDescription: 'Ceiling fan is making buzzing noise and spinning slowly',
      audioBase64: audio15s.toString('base64'),
      audioDurationSeconds: 15,
      // Attempt to tamper with price and provider
      visitingFee: 10.00,
      providerId: '00000000-0000-0000-0000-000000000000',
      status: 'PROVIDER_ASSIGNED',
    },
  });

  assert(create1Res.statusCode === 201, 'Valid booking returns HTTP 201 Created');
  const create1Body: ApiResponse<Booking> = JSON.parse(create1Res.payload);
  assert(create1Body.success === true, 'Response indicates success: true');
  const b1 = create1Body.data!;

  assert(Boolean(b1.id && b1.id.length > 20), 'Valid UUID booking ID returned');
  assert(b1.status === 'SERVICE_REQUESTED', 'Initial status is strictly SERVICE_REQUESTED');
  assert(b1.customerId === userAId, 'Customer ownership matches authenticated session user');
  assert(b1.providerId === null, 'Provider ID is strictly null (server-controlled, client tampering ignored)');
  assert(b1.visitingFee === 99.00, 'Visiting fee is strictly server-enforced from DB (tampered 10.00 ignored)');
  assert(b1.paymentMethod === 'CASH', 'Payment method is strictly CASH');
  assert(b1.paymentCollected === false, 'Payment collected is strictly false');
  assert(typeof b1.audioUrl === 'string' && b1.audioUrl.startsWith('/api/audio/'), 'Audio was saved and assigned audioUrl');
  assert(b1.audioDurationSeconds === 15, 'Audio duration matches recorded length');

  // Verify status audit log in database
  const { rows: statusLogs } = await pool.query<{ from_status: string | null; to_status: string; changed_by: string }>(
    'SELECT from_status, to_status, changed_by FROM booking_status_logs WHERE booking_id = $1',
    [b1.id]
  );
  assert(statusLogs.length === 1, 'Audit log entry created in booking_status_logs');
  assert(statusLogs[0].from_status === null, 'Initial status log from_status is null');
  assert(statusLogs[0].to_status === 'SERVICE_REQUESTED', 'Audit log to_status is SERVICE_REQUESTED');
  assert(statusLogs[0].changed_by === userAId, 'Audit log changed_by is customer ID');

  console.log('\n--- 4.2 30-Second Recording End-to-End Booking Creation & Retrieval ---');
  const booking30Key = `book-${Date.now()}-30s`;
  const create30Res = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: booking30Key,
      categoryId: 'electrician',
      areaLocality: 'chowka',
      landmark: 'Near Chowka Chowk',
      textDescription: '30s voice description test',
      audioBase64: base64Audio30s,
      audioDurationSeconds: 30,
    },
  });

  assert(create30Res.statusCode === 201, '30s audio booking returns HTTP 201 Created');
  const b30 = JSON.parse(create30Res.payload).data;
  assert(Boolean(b30.id), '30s audio booking has valid ID');
  assert(b30.audioDurationSeconds === 30, '30s audio duration matches 30 seconds');
  assert(typeof b30.audioUrl === 'string' && b30.audioUrl.startsWith('/api/audio/'), '30s audio URL generated');

  const b30Filename = b30.audioUrl.replace('/api/audio/', '');
  const b30FilePath = audioService.getAudioFilePath(b30Filename);
  assert(Boolean(b30FilePath && fs.existsSync(b30FilePath)), '30s audio file physically exists on server disk');
  const b30Stat = fs.statSync(b30FilePath!);
  assert(b30Stat.size === 60000, `30s audio file on disk matches exact binary size (60,000 bytes, measured: ${b30Stat.size})`);

  // Stream retrieval of 30s audio file
  const stream30Res = await app.inject({
    method: 'GET',
    url: b30.audioUrl,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(stream30Res.statusCode === 200, 'GET 30s audio returns HTTP 200');
  assert(stream30Res.headers['content-type'] === 'audio/webm', '30s audio stream has Content-Type audio/webm');
  assert(stream30Res.rawPayload.length === 60000, '30s audio stream raw payload length matches 60,000 bytes');
  assert(stream30Res.rawPayload.equals(audio30s), '30s audio stream byte content matches original synthesized buffer exactly');

  // Clean up 30s test file from disk
  await audioService.deleteAudioFile(b30Filename);

  console.log('\n--- 4.3 Payloads Exceeding 250 KB Limit Rejected Cleanly ---');
  // 300 KB buffer (> 256 KB limit in AudioService)
  const oversizeAudioBuffer = Buffer.alloc(300 * 1024, 0x5a);
  const oversizeBase64 = oversizeAudioBuffer.toString('base64');
  const oversizeKey = `book-${Date.now()}-oversize`;

  const oversizeRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: oversizeKey,
      categoryId: 'electrician',
      areaLocality: 'dam-road',
      textDescription: 'Oversize audio booking test',
      audioBase64: oversizeBase64,
      audioDurationSeconds: 30,
    },
  });

  assert(oversizeRes.statusCode === 400, 'Oversize audio payload (>250 KB) rejected with HTTP 400');
  const oversizeBody = JSON.parse(oversizeRes.payload);
  assert(oversizeBody.error?.code === 'AUDIO_SAVE_FAILED', 'Error code is strictly AUDIO_SAVE_FAILED');
  assert(oversizeBody.error?.messageEn?.includes('250 KB'), 'Error message specifically mentions 250 KB limit');

  // Confirm no booking was inserted for this idempotency key
  const { rows: oversizeBookingCheck } = await pool.query(
    'SELECT COUNT(*)::int as count FROM bookings WHERE idempotency_key = $1',
    [oversizeKey]
  );
  assert(oversizeBookingCheck[0].count === 0, 'No booking record created in database on oversize audio rejection');

  console.log('\n--- 4.4 Failed Audio Persistence & Atomic Rollback Verification ---');
  // Part A: Empty/Corrupt audio buffer rejects cleanly and leaves no DB record
  const corruptKey = `book-${Date.now()}-corrupt`;
  const corruptRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: corruptKey,
      categoryId: 'electrician',
      areaLocality: 'dam-road',
      textDescription: 'Corrupted audio booking test',
      audioBase64: 'data:audio/webm;base64,', // empty buffer
      audioDurationSeconds: 15,
    },
  });
  assert(corruptRes.statusCode === 400, 'Empty audio buffer rejected with HTTP 400');
  const { rows: corruptBookingCheck } = await pool.query(
    'SELECT COUNT(*)::int as count FROM bookings WHERE idempotency_key = $1',
    [corruptKey]
  );
  assert(corruptBookingCheck[0].count === 0, 'No booking record exists in DB on audio validation failure');

  // Part B: Database failure during transaction triggers rollback and audio file deletion
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'audio');
  const failKey = `book-${Date.now()}-dbfail`;

  // Temporarily add a check constraint that fails specifically for failKey
  await pool.query(
    `ALTER TABLE bookings ADD CONSTRAINT temp_test_abort_check CHECK (idempotency_key != '${failKey}')`
  );

  const filesBeforeFail = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);

  const dbFailRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: failKey,
      categoryId: 'electrician',
      areaLocality: 'station-colony',
      textDescription: 'Should fail on DB insert and clean up audio',
      audioBase64: base64Audio15s,
      audioDurationSeconds: 15,
    },
  });

  // Drop the temporary test constraint immediately
  await pool.query('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS temp_test_abort_check');

  assert(dbFailRes.statusCode === 500, 'Database failure returns HTTP 500');
  const dbFailBody = JSON.parse(dbFailRes.payload);
  assert(dbFailBody.error?.code === 'BOOKING_CREATION_FAILED', 'Error code is BOOKING_CREATION_FAILED');

  const filesAfterFail = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);
  const orphanedFiles = [...filesAfterFail].filter(f => !filesBeforeFail.has(f));
  assert(orphanedFiles.length === 0, 'Rollback successfully unlinked audio file; zero orphaned files on disk');

  const { rows: failBookingCheck } = await pool.query(
    'SELECT COUNT(*)::int as count FROM bookings WHERE idempotency_key = $1',
    [failKey]
  );
  assert(failBookingCheck[0].count === 0, 'No booking record created in database on transaction failure');

  console.log('\n--- 5. Idempotency & Duplicate Protection with Audio ---');

  // 5.1 Repeating the exact same request WITH AUDIO returns the exact same booking and does NOT duplicate audio file
  const filesBeforeRetry = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;

  const retryRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: booking1Key,
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      landmark: 'Near Shiv Mandir',
      textDescription: 'Ceiling fan is making buzzing noise and spinning slowly',
      audioBase64: audio15s.toString('base64'),
      audioDurationSeconds: 15,
    },
  });

  assert(retryRes.statusCode === 200 || retryRes.statusCode === 201, 'Idempotent retry returns HTTP 200/201');
  const retryBody: ApiResponse<Booking> = JSON.parse(retryRes.payload);
  assert(retryBody.data?.id === b1.id, 'Idempotent retry returns identical booking ID');
  assert(retryBody.data?.audioUrl === b1.audioUrl, 'Idempotent retry returns identical audio URL');

  const filesAfterRetry = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;
  assert(filesBeforeRetry === filesAfterRetry, 'Idempotent replay with audio does not create a duplicate audio file on disk');

  // 5.2 Verify DB contains only ONE record for this key
  const { rows: keyCount } = await pool.query(
    'SELECT COUNT(*)::int as count FROM bookings WHERE idempotency_key = $1',
    [booking1Key]
  );
  assert(keyCount[0].count === 1, 'Database contains exactly 1 booking for this idempotency key');

  // 5.3 Different customer attempting to use same idempotency key is rejected
  const conflictRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenB}` },
    payload: {
      idempotencyKey: booking1Key,
      categoryId: 'plumber',
      areaLocality: 'station-colony',
      textDescription: 'Tap leaking',
    },
  });
  assert(conflictRes.statusCode === 409, 'Reusing another customer idempotency key returns 409 Conflict');

  // 5.4 New key creates new booking
  const booking2Key = `book-${Date.now()}-b2`;
  const create2Res = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      idempotencyKey: booking2Key,
      categoryId: 'plumber',
      areaLocality: 'station-colony',
      landmark: 'Near Railway Platform 1',
      textDescription: 'Water pipe leak in kitchen',
    },
  });
  assert(create2Res.statusCode === 201, 'New idempotency key creates new booking');
  const b2 = JSON.parse(create2Res.payload).data;
  assert(b2.id !== b1.id, 'New booking has unique ID');
  assert(b2.visitingFee === 99.00, 'Plumber visiting fee is ₹99.00');

  console.log('\n--- 6. Customer Ownership & Listing Access ---');

  // 6.1 Customer A can read their own booking
  const getB1Res = await app.inject({
    method: 'GET',
    url: `/api/bookings/${b1.id}`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(getB1Res.statusCode === 200, 'Customer A can fetch their own booking');

  // 6.2 Customer B cannot read Customer A's booking
  const getB1ByB = await app.inject({
    method: 'GET',
    url: `/api/bookings/${b1.id}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert(getB1ByB.statusCode === 403, 'Customer B cannot access Customer A booking (403 Forbidden)');

  // 6.3 Customer A booking list returns their bookings
  const listARes = await app.inject({
    method: 'GET',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(listARes.statusCode === 200, 'Customer A can list bookings');
  const aList = JSON.parse(listARes.payload).data;
  assert(Array.isArray(aList) && aList.length >= 2, 'Customer A receives list of their created bookings');

  console.log('\n--- 7. Bilingual Dictionary Integrity for Module 5 ---');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  assert(enKeys.length === hiKeys.length, `Matching dictionary sizes (${enKeys.length} keys each)`);

  let allKeysValid = true;
  let noMixedHindi = true;
  for (const k of enKeys) {
    if (!hi[k as keyof typeof hi]) {
      allKeysValid = false;
      console.error(`  Missing Hindi key: ${k}`);
    }
    if (k !== 'lang.choose_title') {
      const hiVal = hi[k as keyof typeof hi];
      if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
        noMixedHindi = false;
        console.error(`  Leaked parenthetical English in Hindi key "${k}": ${hiVal}`);
      }
    }
  }
  assert(allKeysValid, 'All Module 5 translation keys defined in both languages');
  assert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary');

  console.log('\n--- 8. Canonical Locality List Verification ---');
  assert(CHANDIL_LOCALITIES.length === 11, `Canonical localities count is exactly 11 (actual: ${CHANDIL_LOCALITIES.length})`);

  const specificLocalities = CHANDIL_LOCALITIES.filter(l => l.id !== 'other');
  const otherLocality = CHANDIL_LOCALITIES.find(l => l.id === 'other');

  assert(specificLocalities.length === 10, 'Exactly 10 specific localities exist');
  assert(Boolean(otherLocality), 'Exactly 1 "other" locality exists (Other Area)');
  assert(otherLocality?.pincode === '832401', 'Other area uses Chandil head post office pincode 832401');

  for (const loc of CHANDIL_LOCALITIES) {
    assert(Boolean(loc.id && loc.nameEn && loc.nameHi && loc.pincode), `Locality ${loc.id} has complete bilingual metadata`);
  }

  console.log('\n--- 9. Server-Side is_test Flag Inheritance and Tamper Resistance ---');

  // Case 9.1: Normal customer (users.is_test = false) creates booking -> bookings.is_test = false
  await pool.query('UPDATE users SET is_test = false WHERE id = $1', [userAId]);
  const normalIdempKey = `test-normal-is-test-${Date.now()}`;
  const resNormal = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    payload: {
      idempotencyKey: normalIdempKey,
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      textDescription: 'Normal customer booking with default is_test = false',
    },
  });

  assert(resNormal.statusCode === 201, 'Normal booking creation returns HTTP 201');
  const normalBody = resNormal.json() as ApiResponse<Booking>;
  assert(normalBody.success === true, 'Normal booking creation succeeded');
  assert(normalBody.data?.isTest === false, 'Normal booking response returns isTest === false');

  const dbNormal = await pool.query<{ is_test: boolean }>(
    'SELECT is_test FROM bookings WHERE id = $1',
    [normalBody.data?.id]
  );
  assert(dbNormal.rows[0]?.is_test === false, 'Database booking row has is_test === false for normal customer');

  // Case 9.2: Test customer (users.is_test = true) creates booking -> bookings.is_test = true
  await pool.query('UPDATE users SET is_test = true WHERE id = $1', [userAId]);
  const testIdempKey = `test-flagged-is-test-${Date.now()}`;
  const resTest = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    payload: {
      idempotencyKey: testIdempKey,
      categoryId: 'electrician',
      areaLocality: 'station-colony',
      textDescription: 'Flagged test customer booking inheriting is_test = true',
    },
  });

  assert(resTest.statusCode === 201, 'Test customer booking creation returns HTTP 201');
  const testBody = resTest.json() as ApiResponse<Booking>;
  assert(testBody.success === true, 'Test customer booking creation succeeded');
  assert(testBody.data?.isTest === true, 'Test customer booking response returns isTest === true');

  const dbTest = await pool.query<{ is_test: boolean }>(
    'SELECT is_test FROM bookings WHERE id = $1',
    [testBody.data?.id]
  );
  assert(dbTest.rows[0]?.is_test === true, 'Database booking row has is_test === true inherited from users table');

  // Case 9.3: Client tampering attempt A: Normal customer sends { is_test: true, isTest: true }
  await pool.query('UPDATE users SET is_test = false WHERE id = $1', [userAId]);
  const tamperKeyA = `test-tamper-a-${Date.now()}`;
  const resTamperA = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    payload: {
      idempotencyKey: tamperKeyA,
      categoryId: 'plumber',
      areaLocality: 'chowka',
      textDescription: 'Normal customer attempting to inject is_test = true',
      is_test: true,
      isTest: true,
    },
  });

  assert(resTamperA.statusCode === 201, 'Tamper attempt A returns HTTP 201');
  const tamperBodyA = resTamperA.json() as ApiResponse<Booking>;
  assert(tamperBodyA.data?.isTest === false, 'Tamper attempt A response rejects client-supplied isTest and forces false');
  const dbTamperA = await pool.query<{ is_test: boolean }>(
    'SELECT is_test FROM bookings WHERE id = $1',
    [tamperBodyA.data?.id]
  );
  assert(dbTamperA.rows[0]?.is_test === false, 'Database booking row remains is_test === false despite client payload');

  // Case 9.4: Client tampering attempt B: Test customer sends { is_test: false, isTest: false }
  await pool.query('UPDATE users SET is_test = true WHERE id = $1', [userAId]);
  const tamperKeyB = `test-tamper-b-${Date.now()}`;
  const resTamperB = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    payload: {
      idempotencyKey: tamperKeyB,
      categoryId: 'plumber',
      areaLocality: 'chowka',
      textDescription: 'Test customer attempting to clear is_test via client payload',
      is_test: false,
      isTest: false,
    },
  });

  assert(resTamperB.statusCode === 201, 'Tamper attempt B returns HTTP 201');
  const tamperBodyB = resTamperB.json() as ApiResponse<Booking>;
  assert(tamperBodyB.data?.isTest === true, 'Tamper attempt B response rejects client-supplied isTest and enforces true');
  const dbTamperB = await pool.query<{ is_test: boolean }>(
    'SELECT is_test FROM bookings WHERE id = $1',
    [tamperBodyB.data?.id]
  );
  assert(dbTamperB.rows[0]?.is_test === true, 'Database booking row remains is_test === true inherited from users table');

  console.log('\n--- 10. Robust Audio Data-URI Parsing & Codec Preservation ---');

  // Realistic WebM-like binary fixture:
  // Starts with standard EBML header signature 0x1A 0x45 0xDF 0xA3, followed by 1024 bytes of simulated audio
  const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x1F, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81, 0x01]);
  const webmBody = Buffer.alloc(1024);
  for (let i = 0; i < 1024; i++) {
    webmBody[i] = (i * 31 + 17) % 256;
  }
  const realisticWebmFixture = Buffer.concat([webmHeader, webmBody]); // 1040 bytes
  const fixtureBase64 = realisticWebmFixture.toString('base64');

  // Case 10.1: data:audio/webm;codecs=opus;base64,...
  const codecUriPayload = `data:audio/webm;codecs=opus;base64,${fixtureBase64}`;
  const savedCodecAudio = await audioService.saveAudioBase64(codecUriPayload);
  assert(typeof savedCodecAudio.audioUrl === 'string' && savedCodecAudio.audioUrl.startsWith('/api/audio/'), '10.1 Saved audio URL is valid for codec data URI');
  assert(savedCodecAudio.filename.endsWith('.webm'), '10.1 Saved filename extension is .webm');
  assert(savedCodecAudio.byteSize === realisticWebmFixture.length, '10.1 Byte size metadata matches exact fixture length (1040 bytes)');

  const diskCodecPath = audioService.getAudioFilePath(savedCodecAudio.filename);
  assert(diskCodecPath !== null && fs.existsSync(diskCodecPath), '10.1 Audio file exists on disk');
  const diskCodecBytes = fs.readFileSync(diskCodecPath!);
  assert(diskCodecBytes.equals(realisticWebmFixture), '10.1 Stored file bytes exactly match original decoded WebM fixture bytes');
  await audioService.deleteAudioFile(savedCodecAudio.filename);

  // Case 10.2: Standard data:audio/webm;base64,... URI
  const stdUriPayload = `data:audio/webm;base64,${fixtureBase64}`;
  const savedStdAudio = await audioService.saveAudioBase64(stdUriPayload);
  assert(savedStdAudio.byteSize === realisticWebmFixture.length, '10.2 Standard data URI byte size matches exact fixture length');
  const diskStdPath = audioService.getAudioFilePath(savedStdAudio.filename);
  const diskStdBytes = fs.readFileSync(diskStdPath!);
  assert(diskStdBytes.equals(realisticWebmFixture), '10.2 Standard data URI stored file bytes exactly match original decoded fixture');
  await audioService.deleteAudioFile(savedStdAudio.filename);

  // Case 10.3: Raw Base64 input format
  const savedRawAudio = await audioService.saveAudioBase64(fixtureBase64, 'audio/webm');
  assert(savedRawAudio.byteSize === realisticWebmFixture.length, '10.3 Raw base64 input byte size matches exact fixture length');
  const diskRawPath = audioService.getAudioFilePath(savedRawAudio.filename);
  const diskRawBytes = fs.readFileSync(diskRawPath!);
  assert(diskRawBytes.equals(realisticWebmFixture), '10.3 Raw base64 stored file bytes exactly match original decoded fixture');
  await audioService.deleteAudioFile(savedRawAudio.filename);

  // Case 10.4: Malformed data URIs and invalid Base64 payloads
  // 10.4a: Non-audio media type rejected
  let caughtNonAudio = false;
  try {
    await audioService.saveAudioBase64(`data:text/html;base64,${fixtureBase64}`);
  } catch (err: any) {
    caughtNonAudio = err.message.includes('only audio data URIs are permitted');
  }
  assert(caughtNonAudio, '10.4a Non-audio data URI (data:text/html...) is rejected');

  // 10.4b: Missing comma separator rejected
  let caughtNoComma = false;
  try {
    await audioService.saveAudioBase64(`data:audio/webm;base64${fixtureBase64}`);
  } catch (err: any) {
    caughtNoComma = err.message.includes('missing comma separator');
  }
  assert(caughtNoComma, '10.4b Malformed data URI (missing comma) is rejected');

  // 10.4c: Invalid Base64 characters in payload rejected
  let caughtInvalidChars = false;
  try {
    await audioService.saveAudioBase64('data:audio/webm;codecs=opus;base64,!!!invalid--base64==');
  } catch (err: any) {
    caughtInvalidChars = err.message.includes('Invalid Base64 audio encoding');
  }
  assert(caughtInvalidChars, '10.4c Malformed Base64 payload containing illegal characters is rejected');

  // 10.4d: Unsupported audio format rejected
  let caughtUnsupportedAudio = false;
  try {
    await audioService.saveAudioBase64(`data:audio/flac;base64,${fixtureBase64}`);
  } catch (err: any) {
    caughtUnsupportedAudio = err.message.includes('Unsupported audio format');
  }
  assert(caughtUnsupportedAudio, '10.4d Unsupported audio subtype (audio/flac) is rejected');

  // Case 10.5: End-to-end booking creation with codecs=opus Data URI via app.inject
  const e2eKey = `test-codec-e2e-${Date.now()}`;
  const resCodecBooking = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    payload: {
      idempotencyKey: e2eKey,
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      textDescription: 'E2E booking with codecs=opus voice note',
      audioBase64: codecUriPayload,
      audioDurationSeconds: 7,
    },
  });
  assert(resCodecBooking.statusCode === 201, '10.5 Booking creation with codecs=opus data URI returns HTTP 201');
  const codecBookingBody = resCodecBooking.json() as ApiResponse<Booking>;
  assert(typeof codecBookingBody.data?.audioUrl === 'string', '10.5 Booking returned valid audioUrl');

  const e2eFilename = codecBookingBody.data!.audioUrl!.replace('/api/audio/', '');
  const e2eFilePath = audioService.getAudioFilePath(e2eFilename);
  assert(e2eFilePath !== null && fs.existsSync(e2eFilePath), '10.5 Booking audio file exists on disk');
  const e2eDiskBytes = fs.readFileSync(e2eFilePath!);
  assert(e2eDiskBytes.equals(realisticWebmFixture), '10.5 E2E stored audio bytes exactly match original fixture (not truncated)');

  // Stream back audio via GET /api/audio/:filename
  const streamCodecRes = await app.inject({
    method: 'GET',
    url: codecBookingBody.data!.audioUrl!,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert(streamCodecRes.statusCode === 200, '10.5 Authenticated audio stream returns HTTP 200');
  assert(streamCodecRes.headers['content-type'] === 'audio/webm', '10.5 Content-type is audio/webm');
  assert(streamCodecRes.rawPayload.equals(realisticWebmFixture), '10.5 Streamed bytes match original fixture exactly');

  // Clean up e2e booking and audio file
  await pool.query('DELETE FROM bookings WHERE idempotency_key = $1', [e2eKey]);
  await audioService.deleteAudioFile(e2eFilename);

  // Case 10.6: Reproduce original failure mechanism with legacy regex
  const legacyRegex = /^data:audio\/\w+;base64,/;
  const legacyCleaned = codecUriPayload.replace(legacyRegex, '');
  const legacyBuffer = Buffer.from(legacyCleaned, 'base64');
  assert(legacyCleaned.startsWith('data:audio/webm;codecs=opus;base64,'), '10.6 Legacy regex failed to strip codecs=opus prefix');
  assert(legacyBuffer.length === 15, '10.6 Legacy parser decodes exactly 15 bytes due to premature padding stop at opus=');
  assert(!legacyBuffer.equals(realisticWebmFixture), '10.6 Legacy parser corrupted and truncated the audio fixture');
  assert(diskCodecBytes.length === 1040, '10.6 Robust parser preserves complete 1040 bytes instead of 15 bytes');

  // Clean up b1 audio file from disk
  if (b1.audioUrl) {
    const b1Filename = b1.audioUrl.replace('/api/audio/', '');
    await audioService.deleteAudioFile(b1Filename);
  }

  // Clean up fixtures
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3)', [
    customerAPhone,
    customerBPhone,
    providerPhone,
  ]);

  console.log('\n============================================================');
  console.log(`BOOKING & VOICE TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  await app.close();
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runBookingTests().catch((err) => {
  console.error('Booking test encountered fatal error:', err);
  process.exit(1);
});
