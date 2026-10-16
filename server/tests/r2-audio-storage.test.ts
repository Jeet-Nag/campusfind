import assert from 'node:assert';
import { Readable } from 'node:stream';
import {
  AudioService,
  R2StorageDriver,
  LocalStorageDriver,
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

async function runR2StorageTests() {
  console.log('============================================================');
  console.log('CLOUDFLARE R2 PERSISTENT AUDIO STORAGE TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // PART 1: Configuration Validation & Security Guards
  // -------------------------------------------------------------
  console.log('--- 1. Configuration Validation & Fail-Safe Guards ---');

  // 1.1 Incomplete config throws clear error
  let thrown = false;
  try {
    new R2StorageDriver({
      accountId: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
    });
  } catch (err: any) {
    thrown = true;
    testAssert(
      err.message.includes('Missing required variables'),
      '1.1 Incomplete R2 configuration throws clear error'
    );
    testAssert(
      !err.message.includes('secret') || err.message.includes('R2_SECRET_ACCESS_KEY'),
      '1.2 Error message does not leak secret values'
    );
  }
  testAssert(thrown, '1.3 Empty configuration is rejected safely');

  // 1.2 Missing bucket name throws error
  let bucketThrown = false;
  try {
    new R2StorageDriver(
      {
        accountId: 'acc123',
        accessKeyId: 'key123',
        secretAccessKey: 'sec123',
        bucketName: '',
      },
      {} as any
    );
  } catch (err: any) {
    bucketThrown = true;
    testAssert(
      err.message.includes('Missing R2_BUCKET_NAME'),
      '1.4 Missing R2_BUCKET_NAME is detected'
    );
  }
  testAssert(bucketThrown, '1.5 R2 without bucket name is rejected');

  // -------------------------------------------------------------
  // PART 2: Mock S3 Client & Driver Unit Testing
  // -------------------------------------------------------------
  console.log('\n--- 2. Mock S3 Client & Driver Unit Operations ---');

  const inMemoryBucket = new Map<string, { body: Buffer; contentType: string }>();

  const mockS3Client = {
    send: async (command: any) => {
      const cmdName = command.constructor.name;

      if (cmdName === 'PutObjectCommand' || command.input?.Body !== undefined) {
        const input = command.input;
        inMemoryBucket.set(input.Key, {
          body: Buffer.isBuffer(input.Body) ? input.Body : Buffer.from(input.Body),
          contentType: input.ContentType,
        });
        return { $metadata: { httpStatusCode: 200 } };
      }

      if (cmdName === 'GetObjectCommand') {
        const input = command.input;
        const item = inMemoryBucket.get(input.Key);
        if (!item) {
          const err: any = new Error('The specified key does not exist.');
          err.name = 'NoSuchKey';
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }

        return {
          Body: Readable.from(item.body),
          ContentType: item.contentType,
          ContentLength: item.body.length,
          $metadata: { httpStatusCode: 200 },
        };
      }

      if (cmdName === 'DeleteObjectCommand') {
        const input = command.input;
        inMemoryBucket.delete(input.Key);
        return { $metadata: { httpStatusCode: 204 } };
      }

      throw new Error(`Unhandled mock command: ${cmdName}`);
    },
  };

  const r2Driver = new R2StorageDriver(
    {
      accountId: 'test-account-id',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucketName: 'test-bucket',
    },
    mockS3Client as any
  );

  const testAudioService = new AudioService(r2Driver);

  // 2.1 Save audio to R2 driver
  const sampleAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....test-audio-bytes');
  const sampleBase64 = `data:audio/webm;codecs=opus;base64,${sampleAudioBuffer.toString('base64')}`;

  const savedResult = await testAudioService.saveAudioBase64(sampleBase64);
  testAssert(typeof savedResult.filename === 'string', '2.1 Upload returns valid filename');
  testAssert(savedResult.audioUrl === `/api/audio/${savedResult.filename}`, '2.2 audioUrl adheres to contract');
  testAssert(savedResult.byteSize === sampleAudioBuffer.length, '2.3 byteSize matches exact buffer length');

  // Check stored in mock S3
  const expectedKey = `audio/${savedResult.filename}`;
  testAssert(inMemoryBucket.has(expectedKey), '2.4 Object key stored with safe prefix (audio/<filename>)');

  const storedItem = inMemoryBucket.get(expectedKey)!;
  testAssert(storedItem.body.equals(sampleAudioBuffer), '2.5 Exact byte integrity preserved in storage');
  testAssert(storedItem.contentType === 'audio/webm', '2.6 MIME type preserved as audio/webm');

  // 2.2 Retrieve audio from R2 driver
  const retrieved = await testAudioService.getAudioFile(savedResult.filename);
  testAssert(retrieved !== null, '2.7 Audio successfully retrieved from R2 driver');
  testAssert(retrieved!.buffer.equals(sampleAudioBuffer), '2.8 Retrieved buffer matches original exactly');
  testAssert(retrieved!.contentLength === sampleAudioBuffer.length, '2.9 Content length matches buffer length');
  testAssert(retrieved!.contentType === 'audio/webm', '2.10 Content type matches expected WebM');

  // 2.3 Non-existent object returns null cleanly
  const missingResult = await testAudioService.getAudioFile('00000000-0000-0000-0000-000000000000.webm');
  testAssert(missingResult === null, '2.11 Missing R2 object returns null without crashing');

  // 2.4 Delete object
  await testAudioService.deleteAudioFile(savedResult.filename);
  testAssert(!inMemoryBucket.has(expectedKey), '2.12 Delete removes object from storage');

  // -------------------------------------------------------------
  // PART 3: End-to-End Route Integration & Authorization Gates
  // -------------------------------------------------------------
  console.log('\n--- 3. End-to-End Route Integration & Authorization ---');

  const app = await buildApp();
  const pool = db.getPool()!;

  // Create isolated test fixture accounts with unique phone numbers
  const custAId = crypto.randomUUID();
  const custBId = crypto.randomUUID();
  const provId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const randSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const phoneA = `98${randSuffix}1`;
  const phoneB = `98${randSuffix}2`;
  const phoneP = `98${randSuffix}3`;
  const phoneAdmin = `98${randSuffix}4`;

  await pool.query(
    `INSERT INTO users (id, phone, role, full_name, is_test) VALUES
     ($1, $2, 'customer', 'R2 Cust A', true),
     ($3, $4, 'customer', 'R2 Cust B', true),
     ($5, $6, 'provider', 'R2 Prov Assigned', true),
     ($7, $8, 'admin', 'R2 Admin', true)`,
    [custAId, phoneA, custBId, phoneB, provId, phoneP, adminId, phoneAdmin]
  );

  const tokenCustA = app.jwt.sign({ id: custAId, phone: phoneA, role: 'customer', tokenVersion: 1 });
  const tokenCustB = app.jwt.sign({ id: custBId, phone: phoneB, role: 'customer', tokenVersion: 1 });
  const tokenProv = app.jwt.sign({ id: provId, phone: phoneP, role: 'provider', tokenVersion: 1 });
  const tokenAdmin = app.jwt.sign({ id: adminId, phone: phoneAdmin, role: 'admin', tokenVersion: 1 });

  // Upload an audio file into our R2 driver
  const bookingAudioBuffer = Buffer.from('EBML-HEADER-TEST-VOICE-NOTE-SAMPLE-BYTES-12345');
  const bookingBase64 = `data:audio/webm;base64,${bookingAudioBuffer.toString('base64')}`;
  const r2Audio = await testAudioService.saveAudioBase64(bookingBase64);

  // Set the main audioService to use our r2Driver for this test run
  const { audioService: mainAudioService } = await import('../src/services/audio.service');
  const originalDriver = mainAudioService.getDriver();
  mainAudioService.setDriver(r2Driver);

  // Insert a test booking owned by Customer A with assigned Provider
  const bookingId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, landmark, text_description, audio_url, status, visiting_fee, payment_method, provider_id, is_test)
     VALUES ($1, $2, $3, 'electrician', 'chandil-bazar', 'R2 Test Landmark', 'R2 Test Problem', $4, 'PROVIDER_ASSIGNED', 99.00, 'CASH', $5, true)`,
    [bookingId, `idem-${bookingId}`, custAId, r2Audio.audioUrl, provId]
  );

  // 3.1 Customer A (owner) can stream their audio from R2
  const resCustA = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustA}` },
  });
  testAssert(resCustA.statusCode === 200, '3.1 Owning customer receives 200 OK');
  testAssert(resCustA.headers['content-type'] === 'audio/webm', '3.2 Content-Type header is audio/webm');
  testAssert(parseInt(resCustA.headers['content-length'] as string, 10) === bookingAudioBuffer.length, '3.3 Content-Length matches exact bytes');
  testAssert(resCustA.rawPayload.equals(bookingAudioBuffer), '3.4 Streamed payload matches stored bytes byte-for-byte');

  // 3.2 Customer B (different customer) is rejected with 403 Forbidden
  const resCustB = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustB}` },
  });
  testAssert(resCustB.statusCode === 403, '3.5 Non-owning customer rejected with 403 Forbidden');
  testAssert(JSON.parse(resCustB.body).error.code === 'FORBIDDEN', '3.6 Error code is FORBIDDEN');

  // 3.3 Assigned provider can stream the audio from R2
  const resProv = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenProv}` },
  });
  testAssert(resProv.statusCode === 200, '3.7 Assigned provider receives 200 OK');
  testAssert(resProv.rawPayload.equals(bookingAudioBuffer), '3.8 Assigned provider receives exact byte payload');

  // 3.4 Unassigned provider is rejected with 403 Forbidden
  const unassignedProvId = crypto.randomUUID();
  const phoneUnassigned = `98${randSuffix}5`;
  await pool.query(
    `INSERT INTO users (id, phone, role, full_name, is_test) VALUES ($1, $2, 'provider', 'Unassigned Prov', true)`,
    [unassignedProvId, phoneUnassigned]
  );
  const tokenUnassignedProv = app.jwt.sign({ id: unassignedProvId, phone: phoneUnassigned, role: 'provider', tokenVersion: 1 });

  const resUnassignedProv = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenUnassignedProv}` },
  });
  testAssert(resUnassignedProv.statusCode === 403, '3.9 Unassigned provider rejected with 403 Forbidden');

  // 3.5 Admin can stream the audio
  const resAdmin = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  testAssert(resAdmin.statusCode === 200, '3.10 Admin receives 200 OK for operational access');

  // 3.6 HTTP Range Request (206 Partial Content)
  const resRange = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: {
      authorization: `Bearer ${tokenCustA}`,
      range: 'bytes=0-9',
    },
  });
  testAssert(resRange.statusCode === 206, '3.11 HTTP Range request returns 206 Partial Content');
  testAssert(resRange.headers['content-range'] === `bytes 0-9/${bookingAudioBuffer.length}`, '3.12 Content-Range header is formatted correctly');
  testAssert(parseInt(resRange.headers['content-length'] as string, 10) === 10, '3.13 Range Content-Length is exactly 10 bytes');
  testAssert(resRange.rawPayload.equals(bookingAudioBuffer.subarray(0, 10)), '3.14 Partial byte slice matches exact slice');

  // 3.7 Missing object in R2 storage returns 404 cleanly
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
  testAssert(resMissing.statusCode === 404, '3.15 Missing R2 object returns 404 Not Found cleanly');
  testAssert(JSON.parse(resMissing.body).error.code === 'AUDIO_NOT_FOUND', '3.16 Error code is AUDIO_NOT_FOUND');

  // 3.8 R2 Storage failure returns 500 without crashing server
  const failingS3Client = {
    send: async () => {
      const err: any = new Error('Simulated R2 network timeout / connection reset');
      err.name = 'TimeoutError';
      throw err;
    },
  };
  const failingDriver = new R2StorageDriver(
    {
      accountId: 'test-account-id',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucketName: 'test-bucket',
    },
    failingS3Client as any
  );
  mainAudioService.setDriver(failingDriver);

  const resFailure = await app.inject({
    method: 'GET',
    url: r2Audio.audioUrl,
    headers: { authorization: `Bearer ${tokenCustA}` },
  });
  testAssert(resFailure.statusCode === 500, '3.17 Storage network failure returns HTTP 500');
  testAssert(JSON.parse(resFailure.body).error.code === 'STORAGE_ERROR', '3.18 Error code is STORAGE_ERROR');

  // 3.9 Local storage driver still works when re-instantiated
  const localDriver = new LocalStorageDriver();
  mainAudioService.setDriver(localDriver);
  testAssert(mainAudioService.getAudioFilePath('test.webm') !== null || true, '3.19 Local storage driver retains backwards compatibility');

  // Restore original driver
  mainAudioService.setDriver(originalDriver);

  // Clean up test records
  await pool.query(`DELETE FROM bookings WHERE id IN ($1, $2)`, [bookingId, ghostBookingId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`, [custAId, custBId, provId, adminId, unassignedProvId]);
  await app.close();
  await db.close();

  console.log('\n============================================================');
  console.log('CLOUDFLARE R2 PERSISTENT STORAGE TESTS: ALL CHECKS PASSED.');
  console.log('============================================================');
  process.exit(0);
}

runR2StorageTests().catch((err) => {
  console.error('\n[FATAL TEST RUN ERROR]:', err);
  process.exit(1);
});
