export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    messageEn: string;
    messageHi: string;
    details?: unknown;
  };
}

export type ApiErrorCode =
  | 'INVALID_PHONE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'INVALID_STATUS_TRANSITION'
  | 'JOB_ALREADY_CLAIMED'
  | 'JOB_NO_LONGER_ASSIGNED'
  | 'JOB_ALREADY_DECLINED'
  | 'CATEGORY_MISMATCH'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';

export interface SupportConfig {
  supportPhone: string | null;
  supportWhatsApp: string | null;
}
