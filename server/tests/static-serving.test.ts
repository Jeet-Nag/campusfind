import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp, resolveClientDistPath } from '../src/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('MODULE 15 STEP 1 — STATIC SERVING & SPA FALLBACK TEST SUITE');
  console.log('============================================================\n');

  const clientDistPath = resolveClientDistPath();
  console.log(`Resolved client dist path: ${clientDistPath}`);
  assert(fs.existsSync(clientDistPath), 'Client dist directory exists on disk');

  const indexPath = path.join(clientDistPath, 'index.html');
  assert(fs.existsSync(indexPath), 'Client dist/index.html exists on disk');

  const assetsDir = path.join(clientDistPath, 'assets');
  assert(fs.existsSync(assetsDir), 'Client dist/assets directory exists on disk');

  const assetFiles = fs.readdirSync(assetsDir);
  const jsAsset = assetFiles.find((f) => f.endsWith('.js'));
  const cssAsset = assetFiles.find((f) => f.endsWith('.css'));
  assert(Boolean(jsAsset), `Found JS asset bundle: ${jsAsset}`);
  assert(Boolean(cssAsset), `Found CSS asset bundle: ${cssAsset}`);

  const app = await buildApp({
    customEnv: {
      NODE_ENV: 'test',
    },
  });

  // 1. GET /
  console.log('\n--- SCENARIO 1: Root Route (GET /) ---');
  const rootRes = await app.inject({
    method: 'GET',
    url: '/',
  });
  assert(rootRes.statusCode === 200, '1.1 GET / returns status 200');
  assert(
    rootRes.headers['content-type']?.includes('text/html') === true,
    '1.2 GET / returns Content-Type text/html'
  );
  assert(
    rootRes.payload.includes('<div id="app"></div>') && (rootRes.payload.includes('CampusFind') || rootRes.payload.includes('Chandil Home Services')),
    '1.3 GET / returns client index.html document'
  );
  assert(
    rootRes.headers['cache-control']?.includes('no-cache') === true,
    '1.4 GET / includes non-aggressive Cache-Control header'
  );

  // 2. GET /admin
  console.log('\n--- SCENARIO 2: SPA Admin Route (GET /admin) ---');
  const adminRes = await app.inject({
    method: 'GET',
    url: '/admin',
  });
  assert(adminRes.statusCode === 200, '2.1 GET /admin returns status 200');
  assert(
    adminRes.headers['content-type']?.includes('text/html') === true,
    '2.2 GET /admin returns Content-Type text/html'
  );
  assert(
    adminRes.payload.includes('<div id="admin-app"></div>') && adminRes.payload.includes('Chandil Home Services'),
    '2.3 GET /admin returns dedicated admin.html document'
  );
  assert(
    adminRes.headers['cache-control']?.includes('no-cache') === true,
    '2.4 GET /admin includes non-aggressive Cache-Control header'
  );

  // 3. GET additional frontend routes
  console.log('\n--- SCENARIO 3: Additional Frontend Routes ---');
  const bookingRouteRes = await app.inject({
    method: 'GET',
    url: '/bookings/active',
  });
  assert(bookingRouteRes.statusCode === 200, '3.1 GET /bookings/active returns status 200');
  assert(
    bookingRouteRes.headers['content-type']?.includes('text/html') === true,
    '3.2 GET /bookings/active returns Content-Type text/html'
  );
  assert(
    bookingRouteRes.payload.includes('<div id="app"></div>'),
    '3.3 GET /bookings/active returns SPA index.html'
  );

  const loginRouteRes = await app.inject({
    method: 'GET',
    url: '/login',
  });
  assert(loginRouteRes.statusCode === 200, '3.4 GET /login returns status 200');
  assert(
    loginRouteRes.payload.includes('<div id="app"></div>'),
    '3.5 GET /login returns SPA index.html'
  );

  // 4. GET /api/ping
  console.log('\n--- SCENARIO 4: Existing API Route (GET /api/ping) ---');
  const pingRes = await app.inject({
    method: 'GET',
    url: '/api/ping',
  });
  assert(pingRes.statusCode === 200, '4.1 GET /api/ping returns status 200');
  assert(
    pingRes.headers['content-type']?.includes('application/json') === true,
    '4.2 GET /api/ping returns JSON content-type'
  );
  const pingBody = JSON.parse(pingRes.payload);
  assert(pingBody.success === true, '4.3 GET /api/ping success is true');
  assert(
    pingBody.data?.message?.includes('Chandil Home Services API Foundation is operational.') === true,
    '4.4 GET /api/ping returns expected existing message'
  );

  // 5. GET /api/does-not-exist
  console.log('\n--- SCENARIO 5: Strict API Exclusion (GET /api/does-not-exist) ---');
  const unknownApiRes = await app.inject({
    method: 'GET',
    url: '/api/does-not-exist',
  });
  assert(unknownApiRes.statusCode === 404, '5.1 GET /api/does-not-exist returns status 404');
  assert(
    unknownApiRes.headers['content-type']?.includes('application/json') === true,
    '5.2 GET /api/does-not-exist returns JSON content-type (NOT HTML)'
  );
  assert(!unknownApiRes.payload.includes('<!DOCTYPE html>'), '5.3 GET /api/does-not-exist does NOT return HTML document');
  const unknownApiBody = JSON.parse(unknownApiRes.payload);
  assert(unknownApiBody.success === false, '5.4 Response success is false');
  assert(unknownApiBody.error?.code === 'NOT_FOUND', '5.5 Response code is NOT_FOUND');

  // 6. GET /health
  console.log('\n--- SCENARIO 6: Health Endpoint (GET /health) ---');
  const healthRes = await app.inject({
    method: 'GET',
    url: '/health',
  });
  assert(healthRes.statusCode === 200, '6.1 GET /health returns status 200');
  assert(
    healthRes.headers['content-type']?.includes('application/json') === true,
    '6.2 GET /health returns JSON content-type'
  );
  const healthBody = JSON.parse(healthRes.payload);
  assert(healthBody.status === 'ok', '6.3 Health body status is ok');
  assert(healthBody.service === 'chandil-home-services-api', '6.4 Health body service name is correct');
  assert(healthBody.database !== undefined, '6.5 Health body includes database status');

  // 7. GET existing static assets
  console.log('\n--- SCENARIO 7: Existing Static Assets ---');
  if (jsAsset) {
    const jsRes = await app.inject({
      method: 'GET',
      url: `/assets/${jsAsset}`,
    });
    assert(jsRes.statusCode === 200, `7.1 GET /assets/${jsAsset} returns status 200`);
    assert(
      jsRes.headers['content-type']?.includes('javascript') === true,
      `7.2 GET /assets/${jsAsset} returns javascript Content-Type`
    );
    assert(
      jsRes.headers['cache-control']?.includes('immutable') === true,
      `7.3 GET /assets/${jsAsset} includes long-term immutable Cache-Control`
    );
  }

  if (cssAsset) {
    const cssRes = await app.inject({
      method: 'GET',
      url: `/assets/${cssAsset}`,
    });
    assert(cssRes.statusCode === 200, `7.4 GET /assets/${cssAsset} returns status 200`);
    assert(
      cssRes.headers['content-type']?.includes('text/css') === true,
      `7.5 GET /assets/${cssAsset} returns text/css Content-Type`
    );
    assert(
      cssRes.headers['cache-control']?.includes('immutable') === true,
      `7.6 GET /assets/${cssAsset} includes long-term immutable Cache-Control`
    );
  }

  // 8. GET missing static asset
  console.log('\n--- SCENARIO 8: Missing Static Asset Strict 404 ---');
  const missingAssetRes = await app.inject({
    method: 'GET',
    url: '/assets/non-existent-bundle.js',
  });
  assert(missingAssetRes.statusCode === 404, '8.1 GET /assets/non-existent-bundle.js returns status 404');
  assert(
    missingAssetRes.headers['content-type']?.includes('text/html') === false,
    '8.2 Missing asset response is NOT HTML'
  );
  assert(!missingAssetRes.payload.includes('<div id="app"></div>'), '8.3 Missing asset does NOT fall back to index.html');

  // 9. GET /api/audio/<filename> preserves authentication & authorization
  console.log('\n--- SCENARIO 9: Audio Authorization & Security Preservation ---');
  const unauthAudioRes = await app.inject({
    method: 'GET',
    url: '/api/audio/sample-recording.webm',
  });
  assert(
    unauthAudioRes.statusCode === 401,
    '9.1 Unauthenticated GET /api/audio/... returns status 401 Unauthorized'
  );
  assert(
    unauthAudioRes.headers['content-type']?.includes('application/json') === true,
    '9.2 Audio unauthenticated response is JSON (NOT HTML fallback)'
  );
  const unauthAudioBody = JSON.parse(unauthAudioRes.payload);
  assert(unauthAudioBody.success === false, '9.3 Audio error success is false');
  assert(unauthAudioBody.error?.code === 'UNAUTHORIZED', '9.4 Audio error code is UNAUTHORIZED');

  // 10. SPA fallback does not interfere with protected API routes
  console.log('\n--- SCENARIO 10: Authentication-Protected API Routes Preserved ---');
  const unauthBookingsRes = await app.inject({
    method: 'GET',
    url: '/api/bookings',
  });
  assert(
    unauthBookingsRes.statusCode === 401,
    '10.1 Unauthenticated GET /api/bookings returns 401 (NOT 200 HTML)'
  );
  const bookingsBody = JSON.parse(unauthBookingsRes.payload);
  assert(bookingsBody.error?.code === 'UNAUTHORIZED', '10.2 Error code is UNAUTHORIZED');

  const unauthProviderRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
  });
  assert(
    unauthProviderRes.statusCode === 401,
    '10.3 Unauthenticated GET /api/provider/jobs returns 401 (NOT 200 HTML)'
  );

  const unauthAdminRes = await app.inject({
    method: 'GET',
    url: '/api/admin/bookings',
  });
  assert(
    unauthAdminRes.statusCode === 401,
    '10.4 Unauthenticated GET /api/admin/bookings returns 401 (NOT 200 HTML)'
  );

  // 11. Additional Edge Cases
  console.log('\n--- SCENARIO 11: Non-GET methods and Missing File Extensions ---');
  const postAdminRes = await app.inject({
    method: 'POST',
    url: '/admin',
    payload: { action: 'test' },
  });
  assert(postAdminRes.statusCode === 404, '11.1 POST /admin returns 404 (SPA fallback only applies to GET/HEAD)');
  assert(!postAdminRes.payload.includes('<!DOCTYPE html>'), '11.2 POST /admin does NOT return HTML document');

  const missingImageRes = await app.inject({
    method: 'GET',
    url: '/missing-image.png',
  });
  assert(missingImageRes.statusCode === 404, '11.3 Missing file with extension returns 404');
  assert(!missingImageRes.payload.includes('<!DOCTYPE html>'), '11.4 Missing file does NOT return HTML document');

  // 12. Digital Asset Links (.well-known/assetlinks.json)
  console.log('\n--- SCENARIO 12: Digital Asset Links (.well-known/assetlinks.json) ---');
  const assetLinksRes = await app.inject({
    method: 'GET',
    url: '/.well-known/assetlinks.json',
  });
  assert(assetLinksRes.statusCode === 200, '12.1 GET /.well-known/assetlinks.json returns status 200');
  assert(
    assetLinksRes.payload.includes('in.chandilservices.app'),
    '12.2 assetlinks.json contains package in.chandilservices.app'
  );
  assert(
    assetLinksRes.payload.includes('42:FA:86:31:DF:58:EB:67:ED:F6:AA:74:58:C2:EF:F1:54:5D:0D:66:24:B7:5D:05:75:3D:E0:E1:77:20:91:0F'),
    '12.3 assetlinks.json contains debug SHA-256 fingerprint'
  );

  console.log('\n============================================================');
  console.log(`TOTAL STATIC SERVING TESTS: ${passedTests} PASS, ${failedTests} FAIL`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
