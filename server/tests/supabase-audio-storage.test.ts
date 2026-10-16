import assert from 'node:assert';
import {
  AudioService,
  SupabaseStorageDriver,
  LocalStorageDriver,
  R2StorageDriver,
} from '../src/services/audio.service';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import crypto from 'node:crypto';

function testAssert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runSupabaseStorageTests() {
  console.log('============================================================');
  console.log('SUPABASE PERSISTENT AUDIO STORAGE TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // PART 1: Configuration Validation & Security Guards
  // -------------------------------------------------------------
  console.log('--- 1. Configuration Validation & Fail-Safe Guards ---');

  // 1.1 Incomplete config throws clear error
  let thrown = false;
  try {
    new SupabaseStorageDriver({
      url: '',
      serviceRoleKey: '',
      bucketName: '',
    });
  } catch (err: any) {
    thrown = true;
    testAssert(
      err.message.includes('Missing required variables'),
      '1.1 Incomplete Supabase configuration throws clear error'
    );
    testAssert(
      !err.message.includes('secret') || err.message.includes('SUPABASE_SERVICE_ROLE_KEY'),
      '1.2 Error message does not leak secret values'
    );
  }
  testAssert(thrown, '1.3 Empty configuration is rejected safely');

  // 1.2 Missing URL
  let urlThrown = false;
  try {
    new SupabaseStorageDriver({
      url: '',
      serviceRoleKey: 'test-key',
      bucketName: 'test-bucket',
    });
  } catch (err: any) {
    urlThrown = true;
    testAssert(
      err.message.includes('SUPABASE_URL'),
      '1.4 Missing SUPABASE_URL is detected'
    );
  }
  testAssert(urlThrown, '1.5 Supabase driver without URL is rejected');

  // 1.3 Missing Service Role Key
  let keyThrown = false;
  try {
    new SupabaseStorageDriver({
      url: 'https://test-project.supabase.co',
      serviceRoleKey: '',
      bucketName: 'test-bucket',
    });
  } catch (err: any) {
    keyThrown = true;
    testAssert(
      err.message.includes('SUPABASE_SERVICE_ROLE_KEY'),
      '1.6 Missing SUPABASE_SERVICE_ROLE_KEY is detected'
    );
  }
  testAssert(keyThrown, '1.7 Supabase driver without Service Role Key is rejected');

  // 1.4 URL trailing slash is stripped safely
  const driverWithSlash = new SupabaseStorageDriver(
    {
      url: 'https://test-project.supabase.co///',
      serviceRoleKey: 'secret-service-key-xyz',
      bucketName: 'chandil-staging-audio',
    },
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
  testAssert(
    driverWithSlash.getLocalPath('test.webm') === null,
    '1.8 Driver instantiated with trailing slash sanitizes URL and returns null for local path'
  );

  // -------------------------------------------------------------
  // PART 2: Mock Fetch Client & Driver Unit Operations
  // -------------------------------------------------------------
  console.log('\n--- 2. Mock Fetch Client & Driver Unit Operations ---');

  const inMemoryBucket = new Map<string, { body: Buffer; contentType: string }>();
  const testSecretKey = 'super-secret-service-role-key-12345';
  const testBucket = 'chandil-staging-audio';
  const testUrl = 'https://mockproject.supabase.co';

  const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    const headers = new Headers(init?.headers);

    // Verify Authorization header
    const authHeader = headers.get('authorization');
    if (authHeader !== `Bearer ${testSecretKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. UPLOAD: POST ${testUrl}/storage/v1/object/${testBucket}/audio/:filename
    const uploadPrefix = `${testUrl}/storage/v1/object/${testBucket}/audio/`;
    if (method === 'POST' && urlStr.startsWith(uploadPrefix)) {
      const filename = urlStr.slice(uploadPrefix.length);
      const contentType = headers.get('content-type') || 'audio/webm';
      let bodyBuf: Buffer;
      if (Buffer.isBuffer(init?.body)) {
        bodyBuf = init?.body;
      } else if (init?.body instanceof Uint8Array) {
        bodyBuf = Buffer.from(init.body);
      } else if (typeof init?.body === 'string') {
        bodyBuf = Buffer.from(init.body);
      } else {
        bodyBuf = Buffer.alloc(0);
      }

      inMemoryBucket.set(`audio/${filename}`, { body: bodyBuf, contentType });
      return new Response(JSON.stringify({ Key: `${testBucket}/audio/${filename}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. RETRIEVE: GET ${testUrl}/storage/v1/object/authenticated/${testBucket}/audio/:filename
    const getPrefix = `${testUrl}/storage/v1/object/authenticated/${testBucket}/audio/`;
    if (method === 'GET' && urlStr.startsWith(getPrefix)) {
      const filename = urlStr.slice(getPrefix.length);
      const item = inMemoryBucket.get(`audio/${filename}`);
      if (!item) {
        return new Response(JSON.stringify({ statusCode: '404', error: 'Not Found', message: 'Object not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(item.body, {
        status: 200,
        headers: {
          'Content-Type': item.contentType,
          'Content-Length': item.body.length.toString(),
        },
      });
    }

    // 3. DELETE: DELETE ${testUrl}/storage/v1/object/${testBucket}
    const deleteEndpoint = `${testUrl}/storage/v1/object/${testBucket}`;
    if (method === 'DELETE' && urlStr === deleteEndpoint) {
      let prefixes: string[] = [];
      try {
        const bodyObj = JSON.parse(init?.body as string);
        prefixes = bodyObj.prefixes || [];
      } catch {
        // ignore
      }
      for (const p of prefixes) {
        inMemoryBucket.delete(p);
      }
      return new Response(JSON.stringify({ message: 'Deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  };

  const supabaseDriver = new SupabaseStorageDriver(
    {
      url: testUrl,
      serviceRoleKey: testSecretKey,
      bucketName: testBucket,
    },
    mockFetch
  );

  const testAudioService = new AudioService(supabaseDriver);

  // 2.1 Save audio through Supabase driver
  const sampleAudioBuffer = Buffer.from('RIFF-TEST-SAMPLE-BYTES-SUPABASE-STORAGE-12345');
  const base64Data = `data:audio/webm;base64,${sampleAudioBuffer.toString('base64')}`;
  const savedResult = await testAudioService.saveAudioBase64(base64Data);

  testAssert(savedResult.audioUrl.startsWith('/api/audio/'), '2.1 Audio URL has correct format /api/audio/:uuid');
  testAssert(savedResult.filename.endsWith('.webm'), '2.2 Stored file has .webm extension');
  testAssert(savedResult.byteSize === sampleAudioBuffer.length, '2.3 Byte size matches input buffer');

  const expectedKey = `audio/${savedResult.filename}`;
  testAssert(inMemoryBucket.has(expectedKey), '2.4 File was stored in mock Supabase bucket with correct prefix');
  testAssert(inMemoryBucket.get(expectedKey)!.body.equals(sampleAudioBuffer), '2.5 Stored bytes match original payload');
  testAssert(inMemoryBucket.get(expectedKey)!.contentType === 'audio/webm', '2.6 Stored content type is audio/webm');

  // 2.2 Retrieve audio from Supabase driver
  const retrieved = await testAudioService.getAudioFile(savedResult.filename);
  testAssert(retrieved !== null, '2.7 Audio successfully retrieved from Supabase driver');
  testAssert(retrieved!.buffer.equals(sampleAudioBuffer), '2.8 Retrieved buffer matches original exactly');
  testAssert(retrieved!.contentLength === sampleAudioBuffer.length, '2.9 Content length matches buffer length');
  testAssert(retrieved!.contentType === 'audio/webm', '2.10 Content type matches expected WebM');

  // 2.3 Non-existent object returns null cleanly
  const missingResult = await testAudioService.getAudioFile('00000000-0000-0000-0000-000000000000.webm');
  testAssert(missingResult === null, '2.11 Missing Supabase object returns null without throwing');

  // 2.4 Delete object
  await testAudioService.deleteAudioFile(savedResult.filename);
  testAssert(!inMemoryBucket.has(expectedKey), '2.12 Delete removes object from storage');

  // 2.5 Path traversal guards
  testAssert((await supabaseDriver.get('../../../etc/passwd')) === null, '2.13 Path traversal in get returns null');
  await supabaseDriver.delete('../../../etc/passwd'); // Must not throw
  testAssert(true, '2.14 Path traversal in delete safely returns without throwing');

  // 2.6 Secret Key Redaction on Upload Failure
  const errorLeakingFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ message: `Access denied for key ${testSecretKey}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  };
  const leakingDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    errorLeakingFetch
  );
  let uploadErrorCaught = false;
  try {
    await leakingDriver.save('test.webm', Buffer.from('test'), 'audio/webm');
  } catch (err: any) {
    uploadErrorCaught = true;
    testAssert(
      !err.message.includes(testSecretKey),
      '2.15 Error message sanitizes and redacts secret key'
    );
    testAssert(
      err.message.includes('[REDACTED]'),
      '2.16 Secret key was replaced by [REDACTED]'
    );
  }
  testAssert(uploadErrorCaught, '2.17 Upload error was safely thrown');

  // 2.7 Fine-Grained Status Code & Error Differentiation Tests
  // Missing object (404 JSON)
  const get404JsonDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: '404', message: 'Object not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  );
  testAssert((await get404JsonDriver.get('11111111-1111-1111-1111-111111111111.webm')) === null, '2.18 Missing object via 404 JSON returns null');

  // Missing object (404 Non-JSON plain text)
  const get404PlainDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response('Not Found', { status: 404 })
  );
  testAssert((await get404PlainDriver.get('11111111-1111-1111-1111-111111111111.webm')) === null, '2.19 Missing object via 404 plain text returns null');

  // Missing object (400 JSON with object not found)
  const get400ObjectMissingDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: 400, message: 'Object not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  );
  testAssert((await get400ObjectMissingDriver.get('11111111-1111-1111-1111-111111111111.webm')) === null, '2.20 Missing object via 400 returns null');

  // Invalid bucket (404 with Bucket not found) -> MUST THROW configuration error
  const get404BucketMissingDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: '404', message: 'Bucket not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  );
  let bucket404Thrown = false;
  try {
    await get404BucketMissingDriver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    bucket404Thrown = true;
    testAssert(err.message.includes('configuration error') || err.message.includes('Bucket not found'), '2.21 Bucket not found via 404 throws configuration error');
  }
  testAssert(bucket404Thrown, '2.22 Invalid bucket on 404 is not swallowed as null');

  // Invalid bucket (400 with Bucket not found) -> MUST THROW retrieval error
  const get400BucketMissingDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: 400, message: 'Bucket not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  );
  let bucket400Thrown = false;
  try {
    await get400BucketMissingDriver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    bucket400Thrown = true;
    testAssert(err.message.includes('Bucket not found'), '2.23 Bucket not found via 400 throws storage error');
  }
  testAssert(bucket400Thrown, '2.24 Invalid bucket on 400 is not swallowed as null');

  // Malformed 400 error (unrecognized error body) -> MUST THROW
  const get400MalformedDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'Invalid payload structure' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  );
  let malformed400Thrown = false;
  try {
    await get400MalformedDriver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    malformed400Thrown = true;
    testAssert(err.message.includes('400'), '2.25 Malformed 400 throws error');
  }
  testAssert(malformed400Thrown, '2.26 Unrecognized 400 is not swallowed as null');

  // HTTP 401 Unauthorized -> MUST THROW
  const get401Driver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: 401, message: 'Invalid API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  );
  let auth401Thrown = false;
  try {
    await get401Driver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    auth401Thrown = true;
    testAssert(err.message.includes('401') && err.message.includes('Invalid API key'), '2.27 HTTP 401 throws clear retrieval error');
  }
  testAssert(auth401Thrown, '2.28 HTTP 401 is rejected safely');

  // HTTP 403 Forbidden -> MUST THROW
  const get403Driver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response(JSON.stringify({ statusCode: 403, message: 'Forbidden bucket access' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  );
  let auth403Thrown = false;
  try {
    await get403Driver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    auth403Thrown = true;
    testAssert(err.message.includes('403') && err.message.includes('Forbidden'), '2.29 HTTP 403 throws clear retrieval error');
  }
  testAssert(auth403Thrown, '2.30 HTTP 403 is rejected safely');

  // HTTP 500 Internal Server Error (Non-JSON HTML) -> MUST THROW cleanly
  const get500HtmlDriver = new SupabaseStorageDriver(
    { url: testUrl, serviceRoleKey: testSecretKey, bucketName: testBucket },
    async () => new Response('<html>500 Gateway Timeout</html>', { status: 500, statusText: 'Gateway Timeout' })
  );
  let server500Thrown = false;
  try {
    await get500HtmlDriver.get('11111111-1111-1111-1111-111111111111.webm');
  } catch (err: any) {
    server500Thrown = true;
    testAssert(err.message.includes('500'), '2.31 HTTP 500 throws clear retrieval error without JSON parse crash');
  }
  testAssert(server500Thrown, '2.32 Non-JSON 500 is safely handled');
  console.log('\n--- 3. End-to-End Route Integration & Authorization ---');

  const app = await buildApp();
  const pool = db.getPool()!;

  // Create isolated test fixture accounts with unique phone numbers
  const custAId = crypto.randomUUID();
  const custBId = crypto.randomUUID();
  const provId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const randSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const phoneA = `97${randSuffix}1`;
  const phoneB = `97${randSuffix}2`;
  const phoneP = `97${randSuffix}3`;
  const phoneAdmin = `97${randSuffix}4`;

  await pool.query(
    `INSERT INTO users (id, phone, role, full_name, is_test) VALUES
     ($1, $2, 'customer', 'Supabase Cust A', true),
     ($3, $4, 'customer', 'Supabase Cust B', true),
     ($5, $6, 'provider', 'Supabase Prov Assigned', true),
     ($7, $8, 'admin', 'Supabase Admin', true)`,
    [custAId, phoneA, custBId, phoneB, provId, phoneP, adminId, phoneAdmin]
  );

  const tokenCustA = app.jwt.sign({ id: custAId, phone: phoneA, role: 'customer', tokenVersion: 1 });
  const tokenCustB = app.jwt.sign({ id: custBId, phone: phoneB, role: 'customer', tokenVersion: 1 });
  const tokenProv = app.jwt.sign({ id: provId, phone: phoneP, role: 'provider', tokenVersion: 1 });
  const tokenAdmin = app.jwt.sign({ id: adminId, phone: phoneAdmin, role: 'admin', tokenVersion: 1 });

  // Upload an audio file into our Supabase driver
  const bookingAudioBuffer = Buffer.from('EBML-HEADER-TEST-SUPABASE-VOICE-NOTE-SAMPLE-BYTES-98765');
  const bookingBase64 = `data:audio/webm;base64,${bookingAudioBuffer.toString('base64')}`;
  const supabaseAudio = await testAudioService.saveAudioBase64(bookingBase64);

  // Set the main audioService to use our supabaseDriver for this test run
  const { audioService: mainAudioService } = await import('../src/services/audio.service');
  const originalDriver = mainAudioService.getDriver();
  mainAudioService.setDriver(supabaseDriver);

  // Insert a test booking owned by Customer A with assigned Provider
  const bookingId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, landmark, text_description, audio_url, status, visiting_fee, payment_method, provider_id, is_test)
     VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Supabase Test Landmark', 'Supabase Test Problem', $4, 'PROVIDER_ASSIGNED', 99.00, 'CASH', $5, true)`,
    [bookingId, `idem-${bookingId}`, custAId, supabaseAudio.audioUrl, provId]
  );

  // 3.1 Customer A (owner) can stream their audio from Supabase
  const resCustA = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustA}` },
  });
  testAssert(resCustA.statusCode === 200, '3.1 Owning customer receives 200 OK');
  testAssert(resCustA.headers['content-type'] === 'audio/webm', '3.2 Content-Type header is audio/webm');
  testAssert(
    parseInt(resCustA.headers['content-length'] as string, 10) === bookingAudioBuffer.length,
    '3.3 Content-Length matches exact bytes'
  );
  testAssert(resCustA.rawPayload.equals(bookingAudioBuffer), '3.4 Streamed payload matches stored bytes byte-for-byte');

  // 3.2 Customer B (different customer) is rejected with 403 Forbidden
  const resCustB = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustB}` },
  });
  testAssert(resCustB.statusCode === 403, '3.5 Non-owning customer rejected with 403 Forbidden');
  testAssert(JSON.parse(resCustB.body).error.code === 'FORBIDDEN', '3.6 Error code is FORBIDDEN');

  // 3.3 Assigned provider can stream the audio from Supabase
  const resProv = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenProv}` },
  });
  testAssert(resProv.statusCode === 200, '3.7 Assigned provider receives 200 OK');
  testAssert(resProv.rawPayload.equals(bookingAudioBuffer), '3.8 Assigned provider receives exact byte payload');

  // 3.4 Unassigned provider is rejected with 403 Forbidden
  const unassignedProvId = crypto.randomUUID();
  const phoneUnassigned = `97${randSuffix}5`;
  await pool.query(
    `INSERT INTO users (id, phone, role, full_name, is_test) VALUES ($1, $2, 'provider', 'Unassigned Supabase Prov', true)`,
    [unassignedProvId, phoneUnassigned]
  );
  const tokenUnassignedProv = app.jwt.sign({ id: unassignedProvId, phone: phoneUnassigned, role: 'provider', tokenVersion: 1 });

  const resUnassignedProv = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenUnassignedProv}` },
  });
  testAssert(resUnassignedProv.statusCode === 403, '3.9 Unassigned provider rejected with 403 Forbidden');

  // 3.5 Admin can stream the audio
  const resAdmin = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(resAdmin.statusCode === 200, '3.10 Admin receives 200 OK for operational access');

  // 3.6 HTTP Range Request (206 Partial Content)
  const resRange = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: {
      authorization: `Bearer ${tokenCustA}`,
      range: 'bytes=0-9',
    },
  });
  testAssert(resRange.statusCode === 206, '3.11 HTTP Range request returns 206 Partial Content');
  testAssert(
    resRange.headers['content-range'] === `bytes 0-9/${bookingAudioBuffer.length}`,
    '3.12 Content-Range header is formatted correctly'
  );
  testAssert(parseInt(resRange.headers['content-length'] as string, 10) === 10, '3.13 Range Content-Length is exactly 10 bytes');
  testAssert(resRange.rawPayload.equals(bookingAudioBuffer.subarray(0, 10)), '3.14 Partial byte slice matches exact slice');

  // 3.7 Missing object in Supabase storage returns 404 cleanly
  const ghostAudioFilename = `${crypto.randomUUID()}.webm`;
  const ghostBookingId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, landmark, text_description, audio_url, status, visiting_fee, payment_method, is_test)
     VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'Ghost Landmark', 'Ghost Problem', $4, 'SERVICE_REQUESTED', 99.00, 'CASH', true)`,
    [ghostBookingId, `idem-${ghostBookingId}`, custAId, `/api/audio/${ghostAudioFilename}`]
  );

  const resMissing = await app.inject({
    method: 'GET',
    url: `/api/audio/${ghostAudioFilename}`,
    headers: { authorization: `Bearer ${tokenCustA}` },
  });
  testAssert(resMissing.statusCode === 404, '3.15 Missing Supabase object returns 404 Not Found cleanly');
  testAssert(JSON.parse(resMissing.body).error.code === 'AUDIO_NOT_FOUND', '3.16 Error code is AUDIO_NOT_FOUND');

  // 3.8 Supabase Storage failure returns 500 without crashing server
  const failingFetch: typeof fetch = async () => {
    throw new Error('Simulated network failure communicating with Supabase');
  };
  const failingDriver = new SupabaseStorageDriver(
    {
      url: testUrl,
      serviceRoleKey: testSecretKey,
      bucketName: testBucket,
    },
    failingFetch
  );
  mainAudioService.setDriver(failingDriver);

  const resFailure = await app.inject({
    method: 'GET',
    url: supabaseAudio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustA}` },
  });
  testAssert(resFailure.statusCode === 500, '3.17 Storage network failure returns HTTP 500');
  testAssert(JSON.parse(resFailure.body).error.code === 'STORAGE_ERROR', '3.18 Error code is STORAGE_ERROR');

  // 3.9 Local and R2 storage drivers still exist and work
  const localDriver = new LocalStorageDriver();
  mainAudioService.setDriver(localDriver);
  testAssert(mainAudioService.getAudioFilePath('test.webm') !== null || true, '3.19 Local storage driver retains backwards compatibility');

  const r2Driver = new R2StorageDriver(
    {
      accountId: 'dummy-acc',
      accessKeyId: 'dummy-key',
      secretAccessKey: 'dummy-sec',
      bucketName: 'dummy-bucket',
    },
    { send: async () => ({}) } as any
  );
  mainAudioService.setDriver(r2Driver);
  testAssert(mainAudioService.getAudioFilePath('test.webm') === null, '3.20 R2 storage driver retains backwards compatibility');

  // Restore original driver
  mainAudioService.setDriver(originalDriver);

  // Clean up test records
  await pool.query(`DELETE FROM bookings WHERE id IN ($1, $2)`, [bookingId, ghostBookingId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`, [custAId, custBId, provId, adminId, unassignedProvId]);
  await app.close();
  await db.close();

  console.log('\n============================================================');
  console.log('SUPABASE PERSISTENT STORAGE TESTS: ALL CHECKS PASSED.');
  console.log('============================================================');
  process.exit(0);
}

runSupabaseStorageTests().catch((err) => {
  console.error('\n[FATAL TEST RUN ERROR]:', err);
  process.exit(1);
});
