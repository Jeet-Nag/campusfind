import { useEffect } from 'preact/hooks';
import { currentLanguage, t } from '../state/language';
import { categories, fetchCategories } from '../state/categories';
import {
  providersList,
  fetchAdminProviders,
} from '../state/admin-providers';
import {
  bookingsList,
  bookingsTotal,
  isBookingsLoading,
  bookingsError,
  bookingSearchQuery,
  bookingStatusFilter,
  bookingCategoryFilter,
  bookingLocalityFilter,
  bookingProviderFilter,
  currentPage,
  totalPages,
  hasPrevPage,
  hasNextPage,
  showingRange,
  selectedBookingDetail,
  isDetailLoading,
  detailError,
  isDetailModalOpen,
  isPlayingDetailAudio,
  detailAudioError,
  isCancelModalOpen,
  cancelReason,
  cancelReasonError,
  isCancelling,
  cancelError,
  cancelSuccessMessage,
  fetchAdminBookings,
  setBookingPage,
  nextBookingPage,
  prevBookingPage,
  clearBookingFilters,
  openBookingDetail,
  closeBookingDetail,
  refreshSelectedBookingDetail,
  toggleDetailAudio,
  stopDetailAudio,
  openCancelModal,
  closeCancelModal,
  submitCancelBooking,
  clearCancelSuccessMessage,
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
  loadAssignableProviders,
  setAssignSelectedProvider,
  submitAssignProvider,
  clearAssignSuccessMessage,
} from '../state/admin-bookings';
import {
  BookingStatus,
  CHANDIL_LOCALITIES,
  canTransition,
} from '@shared';
import {
  FileTextIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  MicIcon,
  PhoneIcon,
  ChevronRightIcon,
  ClockIcon,
  UserPlusIcon,
} from './icons';

const ALL_STATUS_OPTIONS: BookingStatus[] = [
  'SERVICE_REQUESTED',
  'PROVIDER_ASSIGNED',
  'PROVIDER_ACCEPTED',
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

function getStatusBadgeStyle(status: BookingStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'BOOKING_COMPLETED':
    case 'PAYMENT_COLLECTED':
    case 'SERVICE_COMPLETED':
      return { bg: 'bg-green-50 border-green-200', text: 'text-action-active', dot: 'bg-action' };
    case 'CANCELLED_BY_CUSTOMER':
    case 'CANCELLED_BY_ADMIN':
    case 'REJECTED_BY_PROVIDER':
      return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-600' };
    case 'PROVIDER_ON_THE_WAY':
    case 'SERVICE_STARTED':
    case 'PAYMENT_PENDING':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
    case 'SERVICE_REQUESTED':
    case 'PROVIDER_ASSIGNED':
    case 'PROVIDER_ACCEPTED':
    default:
      return { bg: 'bg-blue-50 border-blue-200', text: 'text-brand', dot: 'bg-brand' };
  }
}

function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'SERVICE_REQUESTED':
      return t('admin.status_service_requested');
    case 'PROVIDER_ASSIGNED':
      return t('admin.status_provider_assigned');
    case 'PROVIDER_ACCEPTED':
      return t('admin.status_provider_accepted');
    case 'PROVIDER_ON_THE_WAY':
      return t('admin.status_provider_on_the_way');
    case 'SERVICE_STARTED':
      return t('admin.status_service_started');
    case 'SERVICE_COMPLETED':
      return t('admin.status_service_completed');
    case 'PAYMENT_PENDING':
      return t('admin.status_payment_pending');
    case 'PAYMENT_COLLECTED':
      return t('admin.status_payment_collected');
    case 'BOOKING_COMPLETED':
      return t('admin.status_booking_completed');
    case 'CANCELLED_BY_CUSTOMER':
      return t('admin.status_cancelled_by_customer');
    case 'REJECTED_BY_PROVIDER':
      return t('admin.status_rejected_by_provider');
    case 'CANCELLED_BY_ADMIN':
      return t('admin.status_cancelled_by_admin');
    default:
      return status;
  }
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return t('admin.role_admin');
    case 'provider':
      return t('admin.role_provider');
    case 'customer':
      return t('admin.role_customer');
    case 'system':
      return t('admin.role_system');
    default:
      return role || '';
  }
}

function formatDateTime(isoString: string, lang: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function AdminBookingsView() {
  const lang = currentLanguage.value || 'en';
  const list = bookingsList.value;
  const total = bookingsTotal.value;
  const loading = isBookingsLoading.value;
  const error = bookingsError.value;
  const successMsg = cancelSuccessMessage.value || assignSuccessMessage.value;
  const cats = categories.value;
  const provs = providersList.value;
  const range = showingRange.value;

  useEffect(() => {
    fetchAdminBookings();
    if (cats.length === 0) {
      fetchCategories();
    }
    if (provs.length === 0) {
      fetchAdminProviders();
    }
  }, []);

  const handleSearchSubmit = (e: Event) => {
    e.preventDefault();
    fetchAdminBookings(0);
  };

  const handleFilterChange = () => {
    fetchAdminBookings(0);
  };

  const hasActiveFilters =
    bookingSearchQuery.value.trim().length > 0 ||
    bookingStatusFilter.value !== 'all' ||
    bookingCategoryFilter.value !== 'all' ||
    bookingLocalityFilter.value !== 'all' ||
    bookingProviderFilter.value !== 'all';

  return (
    <div class="space-y-6">
      {/* Header Section */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-text-main">
            {t('admin.bookings_title')}
          </h2>
          <p class="text-sm text-text-sub mt-0.5">
            {t('admin.bookings_subtitle')}
          </p>
        </div>

        <button
          onClick={() => fetchAdminBookings()}
          disabled={loading}
          class="min-h-[48px] px-4 py-2.5 bg-surface hover:bg-slate-100 border border-border rounded-lg text-sm font-semibold text-text-main flex items-center justify-center gap-2 transition-colors self-start sm:self-auto"
          aria-label={t('admin.refresh_action')}
        >
          <RefreshIcon size={16} class={loading ? 'animate-spin' : ''} />
          <span>{t('admin.refresh_action')}</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div class="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between gap-3 text-action shadow-xs animate-fadeIn">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckIcon size={16} />
            </div>
            <span class="text-sm font-semibold">{successMsg}</span>
          </div>
          <button
            onClick={() => {
              clearCancelSuccessMessage();
              clearAssignSuccessMessage();
            }}
            class="min-h-[48px] min-w-[48px] p-2 text-action/70 hover:text-action rounded-lg flex items-center justify-center"
            aria-label="Dismiss"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3">
        {/* Search bar row */}
        <form onSubmit={handleSearchSubmit} class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub">
              <SearchIcon size={18} />
            </div>
            <input
              type="text"
              value={bookingSearchQuery.value}
              onInput={(e) => {
                bookingSearchQuery.value = (e.target as HTMLInputElement).value;
              }}
              placeholder={t('admin.bookings_search_placeholder')}
              class="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand min-h-[48px]"
            />
          </div>
          <button
            type="submit"
            class="min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors"
          >
            <SearchIcon size={16} />
            <span>{t('admin.search_action')}</span>
          </button>
        </form>

        {/* Filter Dropdowns Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Status Filter */}
          <div>
            <select
              value={bookingStatusFilter.value}
              onChange={(e) => {
                bookingStatusFilter.value = (e.target as HTMLSelectElement).value;
                handleFilterChange();
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-text-main min-h-[48px] focus:ring-2 focus:ring-brand"
              aria-label={t('admin.filter_status_all')}
            >
              <option value="all">{t('admin.filter_status_all')}</option>
              {ALL_STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {getStatusLabel(st)}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={bookingCategoryFilter.value}
              onChange={(e) => {
                bookingCategoryFilter.value = (e.target as HTMLSelectElement).value;
                handleFilterChange();
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-text-main min-h-[48px] focus:ring-2 focus:ring-brand"
              aria-label={t('admin.filter_category_all')}
            >
              <option value="all">{t('admin.filter_category_all')}</option>
              {cats.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {lang === 'hi' ? cat.titleHi : cat.titleEn}
                </option>
              ))}
            </select>
          </div>

          {/* Locality Filter */}
          <div>
            <select
              value={bookingLocalityFilter.value}
              onChange={(e) => {
                bookingLocalityFilter.value = (e.target as HTMLSelectElement).value;
                handleFilterChange();
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-text-main min-h-[48px] focus:ring-2 focus:ring-brand"
              aria-label={t('admin.filter_locality_all')}
            >
              <option value="all">{t('admin.filter_locality_all')}</option>
              {CHANDIL_LOCALITIES.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {lang === 'hi' ? loc.nameHi : loc.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Provider Filter */}
          <div>
            <select
              value={bookingProviderFilter.value}
              onChange={(e) => {
                bookingProviderFilter.value = (e.target as HTMLSelectElement).value;
                handleFilterChange();
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-text-main min-h-[48px] focus:ring-2 focus:ring-brand"
              aria-label={t('admin.filter_provider_all')}
            >
              <option value="all">{t('admin.filter_provider_all')}</option>
              {provs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName || p.phone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters helper row */}
        {hasActiveFilters && (
          <div class="flex items-center justify-between pt-1 border-t border-border/60">
            <span class="text-xs text-text-sub">
              {t('admin.filters_applied_count', { count: total })}
            </span>
            <button
              onClick={clearBookingFilters}
              class="min-h-[48px] px-3 py-1 text-xs font-semibold text-brand hover:underline flex items-center gap-1"
            >
              <XIcon size={14} />
              <span>{t('admin.clear_filters')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div class="bg-surface border border-border rounded-lg p-12 text-center shadow-xs">
          <SpinnerIcon size={32} class="text-brand animate-spin mx-auto mb-3" />
          <p class="text-sm text-text-sub">{t('admin.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div class="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 shadow-xs">
          <AlertCircleIcon size={20} class="text-danger mt-0.5 shrink-0" />
          <div class="flex-1">
            <h3 class="text-sm font-bold text-danger">{t('admin.error_title')}</h3>
            <p class="text-xs text-text-sub mt-1">{error}</p>
            <button
              onClick={() => fetchAdminBookings()}
              class="mt-3 min-h-[48px] px-4 py-2 bg-white border border-border rounded text-xs font-semibold text-text-main hover:bg-background flex items-center gap-1.5"
            >
              <RefreshIcon size={14} />
              <span>{t('admin.retry')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && list.length === 0 && (
        <div class="bg-surface border border-border rounded-lg p-10 text-center shadow-xs">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-text-sub">
            <FileTextIcon size={24} />
          </div>
          <h3 class="text-base font-bold text-text-main">
            {hasActiveFilters ? t('admin.no_bookings_match') : t('admin.no_bookings_found')}
          </h3>
          <p class="text-sm text-text-sub max-w-md mx-auto mt-1 mb-4">
            {hasActiveFilters ? '' : t('admin.no_bookings_desc')}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearBookingFilters}
              class="min-h-[48px] px-4 py-2.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors"
            >
              {t('admin.clear_filters')}
            </button>
          )}
        </div>
      )}

      {/* Booking List: Responsive Desktop Table & Mobile Cards */}
      {!loading && !error && list.length > 0 && (
        <div class="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div class="hidden md:block bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-text-main border-collapse">
                <thead>
                  <tr class="bg-background border-b border-border text-text-sub font-semibold">
                    <th class="py-3 px-3.5">{t('admin.col_booking_id')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_customer')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_provider')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_category')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_locality')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_financials')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_status')}</th>
                    <th class="py-3 px-3.5">{t('admin.col_created_at')}</th>
                    <th class="py-3 px-3.5 text-right">{t('admin.col_actions')}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  {list.map((booking) => {
                    const badge = getStatusBadgeStyle(booking.status);
                    const categoryTitle =
                      lang === 'hi' ? booking.categoryTitleHi : booking.categoryTitleEn;
                    const localityName =
                      lang === 'hi' ? booking.localityNameHi : booking.localityNameEn;

                    return (
                      <tr
                        key={booking.id}
                        class="hover:bg-background/50 transition-colors"
                      >
                        {/* ID */}
                        <td class="py-3 px-3.5 font-mono text-text-main font-semibold whitespace-nowrap">
                          <div class="flex items-center gap-1.5">
                            <span>#{booking.shortId}</span>
                            {booking.hasAudio && (
                              <span
                                class="inline-flex items-center p-1 rounded bg-blue-50 text-brand"
                                title={t('admin.has_voice_note')}
                              >
                                <MicIcon size={12} />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer */}
                        <td class="py-3 px-3.5">
                          <div class="font-medium text-text-main">
                            {booking.customerName || t('admin.role_customer')}
                          </div>
                          <div class="text-[11px] text-text-sub">{booking.customerPhone}</div>
                        </td>

                        {/* Provider */}
                        <td class="py-3 px-3.5">
                          {booking.providerName ? (
                            <div>
                              <div class="font-medium text-text-main">{booking.providerName}</div>
                              <div class="text-[11px] text-text-sub">{booking.providerPhone}</div>
                            </div>
                          ) : (
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-text-sub border border-slate-200">
                              {t('admin.not_assigned')}
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td class="py-3 px-3.5 whitespace-nowrap font-medium text-text-main">
                          {categoryTitle}
                        </td>

                        {/* Locality */}
                        <td class="py-3 px-3.5 whitespace-nowrap text-text-sub">
                          {localityName}
                        </td>

                        {/* Financials */}
                        <td class="py-3 px-3.5 whitespace-nowrap">
                          <div class="font-semibold text-text-main">
                            ₹{booking.finalAmount !== null ? booking.finalAmount : booking.visitingFee}
                          </div>
                          <div>
                            {booking.paymentCollected ? (
                              <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-green-50 text-action">
                                {t('admin.paid')}
                              </span>
                            ) : (
                              <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                                {t('admin.unpaid')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td class="py-3 px-3.5 whitespace-nowrap">
                          <span
                            class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}
                          >
                            <span class={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            <span>{getStatusLabel(booking.status)}</span>
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td class="py-3 px-3.5 whitespace-nowrap text-text-sub text-[11px]">
                          {formatDateTime(booking.createdAt, lang)}
                        </td>

                        {/* Actions */}
                        <td class="py-3 px-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => openBookingDetail(booking.id)}
                            class="min-h-[48px] px-3.5 py-2 bg-background hover:bg-slate-100 active:bg-slate-200 border border-border rounded-lg text-xs font-semibold text-brand transition-colors"
                          >
                            {t('admin.col_details')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div class="md:hidden space-y-3">
            {list.map((booking) => {
              const badge = getStatusBadgeStyle(booking.status);
              const categoryTitle =
                lang === 'hi' ? booking.categoryTitleHi : booking.categoryTitleEn;
              const localityName =
                lang === 'hi' ? booking.localityNameHi : booking.localityNameEn;

              return (
                <div
                  key={booking.id}
                  class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3"
                >
                  {/* Top line: ID, voice note, and status badge */}
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-sm font-bold text-text-main">
                        #{booking.shortId}
                      </span>
                      {booking.hasAudio && (
                        <span
                          class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-brand text-[10px] font-semibold"
                          title={t('admin.has_voice_note')}
                        >
                          <MicIcon size={12} class="mr-0.5" />
                          <span>{t('admin.col_audio')}</span>
                        </span>
                      )}
                    </div>
                    <span
                      class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text}`}
                    >
                      <span class={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                      <span>{getStatusLabel(booking.status)}</span>
                    </span>
                  </div>

                  {/* Customer & Provider Information */}
                  <div class="grid grid-cols-2 gap-2 text-xs border-y border-border/50 py-2.5">
                    <div>
                      <span class="text-text-sub block text-[11px]">
                        {t('admin.col_customer')}:
                      </span>
                      <span class="font-semibold text-text-main block">
                        {booking.customerName || t('admin.role_customer')}
                      </span>
                      <span class="text-text-sub text-[11px] block">{booking.customerPhone}</span>
                    </div>

                    <div>
                      <span class="text-text-sub block text-[11px]">
                        {t('admin.col_provider')}:
                      </span>
                      {booking.providerName ? (
                        <>
                          <span class="font-semibold text-text-main block">
                            {booking.providerName}
                          </span>
                          <span class="text-text-sub text-[11px] block">
                            {booking.providerPhone}
                          </span>
                        </>
                      ) : (
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-text-sub border border-slate-200 mt-0.5">
                          {t('admin.not_assigned')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Service Category, Locality, and Financials */}
                  <div class="flex items-center justify-between text-xs text-text-sub">
                    <div>
                      <span class="font-medium text-text-main">{categoryTitle}</span>
                      <span class="mx-1">•</span>
                      <span>{localityName}</span>
                    </div>

                    <div class="text-right">
                      <span class="font-bold text-text-main text-sm">
                        ₹{booking.finalAmount !== null ? booking.finalAmount : booking.visitingFee}
                      </span>
                      <span class="ml-1.5">
                        {booking.paymentCollected ? (
                          <span class="text-action font-semibold text-[11px]">
                            {t('admin.paid')}
                          </span>
                        ) : (
                          <span class="text-amber-700 font-semibold text-[11px]">
                            {t('admin.unpaid')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Date & Action */}
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-[11px] text-text-sub flex items-center gap-1">
                      <ClockIcon size={12} />
                      <span>{formatDateTime(booking.createdAt, lang)}</span>
                    </span>

                    <button
                      onClick={() => openBookingDetail(booking.id)}
                      class="min-h-[48px] px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors flex items-center gap-1"
                    >
                      <span>{t('admin.col_details')}</span>
                      <ChevronRightIcon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div class="bg-surface border border-border rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div class="text-xs text-text-sub">
              {t('admin.pagination_showing', {
                from: range.from,
                to: range.to,
                total: range.total,
              })}
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={prevBookingPage}
                disabled={!hasPrevPage.value || loading}
                class="min-h-[48px] px-4 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label={t('admin.pagination_prev')}
              >
                {t('admin.pagination_prev')}
              </button>

              <span class="text-xs font-semibold text-text-main px-2">
                {t('admin.pagination_page', {
                  current: currentPage.value,
                  total: totalPages.value,
                })}
              </span>

              <button
                onClick={nextBookingPage}
                disabled={!hasNextPage.value || loading}
                class="min-h-[48px] px-4 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label={t('admin.pagination_next')}
              >
                {t('admin.pagination_next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {isDetailModalOpen.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="relative bg-surface border border-border rounded-xl max-w-2xl w-full p-5 md:p-6 shadow-xl space-y-5 my-8">
            {/* Header */}
            <div class="flex items-center justify-between pb-3 border-b border-border">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-blue-50 text-brand flex items-center justify-center">
                  <FileTextIcon size={18} />
                </div>
                <div>
                  <h3 class="text-lg font-bold text-text-main">
                    {t('admin.booking_detail_title')}
                  </h3>
                  {selectedBookingDetail.value && (
                    <span class="text-xs font-mono text-text-sub">
                      #{selectedBookingDetail.value.booking.id.slice(0, 8)} •{' '}
                      {selectedBookingDetail.value.booking.id}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={closeBookingDetail}
                class="min-h-[48px] min-w-[48px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center"
                aria-label={t('admin.close_modal')}
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Loading */}
            {isDetailLoading.value && (
              <div class="py-12 text-center">
                <SpinnerIcon size={32} class="text-brand animate-spin mx-auto mb-2" />
                <p class="text-xs text-text-sub">{t('admin.loading')}</p>
              </div>
            )}

            {/* Modal Error */}
            {!isDetailLoading.value && detailError.value && (
              <div class="p-4 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2">
                <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                <div class="flex-1">
                  <span>{detailError.value}</span>
                </div>
              </div>
            )}

            {/* Modal Content */}
            {!isDetailLoading.value && selectedBookingDetail.value && (
              <div class="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {/* Status Bar */}
                {(() => {
                  const bStatus = selectedBookingDetail.value.booking.status;
                  const badge = getStatusBadgeStyle(bStatus);
                  return (
                    <div class="flex items-center justify-between p-3.5 rounded-lg bg-background border border-border">
                      <div class="text-xs font-semibold text-text-sub">
                        {t('booking.status_label')}:
                      </div>
                      <span
                        class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text}`}
                      >
                        <span class={`w-2 h-2 rounded-full ${badge.dot}`}></span>
                        <span>{getStatusLabel(bStatus)}</span>
                      </span>
                    </div>
                  );
                })()}

                {/* Grid: Customer Info & Provider Info */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Information Card */}
                  <div class="bg-background border border-border rounded-lg p-3.5 space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-text-sub">
                      {t('admin.customer_details')}
                    </h4>
                    <div class="text-xs space-y-1.5">
                      <div class="flex justify-between">
                        <span class="text-text-sub">{t('admin.detail_customer_name')}:</span>
                        <span class="font-semibold text-text-main">
                          {selectedBookingDetail.value.customer.fullName || '—'}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-text-sub">{t('admin.detail_customer_phone')}:</span>
                        <span class="font-semibold text-text-main">
                          {selectedBookingDetail.value.customer.phone}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-text-sub">{t('admin.detail_customer_lang')}:</span>
                        <span class="font-semibold text-text-main uppercase">
                          {selectedBookingDetail.value.customer.preferredLanguage}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Provider Information Card */}
                  <div class="bg-background border border-border rounded-lg p-3.5 space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-text-sub">
                      {t('admin.provider_details')}
                    </h4>
                    {selectedBookingDetail.value.provider ? (
                      <div class="text-xs space-y-1.5">
                        <div class="flex justify-between">
                          <span class="text-text-sub">{t('admin.detail_provider_name')}:</span>
                          <span class="font-semibold text-text-main">
                            {selectedBookingDetail.value.provider.fullName || '—'}
                          </span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-text-sub">{t('admin.detail_provider_phone')}:</span>
                          <span class="font-semibold text-text-main">
                            {selectedBookingDetail.value.provider.phone}
                          </span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-text-sub">{t('admin.detail_provider_area')}:</span>
                          <span class="font-semibold text-text-main">
                            {selectedBookingDetail.value.provider.serviceArea}
                          </span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-text-sub">{t('admin.detail_provider_rating')}:</span>
                          <span class="font-semibold text-action">
                            ★ {selectedBookingDetail.value.provider.rating}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div class="py-3 text-center space-y-2">
                        <div>
                          <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-text-sub border border-slate-200">
                            {t('admin.not_assigned')}
                          </span>
                        </div>
                        {selectedBookingDetail.value.booking.status === 'SERVICE_REQUESTED' && (
                          <div class="pt-1">
                            <button
                              type="button"
                              onClick={openAssignModal}
                              class="min-h-[48px] px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <UserPlusIcon size={16} />
                              <span>{t('admin.assign_provider_btn')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Service & Booking Details Card */}
                <div class="bg-background border border-border rounded-lg p-3.5 space-y-3">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-text-sub">
                    {t('admin.service_details')}
                  </h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span class="text-text-sub block">{t('admin.detail_category')}:</span>
                      <span class="font-semibold text-text-main">
                        {lang === 'hi'
                          ? selectedBookingDetail.value.category.titleHi
                          : selectedBookingDetail.value.category.titleEn}
                      </span>
                    </div>

                    <div>
                      <span class="text-text-sub block">{t('admin.detail_locality')}:</span>
                      <span class="font-semibold text-text-main">
                        {selectedBookingDetail.value.booking.areaLocality}
                      </span>
                    </div>
                  </div>

                  {selectedBookingDetail.value.booking.landmark && (
                    <div class="text-xs">
                      <span class="text-text-sub block">{t('admin.detail_landmark')}:</span>
                      <span class="font-semibold text-text-main">
                        {selectedBookingDetail.value.booking.landmark}
                      </span>
                    </div>
                  )}

                  <div class="text-xs">
                    <span class="text-text-sub block">{t('admin.detail_description')}:</span>
                    <p class="text-text-main mt-1 bg-surface p-2.5 rounded border border-border">
                      {selectedBookingDetail.value.booking.textDescription ||
                        t('admin.detail_no_description')}
                    </p>
                  </div>

                  {/* 4 Explicit Booking Timestamps */}
                  <div class="pt-2 border-t border-border/60">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span class="text-text-sub block text-[11px]">
                          {t('admin.detail_created_time')}:
                        </span>
                        <span class="font-medium text-text-main">
                          {formatDateTime(
                            selectedBookingDetail.value.booking.timestamps.createdAt,
                            lang
                          )}
                        </span>
                      </div>

                      <div>
                        <span class="text-text-sub block text-[11px]">
                          {t('admin.detail_accepted_time')}:
                        </span>
                        <span class="font-medium text-text-main">
                          {selectedBookingDetail.value.booking.timestamps.acceptedAt
                            ? formatDateTime(
                                selectedBookingDetail.value.booking.timestamps.acceptedAt,
                                lang
                              )
                            : '—'}
                        </span>
                      </div>

                      <div>
                        <span class="text-text-sub block text-[11px]">
                          {t('admin.detail_started_time')}:
                        </span>
                        <span class="font-medium text-text-main">
                          {selectedBookingDetail.value.booking.timestamps.startedAt
                            ? formatDateTime(
                                selectedBookingDetail.value.booking.timestamps.startedAt,
                                lang
                              )
                            : '—'}
                        </span>
                      </div>

                      <div>
                        <span class="text-text-sub block text-[11px]">
                          {t('admin.detail_completed_time')}:
                        </span>
                        <span class="font-medium text-text-main">
                          {selectedBookingDetail.value.booking.timestamps.completedAt
                            ? formatDateTime(
                                selectedBookingDetail.value.booking.timestamps.completedAt,
                                lang
                              )
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Voice note / Audio Player */}
                  <div class="pt-2 border-t border-border/60">
                    <span class="text-xs font-bold text-text-sub block mb-1.5">
                      {t('admin.col_audio')}:
                    </span>
                    {selectedBookingDetail.value.booking.audioUrl ? (
                      <div class="flex items-center gap-3 bg-surface p-3 rounded-lg border border-border">
                        <button
                          onClick={() => toggleDetailAudio()}
                          class="min-h-[48px] min-w-[48px] px-3.5 py-2.5 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark flex items-center gap-1.5 transition-colors"
                          aria-label={
                            isPlayingDetailAudio.value
                              ? t('admin.pause_audio')
                              : t('admin.play_audio')
                          }
                        >
                          {isPlayingDetailAudio.value ? (
                            <>
                              <PauseIcon size={16} />
                              <span>{t('admin.pause_audio')}</span>
                            </>
                          ) : (
                            <>
                              <PlayIcon size={16} />
                              <span>{t('admin.play_audio')}</span>
                            </>
                          )}
                        </button>

                        <div class="text-xs text-text-sub">
                          {selectedBookingDetail.value.booking.audioDurationSeconds ? (
                            <span>
                              {selectedBookingDetail.value.booking.audioDurationSeconds}s audio
                            </span>
                          ) : (
                            <span>{t('admin.has_voice_note')}</span>
                          )}
                        </div>

                        {detailAudioError.value && (
                          <span class="text-xs text-danger ml-auto">
                            {detailAudioError.value}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span class="text-xs text-text-sub italic">
                        {t('admin.no_voice_note')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Read-Only Financial Summary */}
                <div class="bg-background border border-border rounded-lg p-3.5 space-y-2">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-text-sub">
                    {t('admin.financial_details')}
                  </h4>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span class="text-text-sub block">{t('admin.detail_visiting_fee')}:</span>
                      <span class="font-bold text-text-main text-sm">
                        ₹{selectedBookingDetail.value.booking.visitingFee}
                      </span>
                    </div>

                    <div>
                      <span class="text-text-sub block">{t('admin.detail_final_amount')}:</span>
                      <span class="font-bold text-text-main text-sm">
                        {selectedBookingDetail.value.booking.finalAmount !== null
                          ? `₹${selectedBookingDetail.value.booking.finalAmount}`
                          : t('admin.detail_not_set')}
                      </span>
                    </div>

                    <div>
                      <span class="text-text-sub block">{t('admin.detail_payment_method')}:</span>
                      <span class="font-semibold text-text-main">
                        {selectedBookingDetail.value.booking.paymentMethod}
                      </span>
                    </div>

                    <div>
                      <span class="text-text-sub block">{t('admin.detail_payment_status')}:</span>
                      <span>
                        {selectedBookingDetail.value.booking.paymentCollected ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-action">
                            {t('admin.paid')}
                          </span>
                        ) : (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700">
                            {t('admin.unpaid')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Progression Timeline */}
                <div class="bg-background border border-border rounded-lg p-3.5 space-y-3">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-text-sub">
                    {t('admin.status_timeline')}
                  </h4>
                  <div class="space-y-3 pl-2 border-l-2 border-border ml-1">
                    {selectedBookingDetail.value.timeline.map((item) => (
                      <div key={item.id} class="relative pl-3 space-y-0.5">
                        <div class="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-brand border-2 border-surface"></div>
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-bold text-text-main">
                            {item.fromStatus
                              ? `${getStatusLabel(item.fromStatus)} → ${getStatusLabel(item.toStatus)}`
                              : getStatusLabel(item.toStatus)}
                          </span>
                          <span class="text-[11px] text-text-sub">
                            {formatDateTime(item.createdAt, lang)}
                          </span>
                        </div>
                        <div class="text-[11px] text-text-sub flex items-center gap-1">
                          <span>{t('admin.detail_timeline_changed_by')}:</span>
                          <span class="font-medium text-text-main">
                            {item.changedBy?.name || (item.changedBy ? getRoleLabel(item.changedBy.role) : 'System')}
                          </span>
                          {item.changedBy && (
                            <span class="px-1.5 py-0.2 rounded bg-slate-200 text-[10px] uppercase font-semibold">
                              {getRoleLabel(item.changedBy.role)}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div class="text-xs bg-surface p-2 rounded border border-border mt-1">
                            <span class="font-semibold text-text-sub block text-[10px]">
                              {t('admin.detail_timeline_notes')}:
                            </span>
                            <span class="text-text-main">{item.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            {!isDetailLoading.value && selectedBookingDetail.value && (
              <div class="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {selectedBookingDetail.value.booking.status === 'SERVICE_REQUESTED' &&
                    !selectedBookingDetail.value.provider && (
                      <button
                        type="button"
                        onClick={openAssignModal}
                        class="min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
                      >
                        <UserPlusIcon size={16} />
                        <span>{t('admin.assign_provider_btn')}</span>
                      </button>
                    )}

                  {canTransition(
                    selectedBookingDetail.value.booking.status,
                    'CANCELLED_BY_ADMIN',
                    'admin'
                  ) && (
                    <button
                      type="button"
                      onClick={openCancelModal}
                      class="min-h-[48px] px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors w-full sm:w-auto"
                    >
                      {t('admin.cancel_booking_btn')}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={closeBookingDetail}
                  class="min-h-[48px] px-5 py-2.5 bg-background hover:bg-slate-100 border border-border text-text-main text-xs font-semibold rounded-lg transition-colors w-full sm:w-auto"
                >
                  {t('admin.close_modal')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {isCancelModalOpen.value && (
        <div class="fixed inset-0 z-60 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="relative bg-surface border border-border rounded-xl max-w-lg w-full p-5 md:p-6 shadow-2xl space-y-4">
            {/* Title & Warning */}
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center shrink-0">
                <AlertCircleIcon size={22} />
              </div>
              <div>
                <h3 class="text-base font-bold text-text-main">
                  {t('admin.cancel_modal_title')}
                </h3>
                <p class="text-xs text-text-sub mt-1">
                  {t('admin.cancel_modal_desc')}
                </p>
              </div>
            </div>

            {/* Form Error Banner */}
            {cancelError.value && (
              <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2">
                <AlertCircleIcon size={16} class="shrink-0 mt-0.5" />
                <span>{cancelError.value}</span>
              </div>
            )}

            {/* Textarea for Reason */}
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-text-main">
                {t('admin.cancel_reason_label')}
              </label>
              <textarea
                rows={3}
                value={cancelReason.value}
                onInput={(e) => {
                  cancelReason.value = (e.target as HTMLTextAreaElement).value;
                  cancelReasonError.value = null;
                }}
                maxLength={255}
                placeholder={t('admin.cancel_reason_placeholder')}
                class={`w-full p-3 bg-background border rounded-lg text-xs text-text-main focus:outline-none focus:ring-2 ${
                  cancelReasonError.value
                    ? 'border-danger focus:ring-danger'
                    : 'border-border focus:ring-brand'
                }`}
              />
              <div class="flex justify-between items-center text-[11px]">
                {cancelReasonError.value ? (
                  <span class="text-danger font-medium">{cancelReasonError.value}</span>
                ) : (
                  <span></span>
                )}
                <span class="text-text-sub ml-auto">
                  {t('admin.cancel_reason_char_count', {
                    count: cancelReason.value.length,
                  })}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div class="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={isCancelling.value}
                class="min-h-[48px] px-4 py-2.5 bg-background hover:bg-slate-100 border border-border text-text-main text-xs font-semibold rounded-lg transition-colors w-full sm:w-auto"
              >
                {t('admin.cancel')}
              </button>

              <button
                type="button"
                onClick={() => submitCancelBooking()}
                disabled={isCancelling.value}
                class="min-h-[48px] px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
              >
                {isCancelling.value ? (
                  <>
                    <SpinnerIcon size={14} class="animate-spin" />
                    <span>{t('admin.cancelling')}</span>
                  </>
                ) : (
                  <span>{t('admin.cancel_confirm_btn')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Assignment Modal */}
      {isAssignModalOpen.value && selectedBookingDetail.value && (
        <div class="fixed inset-0 z-60 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="relative bg-surface border border-border rounded-xl max-w-xl w-full p-5 md:p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div class="flex items-start justify-between pb-3 border-b border-border shrink-0">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <UserPlusIcon size={20} />
                </div>
                <div>
                  <h3 class="text-base font-bold text-text-main">
                    {t('admin.assign_modal_title')}
                  </h3>
                  <p class="text-xs text-text-sub mt-0.5">
                    {t('admin.assign_modal_desc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={isAssigning.value}
                class="min-h-[48px] min-w-[48px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center"
                aria-label={t('admin.close_modal')}
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Booking Context Banner */}
            <div class="bg-background border border-border rounded-lg p-3 shrink-0 text-xs space-y-2">
              <div class="text-[11px] font-bold uppercase tracking-wider text-text-sub">
                {t('admin.assign_booking_context')} (
                <span class="font-mono text-text-main font-semibold">
                  #{selectedBookingDetail.value.booking.id.slice(0, 8)}
                </span>
                )
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span class="text-text-sub block text-[11px]">{t('admin.assign_category_label')}:</span>
                  <span class="font-semibold text-text-main">
                    {lang === 'hi'
                      ? selectedBookingDetail.value.category.titleHi
                      : selectedBookingDetail.value.category.titleEn}
                  </span>
                </div>
                <div>
                  <span class="text-text-sub block text-[11px]">{t('admin.assign_location_label')}:</span>
                  <span class="font-semibold text-text-main">
                    {selectedBookingDetail.value.booking.areaLocality}
                  </span>
                </div>
                {selectedBookingDetail.value.booking.landmark && (
                  <div class="col-span-2 sm:col-span-1">
                    <span class="text-text-sub block text-[11px]">{t('admin.detail_landmark')}:</span>
                    <span class="font-semibold text-text-main truncate block">
                      {selectedBookingDetail.value.booking.landmark}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {assignError.value && (
              <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2 shrink-0">
                <AlertCircleIcon size={16} class="shrink-0 mt-0.5" />
                <span>{assignError.value}</span>
              </div>
            )}

            {/* Search Provider Input */}
            <div class="relative shrink-0">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub">
                <SearchIcon size={16} />
              </div>
              <input
                type="text"
                value={assignSearchQuery.value}
                onInput={(e) => {
                  assignSearchQuery.value = (e.target as HTMLInputElement).value;
                }}
                placeholder={t('admin.assign_search_placeholder')}
                class="w-full pl-9 pr-8 py-2.5 bg-background border border-border rounded-lg text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-brand min-h-[48px]"
              />
              {assignSearchQuery.value && (
                <button
                  type="button"
                  onClick={() => {
                    assignSearchQuery.value = '';
                  }}
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-text-sub hover:text-text-main min-h-[48px] min-w-[48px] justify-center"
                  aria-label="Clear search"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Provider List Area (Scrollable) */}
            <div class="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isAssignProvidersLoading.value ? (
                <div class="py-12 text-center text-text-sub space-y-3">
                  <SpinnerIcon size={24} class="animate-spin mx-auto text-brand" />
                  <p class="text-xs">{t('admin.assign_loading_providers')}</p>
                </div>
              ) : assignProvidersError.value ? (
                <div class="py-8 text-center space-y-3">
                  <p class="text-xs text-danger">{assignProvidersError.value}</p>
                  <button
                    type="button"
                    onClick={loadAssignableProviders}
                    class="min-h-[48px] px-4 py-2 bg-background hover:bg-slate-100 border border-border text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshIcon size={14} />
                    <span>{t('admin.assign_retry')}</span>
                  </button>
                </div>
              ) : filteredAssignableProviders.value.length === 0 ? (
                <div class="py-10 text-center text-text-sub space-y-2">
                  <AlertCircleIcon size={24} class="mx-auto opacity-50" />
                  <p class="text-xs">{t('admin.assign_no_providers_found')}</p>
                </div>
              ) : (
                filteredAssignableProviders.value.map((provider) => {
                  const isSelected = assignSelectedProviderId.value === provider.id;
                  const isMatchingCategory =
                    provider.categoryId === selectedBookingDetail.value?.category.id;
                  const isVerified = provider.verificationStatus === 'VERIFIED';
                  const isBusy = (provider.activeBookingsCount ?? 0) > 0;
                  const isSelectable =
                    provider.isActive && provider.isAvailable && isMatchingCategory && isVerified && !isBusy;

                  return (
                    <label
                      key={provider.id}
                      onClick={() => {
                        if (isSelectable) {
                          setAssignSelectedProvider(provider.id);
                        }
                      }}
                      class={`min-h-[48px] p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                        !isSelectable
                          ? 'opacity-60 cursor-not-allowed bg-slate-50/80 border-slate-200'
                          : isSelected
                          ? 'border-brand bg-brand/5 ring-1 ring-brand cursor-pointer'
                          : 'border-border bg-background hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div class="flex items-center gap-3">
                        <input
                          type="radio"
                          name="assignedProvider"
                          value={provider.id}
                          checked={isSelected}
                          disabled={!isSelectable}
                          onChange={() => {
                            if (isSelectable) {
                              setAssignSelectedProvider(provider.id);
                            }
                          }}
                          class={`w-4 h-4 text-brand border-border focus:ring-brand accent-brand ${
                            !isSelectable ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-text-main">
                              {provider.fullName || '—'}
                            </span>
                            {/* Matching Category Badge */}
                            {isMatchingCategory ? (
                              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-brand border border-blue-200">
                                {t('admin.assign_matching_category')}
                              </span>
                            ) : (
                              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-text-sub border border-slate-200">
                                {lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn}
                              </span>
                            )}
                          </div>
                          <div class="text-[11px] text-text-sub flex items-center gap-2 mt-0.5">
                            <span>{provider.phone}</span>
                            <span>•</span>
                            <span>{provider.serviceArea}</span>
                            <span>•</span>
                            <span class="text-action font-semibold">★ {provider.rating}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div class="flex flex-col items-end gap-1 shrink-0">
                        {!isVerified ? (
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            {provider.verificationStatus === 'REJECTED'
                              ? t('admin.filter_rejected')
                              : t('admin.status_pending_verification')}
                          </span>
                        ) : isBusy ? (
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {t('admin.assign_busy')}
                          </span>
                        ) : (
                          <span
                            class={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              provider.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {provider.isAvailable
                              ? t('admin.assign_available')
                              : t('admin.assign_busy')}
                          </span>
                        )}
                        {!provider.isActive && (
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            {t('admin.assign_inactive')}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Actions Footer */}
            <div class="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={isAssigning.value}
                class="min-h-[48px] px-4 py-2.5 bg-background hover:bg-slate-100 border border-border text-text-main text-xs font-semibold rounded-lg transition-colors w-full sm:w-auto"
              >
                {t('admin.cancel')}
              </button>

              <button
                type="button"
                onClick={() => submitAssignProvider()}
                disabled={!assignSelectedProviderId.value || isAssigning.value}
                class="min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
              >
                {isAssigning.value ? (
                  <>
                    <SpinnerIcon size={14} class="animate-spin" />
                    <span>{t('admin.assign_confirming_btn')}</span>
                  </>
                ) : (
                  <>
                    <CheckIcon size={14} />
                    <span>{t('admin.assign_confirm_btn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
