import { UserRole, SupportedLanguage } from './user';

export type BookingStatus =
  | 'SERVICE_REQUESTED'
  | 'PROVIDER_ASSIGNED'
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_ON_THE_WAY'
  | 'SERVICE_STARTED'
  | 'SERVICE_COMPLETED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COLLECTED'
  | 'BOOKING_COMPLETED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'REJECTED_BY_PROVIDER'
  | 'CANCELLED_BY_ADMIN';

export type PaymentMethod = 'CASH';

export interface Booking {
  id: string;
  idempotencyKey: string;
  customerId: string;
  providerId: string | null;
  categoryId: string;
  
  // Problem description
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  textDescription: string | null;
  
  // Location
  areaLocality: string;
  landmark: string | null;
  
  // Status and Financials
  status: BookingStatus;
  visitingFee: number;
  finalAmount: number | null;
  paymentMethod: PaymentMethod;
  paymentCollected: boolean;
  isTest?: boolean;
  
  // Timestamps
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CreateBookingRequest {
  idempotencyKey: string;
  categoryId: string;
  areaLocality: string;
  landmark?: string;
  textDescription?: string;
  audioBase64?: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
  finalAmount?: number;
  notes?: string;
}

export interface BookingStatusLog {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BookingDetail extends Booking {
  statusLogs?: BookingStatusLog[];
  provider?: {
    name: string;
  } | null;
}

export interface ProviderJob {
  id: string;
  categoryId: string;
  areaLocality: string;
  landmark: string | null;
  textDescription: string | null;
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  visitingFee: number;
  status: BookingStatus;
  createdAt: string;
}

export interface AdminBookingListItem {
  id: string;
  shortId: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  providerId: string | null;
  providerName: string | null;
  providerPhone: string | null;
  categoryId: string;
  categoryTitleEn: string;
  categoryTitleHi: string;
  areaLocality: string;
  localityNameEn: string;
  localityNameHi: string;
  status: BookingStatus;
  visitingFee: number;
  finalAmount: number | null;
  paymentCollected: boolean;
  hasAudio: boolean;
  createdAt: string;
}

export interface AdminBookingTimelineItem {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedBy: {
    id: string;
    name: string | null;
    role: UserRole;
  } | null;
  notes: string | null;
  createdAt: string;
}

export interface AdminBookingDetail {
  booking: {
    id: string;
    idempotencyKey: string;
    status: BookingStatus;
    timestamps: {
      createdAt: string;
      acceptedAt: string | null;
      startedAt: string | null;
      completedAt: string | null;
      updatedAt: string;
    };
    areaLocality: string;
    landmark: string | null;
    textDescription: string | null;
    audioUrl: string | null;
    audioDurationSeconds: number | null;
    visitingFee: number;
    finalAmount: number | null;
    paymentMethod: PaymentMethod;
    paymentCollected: boolean;
  };
  customer: {
    id: string;
    fullName: string | null;
    phone: string;
    preferredLanguage: SupportedLanguage;
  };
  provider: {
    id: string;
    fullName: string | null;
    phone: string;
    serviceArea: string;
    rating: number;
  } | null;
  category: {
    id: string;
    titleEn: string;
    titleHi: string;
  };
  timeline: AdminBookingTimelineItem[];
}

