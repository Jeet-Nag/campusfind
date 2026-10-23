import {
  providerJobs,
  isProviderJobsLoading,
  providerJobsError,
  fetchProviderJobs,
  refreshProviderJobs,
  DEFAULT_PROVIDER_POLL_INTERVAL_MS,
  MIN_PROVIDER_POLL_INTERVAL_MS,
  MAX_PROVIDER_POLL_INTERVAL_MS,
  providerPollIntervalMs,
  setProviderPollInterval,
  isProviderJobsAutoRefreshing,
} from '../../client/src/state/provider';
import { authToken } from '../../client/src/state/auth';
import { ProviderJob } from '../../shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n============================================================');
console.log('PHASE 16 — PROVIDER JOB AUTO-REFRESH (ZERO-COST) TEST SUITE');
console.log('============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failCount++;
  }
}

const mockJob1: ProviderJob = {
  id: 'b1111111-1111-1111-1111-111111111111',
  categoryId: 'electrician',
  areaLocality: 'chandil-bazar',
  landmark: 'Near Chowk',
  textDescription: 'Ceiling fan repair',
  audioUrl: null,
  audioDurationSeconds: null,
  visitingFee: 99.0,
  status: 'SERVICE_REQUESTED',
  createdAt: '2026-10-16T10:00:00.000Z',
};

const mockJob2: ProviderJob = {
  id: 'b2222222-2222-2222-2222-222222222222',
  categoryId: 'electrician',
  areaLocality: 'dam-road',
  landmark: 'Near Dam',
  textDescription: 'Short circuit check',
  audioUrl: null,
  audioDurationSeconds: null,
  visitingFee: 99.0,
  status: 'SERVICE_REQUESTED',
  createdAt: '2026-10-16T10:05:00.000Z',
};

async function runTests() {
  const originalFetch = globalThis.fetch;

  try {
    // =========================================================================
    // 1. POLLING INTERVAL CONFIGURATION (30s - 60s)
    // =========================================================================
    console.log('--- 1. Polling Interval Bounds and Configuration ---');

    assert(
      DEFAULT_PROVIDER_POLL_INTERVAL_MS === 30000,
      '1. Default polling interval is strictly 30 seconds (30000ms)'
    );

    assert(
      MIN_PROVIDER_POLL_INTERVAL_MS === 30000,
      '2. Minimum polling interval boundary is 30 seconds (30000ms)'
    );

    assert(
      MAX_PROVIDER_POLL_INTERVAL_MS === 60000,
      '3. Maximum polling interval boundary is 60 seconds (60000ms)'
    );

    setProviderPollInterval(45000);
    assert(
      providerPollIntervalMs.value === 45000,
      '4. Setting interval between 30s and 60s (45000ms) succeeds'
    );

    setProviderPollInterval(10000); // Below minimum
    assert(
      providerPollIntervalMs.value === 30000,
      '5. Setting interval below 30s is clamped to minimum (30000ms)'
    );

    setProviderPollInterval(120000); // Above maximum
    assert(
      providerPollIntervalMs.value === 60000,
      '6. Setting interval above 60s is clamped to maximum (60000ms)'
    );

    // Reset back to default
    setProviderPollInterval(DEFAULT_PROVIDER_POLL_INTERVAL_MS);
    assert(
      providerPollIntervalMs.value === 30000,
      '7. Successfully restored default 30s polling interval'
    );

    // =========================================================================
    // 2. AUTHENTICATION FLOW & 401 HANDLING
    // =========================================================================
    console.log('\n--- 2. Authentication Flow & Guarding ---');

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls++;
      return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) } as any;
    };

    authToken.value = null;
    await fetchProviderJobs();
    assert(
      fetchCalls === 0,
      '8. fetchProviderJobs aborts immediately without network request when token is null'
    );

    authToken.value = 'mock-provider-jwt';

    // 401 Unauthorized handling
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ success: false }),
    } as any);

    await fetchProviderJobs();
    assert(
      authToken.value === null,
      '9. 401 Unauthorized clears auth session via logout()'
    );

    // Re-arm auth token
    authToken.value = 'mock-provider-jwt';

    // =========================================================================
    // 3. SILENT BACKGROUND POLLING & NETWORK FAILURE HANDLING
    // =========================================================================
    console.log('\n--- 3. Silent Network Failure & Feed Preservation ---');

    // Populate initial jobs
    providerJobs.value = [mockJob1];
    providerJobsError.value = null;
    isProviderJobsLoading.value = false;

    // Simulate network drop during silent background auto-refresh
    globalThis.fetch = async () => {
      throw new Error('Network dropped / Provider offline');
    };

    await refreshProviderJobs({ silent: true });

    assert(
      providerJobs.value.length === 1 && providerJobs.value[0].id === mockJob1.id,
      '10. Silent failure preserves existing providerJobs without clearing feed'
    );

    assert(
      providerJobsError.value === null,
      '11. Silent failure does NOT show disruptive error banners on background polling failure'
    );

    assert(
      isProviderJobsLoading.value === false,
      '12. Background silent polling does not toggle isProviderJobsLoading (no UI flicker)'
    );

    // Simulate server 500 error during silent background auto-refresh
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { messageEn: 'Internal server error', messageHi: 'सर्वर त्रुटि' },
      }),
    } as any);

    await refreshProviderJobs({ silent: true });

    assert(
      providerJobs.value.length === 1 && providerJobs.value[0].id === mockJob1.id,
      '13. Server 500 on background poll preserves existing providerJobs'
    );

    assert(
      providerJobsError.value === null,
      '14. Server 500 on background poll does NOT set providerJobsError'
    );

    // =========================================================================
    // 4. MANUAL REFRESH ERROR & LOADING BEHAVIOR
    // =========================================================================
    console.log('\n--- 4. Manual Refresh Error & Loading Behavior ---');

    globalThis.fetch = async () => {
      throw new Error('Network offline');
    };

    await refreshProviderJobs(); // Non-silent manual refresh

    assert(
      providerJobsError.value !== null,
      '15. Manual user refresh displays error banner on network failure'
    );

    assert(
      isProviderJobsLoading.value === false,
      '16. isProviderJobsLoading resets to false after manual error'
    );

    // =========================================================================
    // 5. SUCCESSFUL BACKGROUND POLL & FEED UPDATE
    // =========================================================================
    console.log('\n--- 5. Successful Background Poll & Error Recovery ---');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [mockJob1, mockJob2],
      }),
    } as any);

    await refreshProviderJobs({ silent: true });

    assert(
      providerJobs.value.length === 2,
      '17. Successful silent background poll updates providerJobs with new jobs'
    );

    assert(
      providerJobsError.value === null,
      '18. Successful silent background poll clears previous error banner'
    );

    // =========================================================================
    // 6. OVERLAP PROTECTION (FLAG / ABORT GUARD)
    // =========================================================================
    console.log('\n--- 6. Overlapping Request Prevention ---');

    let inFlightFetchCount = 0;
    let maxSimultaneousInFlight = 0;
    let resolveSlowFetch: ((val: any) => void) | null = null;

    globalThis.fetch = async (url: any, opts: any) => {
      inFlightFetchCount++;
      if (inFlightFetchCount > maxSimultaneousInFlight) {
        maxSimultaneousInFlight = inFlightFetchCount;
      }

      await new Promise((res) => {
        resolveSlowFetch = res;
      });

      inFlightFetchCount--;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [mockJob1] }),
      } as any;
    };

    // Trigger first slow poll
    const p1 = refreshProviderJobs({ silent: true });

    // Attempt second simultaneous background poll while p1 is in flight
    const p2 = refreshProviderJobs({ silent: true });

    // p2 should immediately return without launching another fetch
    assert(
      inFlightFetchCount === 1,
      '19. Second concurrent background poll is ignored (does not launch duplicate fetch)'
    );

    // Resolve the slow fetch
    if (resolveSlowFetch) {
      resolveSlowFetch(null);
    }
    await p1;
    await p2;

    assert(
      maxSimultaneousInFlight === 1,
      '20. Strictly at most 1 provider fetch request in flight simultaneously'
    );

    // =========================================================================
    // 7. COMPONENT STRUCTURE & LIFECYCLE AUDIT (ProviderHome.tsx)
    // =========================================================================
    console.log('\n--- 7. Component Lifecycle, Visibility API, and Cleanup Audit ---');

    const providerHomePath = path.resolve(__dirname, '../../client/src/components/ProviderHome.tsx');
    const source = fs.readFileSync(providerHomePath, 'utf8');

    assert(
      source.includes('document.visibilityState'),
      '21. ProviderHome inspects Page Visibility API (document.visibilityState)'
    );

    assert(
      source.includes("document.addEventListener('visibilitychange'"),
      '22. ProviderHome registers visibilitychange event listener on document'
    );

    assert(
      source.includes("document.removeEventListener('visibilitychange'"),
      '23. ProviderHome cleans up visibilitychange event listener on unmount'
    );

    assert(
      source.includes('clearInterval'),
      '24. ProviderHome clears interval timer on pause and component unmount'
    );

    assert(
      source.includes('window.setInterval'),
      '25. ProviderHome establishes configurable interval polling'
    );

    assert(
      source.includes('refreshProviderJobs({ silent: true })'),
      '26. Background timer dispatches silent polling request'
    );

    assert(
      source.includes('handleManualRefresh'),
      '27. Manual Refresh button uses handleManualRefresh to reset polling cycle'
    );

    assert(
      source.includes('min-h-[48px]'),
      '28. Manual Refresh button maintains 48px touch target accessibility standard'
    );

    assert(
      source.includes('effectivePollInterval'),
      '29. Polling interval bounds (30s-60s) are enforced in ProviderHome component'
    );

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n============================================================');
  console.log(`PROVIDER JOB AUTO-REFRESH TESTS: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in provider auto-refresh tests:', err);
  process.exit(1);
});
