/**
 * CHANDIL HOME SERVICES - CLIENT API ROUTING & ISOLATION TEST SUITE
 *
 * Verifies that:
 * 1. Native Android staging builds route explicitly to the staging backend URL.
 * 2. Native Android builds never silently fall back to the production API URL.
 * 3. Release builds with missing configuration fail fast with a descriptive error.
 * 4. Local development mode falls back to 127.0.0.1:3000 for ADB reverse proxying.
 * 5. Web builds maintain empty API_BASE_URL and relative /api/... routing.
 * 6. TypeScript (.ts) and JavaScript (.js) implementations maintain 100% parity.
 */

import {
  resolveNativeApiBaseUrl as resolveNativeTs,
  getApiUrl as getApiUrlTs
} from '../../client/src/config/api.ts';

// @ts-ignore - dynamic import of companion JS implementation
import {
  resolveNativeApiBaseUrl as resolveNativeJs,
  getApiUrl as getApiUrlJs
} from '../../client/src/config/api.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    failedTests++;
  }
}

const STAGING_URL = 'https://chandil-home-services-staging.onrender.com';
const PRODUCTION_URL = 'https://chandilhomeservices.devs.surf';
const LOCAL_DEV_URL = 'http://127.0.0.1:3000';
const SENTINEL_UNCONFIGURED = 'UNCONFIGURED_NATIVE_API_BASE_URL';

async function runTests() {
  console.log('\n============================================================');
  console.log('CLIENT API ROUTING & ENVIRONMENT ISOLATION TEST SUITE');
  console.log('============================================================\n');

  const implementations = [
    { name: 'TypeScript implementation (api.ts)', resolve: resolveNativeTs, getUrl: getApiUrlTs },
    { name: 'JavaScript implementation (api.js)', resolve: resolveNativeJs, getUrl: getApiUrlJs }
  ];

  for (const impl of implementations) {
    console.log(`\n--- Testing ${impl.name} ---\n`);

    // 1. STAGING NATIVE BUILD
    console.log('1. Staging native build configuration...');
    const stagingBase = impl.resolve({
      VITE_API_BASE_URL: STAGING_URL,
      PROD: true
    });
    assert(stagingBase === STAGING_URL, `${impl.name}: Resolves explicit staging URL`);
    assert(stagingBase !== PRODUCTION_URL, `${impl.name}: Staging DOES NOT equal production URL`);

    const stagingWithSlash = impl.resolve({
      VITE_API_BASE_URL: `${STAGING_URL}/`,
      PROD: true
    });
    assert(stagingWithSlash === STAGING_URL, `${impl.name}: Strips trailing slash from staging URL`);

    const stagingEndpoint = impl.getUrl('/api/bookings', stagingBase);
    assert(
      stagingEndpoint === `${STAGING_URL}/api/bookings`,
      `${impl.name}: Correctly resolves staging API endpoint`
    );

    // 2. PRODUCTION NATIVE BUILD
    console.log('2. Production native build configuration...');
    const prodBase = impl.resolve({
      VITE_API_BASE_URL: PRODUCTION_URL,
      PROD: true
    });
    assert(prodBase === PRODUCTION_URL, `${impl.name}: Resolves explicit production URL`);

    const prodEndpoint = impl.getUrl('/api/bookings', prodBase);
    assert(
      prodEndpoint === `${PRODUCTION_URL}/api/bookings`,
      `${impl.name}: Correctly resolves production API endpoint`
    );

    // 3. UNCONFIGURED NATIVE RELEASE BUILD (CRITICAL RELEASE GATE)
    console.log('3. Unconfigured release build safety checks...');
    const unconfiguredReleaseBase = impl.resolve({
      PROD: true
    });
    assert(
      unconfiguredReleaseBase === SENTINEL_UNCONFIGURED,
      `${impl.name}: Missing VITE_API_BASE_URL in release mode returns unconfigured sentinel`
    );
    assert(
      unconfiguredReleaseBase !== PRODUCTION_URL,
      `${impl.name}: Unconfigured release build NEVER falls back to production`
    );
    assert(
      unconfiguredReleaseBase !== LOCAL_DEV_URL,
      `${impl.name}: Unconfigured release build NEVER falls back to localhost`
    );

    let threwAsExpected = false;
    let thrownMessage = '';
    try {
      impl.getUrl('/api/bookings', unconfiguredReleaseBase);
    } catch (err: any) {
      threwAsExpected = true;
      thrownMessage = err.message || '';
    }
    assert(
      threwAsExpected && thrownMessage.includes('unconfigured'),
      `${impl.name}: getApiUrl throws descriptive error when unconfigured in native release build`
    );

    // Also verify empty string VITE_API_BASE_URL fails safely in release mode
    const emptyStringReleaseBase = impl.resolve({
      VITE_API_BASE_URL: '   ',
      PROD: true
    });
    assert(
      emptyStringReleaseBase === SENTINEL_UNCONFIGURED,
      `${impl.name}: Whitespace-only VITE_API_BASE_URL in release mode returns unconfigured sentinel`
    );

    // 4. LOCAL DEVELOPMENT NATIVE BUILD
    console.log('4. Local development native fallback...');
    const localDevBase = impl.resolve({
      DEV: true,
      PROD: false
    });
    assert(
      localDevBase === LOCAL_DEV_URL,
      `${impl.name}: Missing VITE_API_BASE_URL in development mode falls back to localhost:3000`
    );
    const localDevEndpoint = impl.getUrl('/api/categories', localDevBase);
    assert(
      localDevEndpoint === `${LOCAL_DEV_URL}/api/categories`,
      `${impl.name}: Resolves local development API endpoint`
    );

    // 5. WEB / BROWSER RUNTIME ISOLATION
    console.log('5. Web / browser runtime isolation...');
    const webBase = ''; // On web, Capacitor.isNativePlatform() is false, base is ''
    const webEndpoint = impl.getUrl('/api/categories', webBase);
    assert(
      webEndpoint === '/api/categories',
      `${impl.name}: Web endpoint uses relative path /api/categories`
    );

    const webEndpointWithoutLeadingSlash = impl.getUrl('api/categories', webBase);
    assert(
      webEndpointWithoutLeadingSlash === '/api/categories',
      `${impl.name}: Prepends leading slash to relative paths`
    );

    assert(
      !webEndpoint.includes(PRODUCTION_URL) && !webEndpoint.includes(STAGING_URL),
      `${impl.name}: Web endpoint never contains hardcoded domain names`
    );

    // 6. ABSOLUTE URL PRESERVATION
    console.log('6. Absolute URL preservation...');
    const externalUrl = 'https://other-service.example.com/api/v1/resource';
    const preservedUrl = impl.getUrl(externalUrl, stagingBase);
    assert(
      preservedUrl === externalUrl,
      `${impl.name}: External absolute URLs remain unchanged without prefixing`
    );
  }

  // 7. SUMMARY
  console.log('\n============================================================');
  console.log(`API ROUTING TESTS COMPLETED: ${passedTests} passed, ${failedTests} failed.`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running API routing test suite:', err);
  process.exit(1);
});
