export type ReleaseStatus = 'draft' | 'published' | 'withdrawn';

export interface AppRelease {
  id: string;
  releaseNumber: number;
  versionDisplay: string;
  versionName: string;
  androidVersionCode: number;
  packageId: string;
  minSdk: number;
  targetSdk: number;
  fileSize: number;
  sha256: string;
  changelog: string;
  releaseStatus: ReleaseStatus;
  isLatest: boolean;
  downloadCount: number;
  apkStorageKey?: string;
  createdBy?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawalReason?: string | null;
}

export type BetaFeedbackCategory =
  | 'BUG_REPORT'
  | 'UI_DESIGN'
  | 'PERFORMANCE'
  | 'AUTH'
  | 'BOOKING'
  | 'WORKER_EXPERIENCE'
  | 'FEATURE_REQUEST'
  | 'OTHER';

export type BetaTesterRole = 'customer' | 'worker' | 'both';

export type BetaFeedbackStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'FIXED'
  | 'WONT_FIX';

export interface BetaFeedback {
  id: string;
  title: string;
  description: string;
  category: BetaFeedbackCategory;
  appVersion: string;
  testerRole: BetaTesterRole;
  deviceModel?: string | null;
  androidVersion?: string | null;
  authorName: string;
  screenshotUrl?: string | null;
  status: BetaFeedbackStatus;
  isPinned: boolean;
  isReported: boolean;
  reportCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BetaFeedbackComment {
  id: string;
  feedbackId: string;
  parentCommentId?: string | null;
  authorName: string;
  isAdmin: boolean;
  message: string;
  moderationStatus: 'APPROVED' | 'PENDING' | 'FLAGGED';
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface ReleaseUploadResponse {
  release: AppRelease;
  extractedMetadata: {
    packageId: string;
    versionCode: number;
    versionName: string;
    minSdkVersion?: number;
    targetSdkVersion?: number;
    sha256: string;
    fileSize: number;
  };
}
