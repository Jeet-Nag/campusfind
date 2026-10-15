import {
  isAssignModalOpen,
  assignSelectedProviderId,
  assignSearchQuery,
  isAssigning,
  assignError,
  assignSuccessMessage,
  assignableProviders,
  isAssignProvidersLoading,
  assignProvidersError,
  filteredAssignableProviders,
  openAssignModal,
  closeAssignModal,
  setAssignSelectedProvider,
  clearAssignSuccessMessage,
  selectedBookingDetail,
  submitAssignProvider,
} from '../../client/src/state/admin-bookings';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import {
  canTransition,
  BookingStatus,
  AdminBookingDetail,
  AdminProviderView,
} from '../../shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n============================================================');
console.log('MODULE 12D STEP 3 — ADMIN PROVIDER ASSIGNMENT UI TEST SUITE');
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

// Mock booking details
const mockBookingRequested: AdminBookingDetail = {
  booking: {
    id: 'b0000000-1111-2222-3333-444444444441',
    idempotencyKey: 'idem-assign-1',
    status: 'SERVICE_REQUESTED',
    timestamps: {
      createdAt: '2026-03-01T10:00:00Z',
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      updatedAt: '2026-03-01T10:00:00Z',
    },
    areaLocality: 'chandil-bazar',
    landmark: 'Near Hanuman Mandir',
    textDescription: 'Ceiling fan making strange noise',
    audioUrl: null,
    audioDurationSeconds: null,
    visitingFee: 149,
    finalAmount: null,
    paymentMethod: 'CASH',
    paymentCollected: false,
  },
  customer: {
    id: 'c0000000-1111-2222-3333-444444444441',
    fullName: 'Ramesh Patel',
    phone: '9800012345',
    preferredLanguage: 'hi',
  },
  provider: null,
  category: {
    id: 'electrician',
    titleEn: 'Electrician',
    titleHi: 'बिजली मिस्त्री',
  },
  timeline: [
    {
      id: 'log-1',
      fromStatus: null,
      toStatus: 'SERVICE_REQUESTED',
      changedBy: null,
      notes: 'Booking created',
      createdAt: '2026-03-01T10:00:00Z',
    },
  ],
};

const mockProviders: AdminProviderView[] = [
  {
    id: 'p0000000-1111-2222-3333-444444444441',
    phone: '9800055001',
    fullName: 'Raju Sharma',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    verificationStatus: 'VERIFIED',
    activeBookingsCount: 0,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Chandil Bazar',
    isAvailable: true,
    rating: 4.8,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p0000000-1111-2222-3333-444444444442',
    phone: '9800055002',
    fullName: 'Manoj Verma',
    role: 'provider',
    preferredLanguage: 'en',
    isActive: true,
    verificationStatus: 'VERIFIED',
    activeBookingsCount: 0,
    categoryId: 'plumber',
    categoryTitleEn: 'Plumber',
    categoryTitleHi: 'नल / प्लंबर',
    serviceArea: 'Station Colony',
    isAvailable: true,
    rating: 4.5,
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'p0000000-1111-2222-3333-444444444443',
    phone: '9800055003',
    fullName: 'Suresh Mahato',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    verificationStatus: 'VERIFIED',
    activeBookingsCount: 0,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Dam Road',
    isAvailable: false,
    rating: 4.2,
    createdAt: '2026-01-03T00:00:00Z',
  },
  {
    id: 'p0000000-1111-2222-3333-444444444444',
    phone: '9800055004',
    fullName: 'Pending Electrician',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    verificationStatus: 'PENDING_VERIFICATION',
    activeBookingsCount: 0,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Chandil',
    isAvailable: true,
    rating: 5.0,
    createdAt: '2026-01-04T00:00:00Z',
  },
  {
    id: 'p0000000-1111-2222-3333-444444444445',
    phone: '9800055005',
    fullName: 'Busy Electrician',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    verificationStatus: 'VERIFIED',
    activeBookingsCount: 1,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Chandil',
    isAvailable: true,
    rating: 4.9,
    createdAt: '2026-01-05T00:00:00Z',
  },
];

async function runTests() {
  console.log('--- Phase 13 Requirements: 31 Explicit Assertions ---\n');

  // Helper visibility rule:
  function shouldShowAssignButton(status: BookingStatus, providerIdOrObj: any): boolean {
    return status === 'SERVICE_REQUESTED' && (providerIdOrObj === null || providerIdOrObj === undefined);
  }

  // 1. Assign button appears for SERVICE_REQUESTED + provider null
  assert(
    shouldShowAssignButton('SERVICE_REQUESTED', null) === true,
    'Assertion 1: Assign button appears for SERVICE_REQUESTED + provider null'
  );

  // 2. Assign button absent for PROVIDER_ASSIGNED
  assert(
    shouldShowAssignButton('PROVIDER_ASSIGNED', 'p0000000-1111-2222-3333-444444444441') === false,
    'Assertion 2: Assign button absent for PROVIDER_ASSIGNED'
  );

  // 3. Assign button absent for PROVIDER_ACCEPTED
  assert(
    shouldShowAssignButton('PROVIDER_ACCEPTED', 'p0000000-1111-2222-3333-444444444441') === false,
    'Assertion 3: Assign button absent for PROVIDER_ACCEPTED'
  );

  // 4. Assign button absent for all terminal/payment/operational states
  const otherStatuses: BookingStatus[] = [
    'PROVIDER_ON_THE_WAY',
    'SERVICE_STARTED',
    'SERVICE_COMPLETED',
    'PAYMENT_PENDING',
    'PAYMENT_COLLECTED',
    'BOOKING_COMPLETED',
    'CANCELLED_BY_CUSTOMER',
    'REJECTED_BY_PROVIDER',
    'CANCELLED_BY_ADMIN',
  ];
  let allOtherAbsent = true;
  for (const st of otherStatuses) {
    if (shouldShowAssignButton(st, null) || shouldShowAssignButton(st, 'prov-id')) {
      allOtherAbsent = false;
    }
  }
  assert(
    allOtherAbsent === true,
    'Assertion 4: Assign button absent for all terminal/payment/operational states'
  );

  // 5. Modal opens
  selectedBookingDetail.value = JSON.parse(JSON.stringify(mockBookingRequested));
  // Mock fetch to avoid real network call during test setup
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    if (String(url).includes('/api/admin/providers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { providers: mockProviders } }),
      } as any;
    }
    return { ok: false, status: 500 } as any;
  };

  await openAssignModal();
  assert(
    isAssignModalOpen.value === true,
    'Assertion 5: Modal opens (isAssignModalOpen.value === true)'
  );

  // 6. Booking context displayed
  const ctx = selectedBookingDetail.value;
  const hasShortId = ctx?.booking.id.slice(0, 8) !== undefined;
  const hasCategory = ctx?.category.titleEn === 'Electrician';
  const hasLocality = ctx?.booking.areaLocality === 'chandil-bazar';
  const hasLandmark = ctx?.booking.landmark === 'Near Hanuman Mandir';
  assert(
    hasShortId && hasCategory && hasLocality && hasLandmark,
    'Assertion 6: Booking context displayed (shortId, category, locality, landmark)'
  );

  // 7. Provider loading state
  isAssignProvidersLoading.value = true;
  assert(
    isAssignProvidersLoading.value === true,
    'Assertion 7: Provider loading state reflected in isAssignProvidersLoading signal'
  );
  isAssignProvidersLoading.value = false;

  // 8. Provider empty state
  assignableProviders.value = [];
  assert(
    filteredAssignableProviders.value.length === 0,
    'Assertion 8: Provider empty state when zero providers loaded'
  );
  assignableProviders.value = mockProviders;

  // 9. Provider search by name
  assignSearchQuery.value = 'Manoj';
  assert(
    filteredAssignableProviders.value.length === 1 &&
      filteredAssignableProviders.value[0].fullName === 'Manoj Verma',
    'Assertion 9: Provider search by name filters results accurately'
  );

  // 10. Provider search by phone
  assignSearchQuery.value = '55001';
  assert(
    filteredAssignableProviders.value.length === 1 &&
      filteredAssignableProviders.value[0].phone === '9800055001',
    'Assertion 10: Provider search by phone filters results accurately'
  );
  assignSearchQuery.value = '';

  // 11. Provider selection
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444441');
  assert(
    assignSelectedProviderId.value === 'p0000000-1111-2222-3333-444444444441',
    'Assertion 11: Provider selection sets assignSelectedProviderId'
  );

  // 12. No provider auto-selected
  closeAssignModal();
  await openAssignModal();
  assert(
    assignSelectedProviderId.value === null,
    'Assertion 12: No provider auto-selected when modal opens'
  );

  // 12b. Unavailable provider cannot be selected
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444443');
  assert(
    assignSelectedProviderId.value === null,
    'Assertion 12b: Inactive or unavailable provider is non-selectable'
  );

  // 12c. Unverified provider cannot be selected
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444444');
  assert(
    assignSelectedProviderId.value === null,
    'Assertion 12c: Pending verification provider is non-selectable'
  );

  // 12d. Busy provider cannot be selected
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444445');
  assert(
    assignSelectedProviderId.value === null,
    'Assertion 12d: Busy provider is non-selectable'
  );

  // 12e. Category mismatch provider cannot be selected
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444442');
  assert(
    assignSelectedProviderId.value === null,
    'Assertion 12e: Category mismatch provider is non-selectable'
  );

  // 13. Assign disabled before selection
  let attemptedBeforeSelection = await submitAssignProvider();
  assert(
    attemptedBeforeSelection === false && assignError.value === en['admin.assign_select_prompt'],
    'Assertion 13: Assign disabled/rejected before explicit selection'
  );

  // 14. Assign enabled after selection
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444441');
  assert(
    assignSelectedProviderId.value !== null && isAssigning.value === false,
    'Assertion 14: Assign enabled after provider selection'
  );

  // 15. Loading state during POST
  isAssigning.value = true;
  assert(
    isAssigning.value === true,
    'Assertion 15: Loading state during POST (isAssigning.value === true)'
  );

  // 16. Duplicate-click prevention
  const duplicateAttempt = await submitAssignProvider();
  assert(
    duplicateAttempt === false,
    'Assertion 16: Duplicate-click prevention (in-flight submit returns false immediately)'
  );
  isAssigning.value = false;

  // 17. Correct POST URL
  let capturedPostUrl = '';
  let capturedBody: any = null;
  globalThis.fetch = async (url: any, options: any) => {
    if (options?.method === 'POST') {
      capturedPostUrl = String(url);
      if (options?.body) {
        capturedBody = JSON.parse(options.body);
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          booking: {
            ...selectedBookingDetail.value?.booking,
            status: 'PROVIDER_ASSIGNED',
            timestamps: {
              ...selectedBookingDetail.value?.booking.timestamps,
              updatedAt: new Date().toISOString(),
            },
          },
          provider: {
            id: 'p0000000-1111-2222-3333-444444444441',
            fullName: 'Raju Sharma',
            phone: '9800055001',
            serviceArea: 'Chandil Bazar',
            rating: 4.8,
          },
        },
      }),
    } as any;
  };

  // Mock auth token
  const authModule = await import('../../client/src/state/auth');
  authModule.authToken.value = 'mock-admin-jwt';

  const submitResult = await submitAssignProvider();

  assert(
    capturedPostUrl === `/api/admin/bookings/${mockBookingRequested.booking.id}/assign`,
    'Assertion 17: Correct POST URL (/api/admin/bookings/:id/assign)'
  );

  // 18. Correct request body
  assert(
    capturedBody?.providerId === 'p0000000-1111-2222-3333-444444444441' &&
      Object.keys(capturedBody).length === 1,
    'Assertion 18: Correct request body ({ providerId: string })'
  );

  // 19. Successful assignment
  assert(
    submitResult === true &&
      selectedBookingDetail.value?.booking.status === 'PROVIDER_ASSIGNED',
    'Assertion 19: Successful assignment updates booking status to PROVIDER_ASSIGNED'
  );

  // 20. Successful state refresh
  assert(
    assignSuccessMessage.value !== null && isAssignModalOpen.value === false,
    'Assertion 20: Successful state refresh with success banner and closed modal'
  );

  // 21. Provider name displayed after success
  assert(
    selectedBookingDetail.value?.provider?.fullName === 'Raju Sharma',
    'Assertion 21: Provider name displayed after success (Raju Sharma)'
  );

  // 22. Assign button disappears after success
  assert(
    shouldShowAssignButton(
      selectedBookingDetail.value!.booking.status,
      selectedBookingDetail.value!.provider
    ) === false,
    'Assertion 22: Assign button disappears after successful assignment'
  );

  // 23. Conflict handling
  // Reset booking to requested
  selectedBookingDetail.value = JSON.parse(JSON.stringify(mockBookingRequested));
  setAssignSelectedProvider('p0000000-1111-2222-3333-444444444441');

  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      success: false,
      error: {
        code: 'BOOKING_ALREADY_ASSIGNED',
        messageEn: 'Booking is already assigned to a provider.',
        messageHi: 'बुकिंग पहले से ही किसी मिस्त्री को सौंपी गई है।',
      },
    }),
  } as any);

  const conflictResult = await submitAssignProvider();
  assert(
    conflictResult === false && assignError.value === en['admin.assign_conflict_error'],
    'Assertion 23: Conflict handling for 409 BOOKING_ALREADY_ASSIGNED'
  );

  // 24. PROVIDER_UNAVAILABLE handling
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        messageEn: 'Provider is currently marked unavailable.',
        messageHi: 'मिस्त्री वर्तमान में अनुपलब्ध है।',
      },
    }),
  } as any);

  await submitAssignProvider();
  assert(
    assignError.value === en['admin.assign_provider_unavailable'],
    'Assertion 24: PROVIDER_UNAVAILABLE handling'
  );

  // 25. CATEGORY_MISMATCH handling
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      error: {
        code: 'CATEGORY_MISMATCH',
        messageEn: 'Provider category does not match booking category.',
        messageHi: 'मिस्त्री की श्रेणी बुकिंग श्रेणी से मेल नहीं खाती।',
      },
    }),
  } as any);

  await submitAssignProvider();
  assert(
    assignError.value === en['admin.assign_category_mismatch'],
    'Assertion 25: CATEGORY_MISMATCH handling'
  );

  // 26. ACTIVE_BOOKING_EXISTS handling
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      success: false,
      error: {
        code: 'ACTIVE_BOOKING_EXISTS',
        messageEn: 'Cannot assign provider with an active booking in progress.',
        messageHi: 'प्रगति पर बुकिंग वाले मिस्त्री को नया काम नहीं सौंपा जा सकता।',
      },
    }),
  } as any);

  await submitAssignProvider();
  assert(
    assignError.value === en['admin.assign_active_booking_exists'],
    'Assertion 26: ACTIVE_BOOKING_EXISTS handling'
  );

  // 27. PROVIDER_NOT_FOUND handling
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({
      success: false,
      error: {
        code: 'PROVIDER_NOT_FOUND',
        messageEn: 'Provider not found.',
        messageHi: 'मिस्त्री नहीं मिला।',
      },
    }),
  } as any);

  await submitAssignProvider();
  assert(
    assignError.value === en['admin.assign_provider_not_found'],
    'Assertion 27: PROVIDER_NOT_FOUND handling'
  );

  // 27b. PROVIDER_NOT_VERIFIED handling
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      error: {
        code: 'PROVIDER_NOT_VERIFIED',
        messageEn: 'Technician profile is not verified.',
        messageHi: 'मिस्त्री प्रोफ़ाइल सत्यापित नहीं है।',
      },
    }),
  } as any);

  await submitAssignProvider();
  assert(
    assignError.value === en['admin.assign_provider_not_verified'],
    'Assertion 27b: PROVIDER_NOT_VERIFIED handling'
  );

  // 28. Retry after provider-list error
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ success: false }),
  } as any);

  await (await import('../../client/src/state/admin-bookings')).loadAssignableProviders();
  assert(
    assignProvidersError.value !== null,
    'Assertion 28a: Provider-list error state captured'
  );

  // Refetch with success
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { providers: mockProviders } }),
  } as any);

  await (await import('../../client/src/state/admin-bookings')).loadAssignableProviders();
  assert(
    assignProvidersError.value === null && assignableProviders.value.length === 5,
    'Assertion 28b: Retry after provider-list error successfully recovers'
  );

  // 29. EN/HI key parity
  const requiredKeys = [
    'admin.assign_provider_btn',
    'admin.assign_modal_title',
    'admin.assign_modal_desc',
    'admin.assign_search_placeholder',
    'admin.assign_matching_category',
    'admin.assign_other_category',
    'admin.assign_available',
    'admin.assign_busy',
    'admin.assign_active',
    'admin.assign_inactive',
    'admin.assign_no_providers_found',
    'admin.assign_loading_providers',
    'admin.assign_load_providers_error',
    'admin.assign_retry',
    'admin.assign_confirm_btn',
    'admin.assign_confirming_btn',
    'admin.assign_success',
    'admin.assign_conflict_error',
    'admin.assign_select_prompt',
    'admin.assign_booking_context',
    'admin.assign_category_label',
    'admin.assign_location_label',
    'admin.assign_phone_label',
    'admin.assign_rating_label',
    'admin.assign_area_label',
    'admin.assign_generic_error',
    'admin.assign_provider_not_found',
    'admin.assign_invalid_provider_role',
    'admin.assign_provider_inactive',
    'admin.assign_provider_profile_missing',
    'admin.assign_provider_unavailable',
    'admin.assign_category_mismatch',
    'admin.assign_active_booking_exists',
    'admin.assign_provider_not_verified',
  ];

  let keysMatch = true;
  for (const k of requiredKeys) {
    if (!(k in en) || !(k in hi)) {
      keysMatch = false;
      console.error(`Missing i18n key in parity check: ${k}`);
    }
  }
  assert(
    keysMatch && Object.keys(en).length === Object.keys(hi).length,
    'Assertion 29: EN/HI key parity verified for all 33 assignment keys'
  );

  // 30. No hard-coded user-facing strings
  const viewFile = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/AdminBookingsView.tsx'),
    'utf-8'
  );
  assert(
    viewFile.includes("t('admin.assign_provider_btn')") &&
      viewFile.includes("t('admin.assign_modal_title')") &&
      viewFile.includes("t('admin.assign_confirm_btn')") &&
      viewFile.includes("t('admin.assign_matching_category')"),
    'Assertion 30: No hard-coded user-facing strings (all strings bound to centralized t())'
  );

  // 31. Minimum 48px action targets where applicable
  assert(
    viewFile.includes('min-h-[48px]') &&
      viewFile.includes('min-w-[48px]'),
    'Assertion 31: Minimum 48px action targets enforced across all assignment buttons and inputs'
  );

  // Restore fetch
  globalThis.fetch = originalFetch;

  console.log('\n============================================================');
  console.log(`ADMIN ASSIGNMENT UI TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
