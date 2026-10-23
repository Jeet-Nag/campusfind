export type UserRole = 'customer' | 'provider' | 'admin';

export type SupportedLanguage = 'en' | 'hi';

export type WorkerVerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  studentId?: string | null;
  role: UserRole;
  fullName: string | null;
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfile {
  userId: string;
  categoryId: string;
  serviceArea: string;
  isAvailable: boolean;
  rating: number;
  verificationStatus: WorkerVerificationStatus;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    phone: string;
    role: UserRole;
    preferredLanguage: SupportedLanguage;
    fullName: string | null;
    workerVerificationStatus?: WorkerVerificationStatus | null;
  };
}

export interface AdminProviderView {
  id: string;
  phone: string;
  fullName: string | null;
  role: UserRole;
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
  categoryId: string;
  categoryTitleEn: string;
  categoryTitleHi: string;
  serviceArea: string;
  isAvailable: boolean;
  rating: number;
  verificationStatus?: WorkerVerificationStatus;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  hasAadhaarFront?: boolean;
  hasAadhaarBack?: boolean;
  hasPhoto?: boolean;
  activeBookingsCount?: number;
}

export interface VerifiedWorkerSummary {
  id: string;
  fullName: string;
  categoryId: string;
  categoryTitleEn: string;
  categoryTitleHi: string;
  isVerified: true;
  photoUrl?: string | null;
}

export interface WorkerOnboardingInput {
  fullName: string;
  categoryId: string;
  aadhaarFrontBase64?: string;
  aadhaarFrontMime?: string;
  aadhaarBackBase64?: string;
  aadhaarBackMime?: string;
  photoBase64?: string;
  photoMime?: string;
}

export interface AdminUserBookingCounts {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
}

export interface AdminUserView {
  id: string;
  phone: string;
  role: UserRole;
  fullName: string | null;
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
  workerVerificationStatus?: WorkerVerificationStatus | null;
  categoryTitleEn?: string | null;
  categoryTitleHi?: string | null;
  bookingCounts: AdminUserBookingCounts;
}

export interface TestCleanupPreview {
  testUsersCount: number;
  testBookingsCount: number;
  testStatusLogsCount: number;
  testCustomersCount: number;
  testProvidersCount: number;
  canCleanup: boolean;
}

export interface TestCleanupResult {
  deletedUsersCount: number;
  deletedBookingsCount: number;
  deletedStatusLogsCount: number;
}
