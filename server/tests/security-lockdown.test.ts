import assert from 'node:assert';
import { buildApp, resolveCorsOrigin } from '../src/app';
import { db } from '../src/db';
import { audioService } from '../src/services/audio.service';
import { validateEnvConfig, DEV_DEFAULT_JWT_SECRET } from '../src/config/env';
import { ApiResponse, SupportConfig } from '@shared';
import { checkAuthOptionsRateLimit, resetAuthRateLimits } from '../src/routes/auth.routes';

async function runSecurityLockdownTests() {
  console.log('\n============================================================');
  console.log('MODULE 14 — SECURITY & PRIVACY LOCKDOWN VERIFICATION');
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

  // --- Fixtures Setup ---
  const cust1Phone = '9811000001';
  const cust2Phone = '9811000002';
  const prov1Phone = '9811000003';
  const prov2Phone = '9811000004';
  const adminPhone = '9811000005';

  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4, $5))', [
    cust1Phone, cust2Phone, prov1Phone, prov2Phone, adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4, $5)', [
    cust1Phone, cust2Phone, prov1Phone, prov2Phone, adminPhone,
  ]);

  // Insert Users
  const { rows: uCust1 } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language) VALUES ($1, 'customer', 'Customer One', 'en') RETURNING id`,
    [cust1Phone]
  );
  const cust1Id = uCust1[0].id;

  const { rows: uCust2 } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language) VALUES ($1, 'customer', 'Customer Two', 'hi') RETURNING id`,
    [cust2Phone]
  );
  const cust2Id = uCust2[0].id;

  const { rows: uProv1 } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language) VALUES ($1, 'provider', 'Provider One', 'hi') RETURNING id`,
    [prov1Phone]
  );
  const prov1Id = uProv1[0].id;

  const { rows: uProv2 } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language) VALUES ($1, 'provider', 'Provider Two', 'hi') RETURNING id`,
    [prov2Phone]
  );
  const prov2Id = uProv2[0].id;

  const { rows: uAdmin } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language) VALUES ($1, 'admin', 'Admin User', 'en') RETURNING id`,
    [adminPhone]
  );
  const adminId = uAdmin[0].id;

  // Generate tokens
  const tokenCust1 = app.jwt.sign({ id: cust1Id, phone: cust1Phone, role: 'customer', tokenVersion: 1 });
  const tokenCust2 = app.jwt.sign({ id: cust2Id, phone: cust2Phone, role: 'customer', tokenVersion: 1 });
  const tokenProv1 = app.jwt.sign({ id: prov1Id, phone: prov1Phone, role: 'provider', tokenVersion: 1 });
  const tokenProv2 = app.jwt.sign({ id: prov2Id, phone: prov2Phone, role: 'provider', tokenVersion: 1 });
  const tokenAdmin = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

  // Save real audio files
  const dummyAudioData = Buffer.from('RIFF....WAVEfmt ....data' + 'x'.repeat(4000));
  const savedWebm = await audioService.saveAudioBase64(dummyAudioData.toString('base64'), 'audio/webm');
  const savedWav = await audioService.saveAudioBase64(dummyAudioData.toString('base64'), 'audio/wav');

  // Insert Booking owned by Cust1, assigned to Prov1, with savedWebm audio
  const b1Idemp = `sec-lockdown-b1-${Date.now()}`;
  const { rows: b1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (
       idempotency_key, customer_id, provider_id, category_id,
       area_locality, text_description, audio_url, visiting_fee, status
     ) VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Fan buzzing', $4, 99.00, 'PROVIDER_ASSIGNED')
     RETURNING id`,
    [b1Idemp, cust1Id, prov1Id, savedWebm.audioUrl]
  );
  const b1Id = b1Rows[0].id;

  // Insert Booking 2 owned by Cust2 with savedWav audio (unassigned)
  const b2Idemp = `sec-lockdown-b2-${Date.now()}`;
  await pool.query(
    `INSERT INTO bookings (
       idempotency_key, customer_id, category_id,
       area_locality, text_description, audio_url, visiting_fee, status
     ) VALUES ($1, $2, 'plumber', 'chowka', 'Pipe leaking', $3, 99.00, 'SERVICE_REQUESTED')`,
    [b2Idemp, cust2Id, savedWav.audioUrl]
  );

  console.log('--- PART 1 & 2: Audio Privacy & Authorization ---');

  // 1. Unauthenticated request rejected (401)
  const unauthRes = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
  });
  testAssert(unauthRes.statusCode === 401, '1. Unauthenticated request to /api/audio/:filename rejected with 401');

  // 2. Customer owning booking allowed (200)
  const cust1Res = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: { authorization: `Bearer ${tokenCust1}` },
  });
  testAssert(cust1Res.statusCode === 200, '2. Customer owning booking allowed with 200');

  // 3. Different customer rejected (403)
  const cust2Res = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: { authorization: `Bearer ${tokenCust2}` },
  });
  testAssert(cust2Res.statusCode === 403, '3. Non-owning customer rejected with 403 Forbidden');

  // 4. Assigned provider allowed (200)
  const prov1Res = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: { authorization: `Bearer ${tokenProv1}` },
  });
  testAssert(prov1Res.statusCode === 200, '4. Assigned provider allowed with 200');

  // 5. Different provider rejected (403)
  const prov2Res = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: { authorization: `Bearer ${tokenProv2}` },
  });
  testAssert(prov2Res.statusCode === 403, '5. Different (unassigned) provider rejected with 403 Forbidden');

  // 6. Admin allowed (200)
  const adminRes = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(adminRes.statusCode === 200, '6. Admin allowed with 200');

  // 7. Unknown filename handled safely (404)
  const unknownRes = await app.inject({
    method: 'GET',
    url: '/api/audio/00000000-0000-0000-0000-000000000000.webm',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(unknownRes.statusCode === 404, '7. Unknown audio filename returns 404 cleanly');

  // 8. Path traversal remains blocked (404)
  const traversalRes = await app.inject({
    method: 'GET',
    url: '/api/audio/..%2f..%2fpackage.json',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(traversalRes.statusCode === 404, '8. Path traversal attempt blocked with 404');

  // 9. Valid range request still works (206)
  const rangeRes = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWebm.filename}`,
    headers: {
      authorization: `Bearer ${tokenCust1}`,
      range: 'bytes=0-100',
    },
  });
  testAssert(rangeRes.statusCode === 206, '9. Valid range request returns 206 Partial Content');
  testAssert(rangeRes.headers['content-range']?.startsWith('bytes 0-100/'), '9.1 Content-Range header present and valid');
  testAssert(rangeRes.rawPayload.length === 101, '9.2 Returned slice length matches requested byte range');

  // 10. MIME type still correct
  testAssert(cust1Res.headers['content-type'] === 'audio/webm', '10.1 WebM MIME type correct');
  const wavRes = await app.inject({
    method: 'GET',
    url: `/api/audio/${savedWav.filename}`,
    headers: { authorization: `Bearer ${tokenCust2}` },
  });
  testAssert(wavRes.headers['content-type'] === 'audio/wav', '10.2 WAV MIME type correct');

  console.log('\n--- PART 3: Production CORS Configuration ---');

  // 11. CORS resolver development behavior: allows all
  const devCors = resolveCorsOrigin('development');
  testAssert(devCors === true, '11. Development CORS returns true (preserves flexibility)');

  const testCors = resolveCorsOrigin('test');
  testAssert(testCors === true, '11.1 Test CORS returns true');

  // 12. CORS production behavior: missing config fails safely
  const prodEmptyCors = resolveCorsOrigin('production', undefined);
  testAssert(prodEmptyCors === false, '12. Production with missing CORS_ORIGIN returns false (fails safely)');

  const prodBlankCors = resolveCorsOrigin('production', '   ');
  testAssert(prodBlankCors === false, '12.1 Production with blank CORS_ORIGIN returns false');

  // 13. CORS production behavior with configured origin
  const prodConfiguredCors = resolveCorsOrigin('production', 'https://chandilservices.in, https://app.chandilservices.in');
  testAssert(Array.isArray(prodConfiguredCors), '13. Production with configured origins returns origin whitelist array');

  if (Array.isArray(prodConfiguredCors)) {
    testAssert(prodConfiguredCors.includes('https://chandilservices.in'), '13.1 Explicitly configured origin is allowed');
    testAssert(prodConfiguredCors.includes('https://app.chandilservices.in'), '13.2 Multiple comma-separated origins are supported');
    testAssert(!prodConfiguredCors.includes('https://evil-attacker.example.com'), '13.3 Unconfigured origin is denied');
  }

  // 14. Integrated Fastify CORS check in production mode
  const prodApp = await buildApp({
    customEnv: {
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://chandilservices.in',
      JWT_SECRET: 'a'.repeat(32),
    },
  });

  // A. Production + allowed Origin + OPTIONS -> expected successful preflight response with correct CORS headers
  const corsAllowedRes = await prodApp.inject({
    method: 'OPTIONS',
    url: '/api/ping',
    headers: {
      origin: 'https://chandilservices.in',
      'access-control-request-method': 'GET',
    },
  });
  testAssert(corsAllowedRes.statusCode === 204, '14. Allowed production preflight returns 204');
  testAssert(
    corsAllowedRes.headers['access-control-allow-origin'] === 'https://chandilservices.in',
    '14.1 Allowed production origin receives Access-Control-Allow-Origin header'
  );
  testAssert(
    corsAllowedRes.headers['access-control-allow-methods']?.includes('GET') === true,
    '14.2 Allowed preflight receives Access-Control-Allow-Methods header'
  );

  // B. Production + disallowed Origin + OPTIONS -> must not receive permissive CORS headers
  const corsDeniedRes = await prodApp.inject({
    method: 'OPTIONS',
    url: '/api/ping',
    headers: {
      origin: 'https://malicious-site.example.com',
      'access-control-request-method': 'GET',
    },
  });
  testAssert(
    corsDeniedRes.headers['access-control-allow-origin'] === undefined,
    '14.3 Disallowed production origin does not receive Access-Control-Allow-Origin header'
  );

  // C. Production + missing CORS_ORIGIN -> preflight must remain fail-closed
  const prodNoCorsApp = await buildApp({
    customEnv: {
      NODE_ENV: 'production',
      CORS_ORIGIN: '',
      JWT_SECRET: 'a'.repeat(32),
    },
  });
  const corsMissingRes = await prodNoCorsApp.inject({
    method: 'OPTIONS',
    url: '/api/ping',
    headers: {
      origin: 'https://chandilservices.in',
      'access-control-request-method': 'GET',
    },
  });
  testAssert(
    corsMissingRes.headers['access-control-allow-origin'] === undefined,
    '14.4 Missing CORS_ORIGIN in production remains fail-closed'
  );

  // D. Development/test -> existing behavior remains compatible
  const devApp = await buildApp({
    customEnv: {
      NODE_ENV: 'development',
    },
  });
  const devPreflightRes = await devApp.inject({
    method: 'OPTIONS',
    url: '/api/ping',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'GET',
    },
  });
  testAssert(devPreflightRes.statusCode === 204, '14.5 Development preflight returns 204');
  testAssert(
    devPreflightRes.headers['access-control-allow-origin'] === 'http://localhost:5173' ||
    devPreflightRes.headers['access-control-allow-origin'] === '*',
    '14.6 Development preflight allows development origin'
  );

  console.log('\n--- PART 4: JWT Secret Production Hardening ---');

  // 15. Production + missing secret -> validation failure
  let missingSecretFailed = false;
  try {
    validateEnvConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
  } catch (err: any) {
    missingSecretFailed = true;
    testAssert(
      err.errors?.some((e: any) => e.path.includes('JWT_SECRET')),
      '15. Production with missing JWT_SECRET fails validation with clear issue'
    );
  }
  testAssert(missingSecretFailed, '15.1 Missing JWT_SECRET in production threw validation error');

  // 16. Production + short secret (<32 chars) -> validation failure
  let shortSecretFailed = false;
  try {
    validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'short-secret-under-32-chars',
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
  } catch (err: any) {
    shortSecretFailed = true;
    testAssert(
      err.errors?.some((e: any) => e.message?.includes('at least 32 characters')),
      '16. Production with short secret (<32 chars) fails validation with clear message'
    );
  }
  testAssert(shortSecretFailed, '16.1 Short JWT_SECRET in production threw validation error');

  // 17. Production + default dev secret -> validation failure
  let defaultSecretFailed = false;
  try {
    validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: DEV_DEFAULT_JWT_SECRET,
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
  } catch (err: any) {
    defaultSecretFailed = true;
    testAssert(
      err.errors?.some((e: any) => e.message?.includes('default development secret')),
      '17. Production with default dev secret fails validation'
    );
  }
  testAssert(defaultSecretFailed, '17.1 Default dev secret in production threw validation error');

  // 18. Production + valid secret (>=32 chars) -> success
  const validProdEnv = validateEnvConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'super-secure-production-secret-min32chars-xyz!',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  });
  testAssert(
    validProdEnv.JWT_SECRET === 'super-secure-production-secret-min32chars-xyz!',
    '18. Production with valid 32+ char secret succeeds validation'
  );

  // 19. Development behavior retains default
  const devEnv = validateEnvConfig({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  });
  testAssert(
    devEnv.JWT_SECRET === DEV_DEFAULT_JWT_SECRET,
    '19. Development environment safely defaults to local development secret'
  );

  console.log('\n--- PART 5 & 6: Support Contact Configuration ---');

  // 20. GET /api/config/support returns contacts
  const configRes = await app.inject({
    method: 'GET',
    url: '/api/config/support',
  });
  testAssert(configRes.statusCode === 200, '20. GET /api/config/support returns 200 OK');
  const configBody: ApiResponse<SupportConfig> = JSON.parse(configRes.payload);
  testAssert(configBody.success === true, '20.1 Response success is true');
  testAssert(Boolean(configBody.data?.supportPhone), '20.2 supportPhone is populated');
  testAssert(Boolean(configBody.data?.supportWhatsApp), '20.3 supportWhatsApp is populated');

  // Verify app_configs DB integration
  await pool.query(
    `INSERT INTO app_configs (key, value, description)
     VALUES ('support_phone', '+919999888877', 'Test contact'),
            ('support_whatsapp', '+919999888877', 'Test contact')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );

  const updatedConfigRes = await app.inject({
    method: 'GET',
    url: '/api/config/support',
  });
  const updatedBody: ApiResponse<SupportConfig> = JSON.parse(updatedConfigRes.payload);
  testAssert(updatedBody.data?.supportPhone === '+919999888877', '20.4 DB app_configs value overrides/serves supportPhone');
  testAssert(updatedBody.data?.supportWhatsApp === '+919999888877', '20.5 DB app_configs value overrides/serves supportWhatsApp');

  // Reset to default seed
  await pool.query(
    `INSERT INTO app_configs (key, value, description)
     VALUES ('support_phone', '+919876543210', 'Primary support'),
            ('support_whatsapp', '+919876543210', 'WhatsApp support')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );

  console.log('\n--- PART 7: Security Vulnerability Remediation Hardening (CHS-SEC-001 - 007) ---');

  // 21. CHS-SEC-001: Standard Defensive Security Headers
  const pingHeadersRes = await app.inject({
    method: 'GET',
    url: '/api/ping',
  });
  testAssert(pingHeadersRes.headers['x-content-type-options'] === 'nosniff', '21.1 X-Content-Type-Options: nosniff header present');
  testAssert(pingHeadersRes.headers['x-frame-options'] === 'DENY', '21.2 X-Frame-Options: DENY header present');
  testAssert(pingHeadersRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', '21.3 Referrer-Policy header present');
  testAssert(pingHeadersRes.headers['permissions-policy'] === 'camera=(self), microphone=(self), geolocation=()', '21.4 Permissions-Policy header present');
  testAssert(pingHeadersRes.headers['cross-origin-opener-policy'] === 'same-origin', '21.5 Cross-Origin-Opener-Policy header present');

  // HSTS in production
  const prodHstsRes = await prodApp.inject({
    method: 'GET',
    url: '/api/ping',
    headers: { origin: 'https://chandilservices.in' },
  });
  testAssert(
    prodHstsRes.headers['strict-transport-security'] === 'max-age=31536000; includeSubDomains',
    '21.6 Strict-Transport-Security header present in production mode'
  );

  // 22. CHS-SEC-002: Production Error Sanitization
  const errApp = await buildApp({
    customEnv: {
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
    },
  });
  errApp.get('/test-internal-error', async () => {
    throw new Error('Secret database connection string: postgres://admin:secret@db/prod');
  });
  const prodErrRes = await errApp.inject({
    method: 'GET',
    url: '/test-internal-error',
  });
  testAssert(prodErrRes.statusCode === 500, '22.1 Internal error returns HTTP 500');
  const prodErrBody = JSON.parse(prodErrRes.payload);
  testAssert(
    prodErrBody.error?.messageEn === 'An unexpected internal error occurred.',
    '22.2 Internal error message is sanitized in production'
  );
  testAssert(
    !prodErrRes.payload.includes('Secret database connection string'),
    '22.3 Internal error does not leak sensitive stack or database details'
  );

  // 23. CHS-SEC-005: Strict audio matching (no loose wildcard leakage)
  const partialRes = await app.inject({
    method: 'GET',
    url: '/api/audio/' + savedWebm.filename.slice(0, 10),
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(partialRes.statusCode === 404, '23. Partial filename substring query returns 404 and does not match');

  // 24. CHS-SEC-006: IP-based sliding window rate limiting on challenge options
  resetAuthRateLimits();
  const testIp = '198.51.100.42';
  testAssert(checkAuthOptionsRateLimit(testIp, 2, 60000) === true, '24.1 Rate limit allows request 1');
  testAssert(checkAuthOptionsRateLimit(testIp, 2, 60000) === true, '24.2 Rate limit allows request 2');
  testAssert(checkAuthOptionsRateLimit(testIp, 2, 60000) === false, '24.3 Rate limit rejects request 3 when limit is 2');
  resetAuthRateLimits();
  testAssert(checkAuthOptionsRateLimit(testIp, 2, 60000) === true, '24.4 Resetting rate limits clears throttle window');

  // Fill limit for fake IP to verify route 429 response
  for (let i = 0; i < 35; i++) {
    checkAuthOptionsRateLimit('203.0.113.99', 30, 60000);
  }
  const rateLimitRes = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/login-options',
    remoteAddress: '203.0.113.99',
    payload: {},
  });
  testAssert(rateLimitRes.statusCode === 429, '24.5 Endpoint returns 429 when rate limit exceeded');
  const rateLimitBody = JSON.parse(rateLimitRes.payload);
  testAssert(rateLimitBody.error?.code === 'RATE_LIMIT_EXCEEDED', '24.6 Rate limit returns RATE_LIMIT_EXCEEDED code');

  // 25. CHS-SEC-007: Role claim synchronization from database in authenticate middleware
  // Cust1 is initially role 'customer'. Update in DB to 'provider'
  await pool.query("UPDATE users SET role = 'provider' WHERE id = $1", [cust1Id]);
  await pool.query(
    `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, verification_status)
     VALUES ($1, 'plumber', 'Chandil', true, 'VERIFIED')
     ON CONFLICT (user_id) DO UPDATE SET verification_status = 'VERIFIED', is_available = true`,
    [cust1Id]
  );
  const syncRoleRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${tokenCust1}` },
  });
  testAssert(syncRoleRes.statusCode === 200, '25.1 Fresh DB role permits access without requiring re-issuance of JWT');
  // Revert role back to 'customer'
  await pool.query("UPDATE users SET role = 'customer' WHERE id = $1", [cust1Id]);
  await pool.query("DELETE FROM provider_profiles WHERE user_id = $1", [cust1Id]);
  const revokedRoleRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${tokenCust1}` },
  });
  testAssert(revokedRoleRes.statusCode === 403, '25.2 Downgraded DB role immediately blocks access with 403');

  // Clean up test bookings and users
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4, $5))', [
    cust1Phone, cust2Phone, prov1Phone, prov2Phone, adminPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4, $5))', [
    cust1Phone, cust2Phone, prov1Phone, prov2Phone, adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4, $5)', [
    cust1Phone, cust2Phone, prov1Phone, prov2Phone, adminPhone,
  ]);

  // Clean up audio files
  await audioService.deleteAudioFile(savedWebm.filename);
  await audioService.deleteAudioFile(savedWav.filename);

  console.log(`\n============================================================`);
  console.log(`TOTAL SECURITY LOCKDOWN TESTS: ${passed} PASS, ${failed} FAIL`);
  console.log(`============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSecurityLockdownTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
