import { useEffect, useState, useRef } from 'preact/hooks';
import { currentLanguage, t } from '../state/language';
import { categories, fetchCategories } from '../state/categories';
import { authToken, handleSessionExpired } from '../state/auth';
import {
  providersList,
  isProvidersLoading,
  providersError,
  providerSearchQuery,
  providerStatusFilter,
  providerCategoryFilter,
  filteredProviders,
  isAddModalOpen,
  isEditModalOpen,
  editingProvider,
  isReviewModalOpen,
  reviewingProvider,
  isVerifyingWorker,
  verifyError,
  isFormSubmitting,
  formError,
  formSuccessMessage,
  deactivatingProvider,
  isDeactivating,
  deactivationError,
  statusTogglingId,
  addFullName,
  addPhone,
  addCategoryId,
  addPreferredLanguage,
  addServiceArea,
  editFullName,
  editCategoryId,
  editPreferredLanguage,
  editServiceArea,
  fetchAdminProviders,
  openAddModal,
  closeAddModal,
  submitAddProvider,
  openEditModal,
  closeEditModal,
  submitEditProvider,
  openReviewModal,
  closeReviewModal,
  verifyWorkerProvider,
  isRejectModalOpen,
  rejectingReason,
  isRejectingWorker,
  rejectError,
  openRejectModal,
  closeRejectModal,
  rejectWorkerProvider,
  viewingDocument,
  openDocumentViewer,
  closeDocumentViewer,
  openDeactivateModal,
  closeDeactivateModal,
  confirmDeactivation,
  activateProvider,
  clearSuccessMessage,
} from '../state/admin-providers';
import {
  ToolIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  RefreshIcon,
  XIcon,
  PhoneIcon,
  FileTextIcon,
  ImageIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  RotateCcwIcon,
} from './icons';

interface AuthenticatedDocumentPreviewProps {
  url: string;
  title: string;
  hasDocument: boolean;
  lang: string;
}

function AuthenticatedDocumentPreview({
  url,
  title,
  hasDocument,
  lang,
}: AuthenticatedDocumentPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const blobUrlRef = useRef<string | null>(null);

  const fetchDocument = () => {
    if (!hasDocument) {
      setBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    const token = authToken.value;
    if (!token) return;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setLoading(true);
    setError(false);

    let active = true;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleSessionExpired();
          throw new Error('UNAUTHORIZED');
        }
        if (!res.ok) {
          throw new Error('FAILED');
        }
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err.message !== 'UNAUTHORIZED') {
          setError(true);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  };

  useEffect(() => {
    const cancel = fetchDocument();
    return () => {
      if (cancel) cancel();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, hasDocument]);

  return (
    <div class="border border-border rounded-lg bg-surface overflow-hidden flex flex-col shadow-2xs">
      <div class="px-3 py-2 bg-slate-100 border-b border-border flex items-center justify-between">
        <span class="text-xs font-bold text-text-main truncate">{title}</span>
        {hasDocument ? (
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-action">
            {lang === 'hi' ? 'अपलोड किया गया' : 'Uploaded'}
          </span>
        ) : (
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-text-sub">
            {t('admin.doc_not_available')}
          </span>
        )}
      </div>

      <div class="p-3 flex-1 flex flex-col items-center justify-center min-h-[170px] bg-slate-50/50">
        {!hasDocument && (
          <div class="text-center p-4 text-text-sub">
            <ImageIcon size={32} class="mx-auto mb-1.5 text-slate-400" />
            <span class="text-xs font-medium">{t('admin.doc_not_available')}</span>
          </div>
        )}

        {hasDocument && loading && (
          <div class="text-center p-4">
            <SpinnerIcon size={24} class="animate-spin text-brand mx-auto mb-2" />
            <span class="text-xs text-text-sub font-medium">{t('admin.doc_loading')}</span>
          </div>
        )}

        {hasDocument && !loading && error && (
          <div class="text-center p-3">
            <AlertCircleIcon size={24} class="text-danger mx-auto mb-1.5" />
            <span class="text-xs text-danger block mb-2 font-medium">{t('admin.doc_load_error')}</span>
            <button
              type="button"
              onClick={fetchDocument}
              class="px-2.5 py-1 text-xs font-semibold bg-white border border-border rounded hover:bg-slate-50 text-text-main inline-flex items-center gap-1 shadow-2xs"
            >
              <RefreshIcon size={12} />
              <span>{t('admin.retry')}</span>
            </button>
          </div>
        )}

        {hasDocument && !loading && !error && blobUrl && (
          <div class="w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => openDocumentViewer(title, url, blobUrl)}
              class="group relative w-full overflow-hidden rounded border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
              aria-label={`${t('admin.view_document')}: ${title}`}
            >
              <img
                src={blobUrl}
                alt={title}
                class="max-h-48 w-full object-contain transition-transform duration-200 group-hover:scale-102"
              />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <span class="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/85 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                  <MaximizeIcon size={14} />
                  <span>{t('admin.view_document')}</span>
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openDocumentViewer(title, url, blobUrl)}
              class="mt-2.5 w-full min-h-[38px] py-1.5 px-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-border text-text-main text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <MaximizeIcon size={14} />
              <span>{t('admin.view_document')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentZoomViewerProps {
  title: string;
  url: string;
  initialBlobUrl: string | null;
  lang: string;
}

function DocumentZoomViewer({ title, url, initialBlobUrl, lang }: DocumentZoomViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string | null>(initialBlobUrl);
  const [loading, setLoading] = useState<boolean>(!initialBlobUrl);
  const [loadError, setLoadError] = useState<boolean>(false);

  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const localBlobRef = useRef<string | null>(null);

  // Fallback fetch if initialBlobUrl was not provided
  useEffect(() => {
    if (initialBlobUrl) {
      setResolvedBlobUrl(initialBlobUrl);
      setLoading(false);
      return;
    }
    const token = authToken.value;
    if (!token) return;

    let active = true;
    setLoading(true);
    setLoadError(false);

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('FAILED');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const bUrl = URL.createObjectURL(blob);
        localBlobRef.current = bUrl;
        setResolvedBlobUrl(bUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current);
        localBlobRef.current = null;
      }
    };
  }, [url, initialBlobUrl]);

  // Lock body scroll while viewer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const zoomIn = () => {
    setScale((prev) => Math.min(Number((prev + 0.5).toFixed(2)), 4));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(Number((prev - 0.5).toFixed(2)), 0.5);
      if (next <= 1) setPos({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  // Keyboard navigation (Esc, +, -, 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDocumentViewer();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mouse pan handlers
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  // Touch pan & Pinch zoom
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1) {
      touchStartPos.current = {
        x: e.touches[0].clientX - pos.x,
        y: e.touches[0].clientY - pos.y,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastTouchDist.current;
      lastTouchDist.current = dist;
      setScale((prev) => Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.5), 4));
    } else if (e.touches.length === 1 && touchStartPos.current && isDragging) {
      setPos({
        x: e.touches[0].clientX - touchStartPos.current.x,
        y: e.touches[0].clientY - touchStartPos.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDist.current = null;
    touchStartPos.current = null;
    setIsDragging(false);
  };

  return (
    <div
      class="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDocumentViewer();
      }}
    >
      {/* Top Header */}
      <div class="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0 z-10 text-white">
        <div class="flex items-center gap-3">
          <span class="font-bold text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            {title}
          </span>
          <span class="hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {t('admin.doc_viewer_title')}
          </span>
        </div>

        <button
          type="button"
          onClick={closeDocumentViewer}
          class="min-h-[44px] min-w-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg flex items-center gap-1.5 transition-colors text-xs font-semibold cursor-pointer"
          aria-label={t('admin.close_viewer')}
        >
          <XIcon size={18} />
          <span class="hidden sm:inline">{t('admin.close_viewer')}</span>
        </button>
      </div>

      {/* Main Image Viewport */}
      <div
        class="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4 touch-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDblClick={() => {
          if (scale > 1) resetZoom();
          else zoomIn();
        }}
      >
        {loading && (
          <div class="text-center p-6 text-white">
            <SpinnerIcon size={32} class="animate-spin text-brand-light mx-auto mb-2" />
            <span class="text-xs font-medium text-slate-300">{t('admin.doc_loading')}</span>
          </div>
        )}

        {loadError && (
          <div class="text-center p-6 text-white bg-slate-900 border border-red-500/30 rounded-xl max-w-sm">
            <AlertCircleIcon size={32} class="text-red-400 mx-auto mb-2" />
            <span class="text-xs text-red-300 block mb-3 font-medium">{t('admin.doc_load_error')}</span>
            <button
              type="button"
              onClick={closeDocumentViewer}
              class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              {t('admin.close_viewer')}
            </button>
          </div>
        )}

        {!loading && !loadError && resolvedBlobUrl && (
          <img
            src={resolvedBlobUrl}
            alt={title}
            draggable={false}
            class="pointer-events-auto select-none rounded shadow-2xl transition-transform"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out',
              maxWidth: '92vw',
              maxHeight: '76vh',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {/* Bottom Floating Controls Bar */}
      <div class="p-4 flex items-center justify-center shrink-0 z-10 pointer-events-none">
        <div class="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 rounded-xl px-3 py-2 flex items-center gap-2 sm:gap-3 shadow-xl">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            class="min-h-[44px] min-w-[44px] p-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold cursor-pointer"
            aria-label={t('admin.zoom_out')}
          >
            <ZoomOutIcon size={18} />
            <span class="hidden md:inline">{t('admin.zoom_out')}</span>
          </button>

          {/* Scale Badge */}
          <span class="px-2.5 py-1 font-mono text-xs font-bold text-amber-400 bg-slate-950 rounded-md border border-slate-800 min-w-[54px] text-center">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 4}
            class="min-h-[44px] min-w-[44px] p-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold cursor-pointer"
            aria-label={t('admin.zoom_in')}
          >
            <ZoomInIcon size={18} />
            <span class="hidden md:inline">{t('admin.zoom_in')}</span>
          </button>

          <div class="h-5 w-px bg-slate-700 mx-0.5 sm:mx-1"></div>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={resetZoom}
            class="min-h-[44px] min-w-[44px] px-2.5 py-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
            aria-label={t('admin.zoom_reset')}
          >
            <RotateCcwIcon size={16} />
            <span>{t('admin.zoom_reset')}</span>
          </button>

          <div class="h-5 w-px bg-slate-700 mx-0.5 sm:mx-1"></div>

          {/* Close */}
          <button
            type="button"
            onClick={closeDocumentViewer}
            class="min-h-[44px] min-w-[44px] px-2.5 py-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
            aria-label={t('admin.close_viewer')}
          >
            <XIcon size={16} />
            <span>{t('admin.close_viewer')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminProvidersView() {
  const lang = currentLanguage.value || 'en';
  const list = filteredProviders.value;
  const totalCount = providersList.value.length;
  const loading = isProvidersLoading.value;
  const error = providersError.value;
  const successMsg = formSuccessMessage.value;
  const cats = categories.value;

  useEffect(() => {
    fetchAdminProviders();
    if (cats.length === 0) {
      fetchCategories();
    }
  }, []);

  const handleClearFilters = () => {
    providerSearchQuery.value = '';
    providerStatusFilter.value = 'all';
    providerCategoryFilter.value = 'all';
  };

  return (
    <div class="space-y-6">
      {/* Top Header Section */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-text-main">
            {t('admin.providers_title')}
          </h2>
          <p class="text-sm text-text-sub mt-0.5">
            {t('admin.providers_subtitle')}
          </p>
        </div>

        {/* Add Provider Button */}
        <div>
          <button
            onClick={() => openAddModal(cats[0]?.id)}
            class="min-h-[48px] px-4 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
            aria-label={t('admin.add_provider')}
          >
            <PlusIcon size={18} />
            <span>{t('admin.add_provider')}</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div class="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between gap-3 text-action shadow-xs animate-fadeIn">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckIcon size={16} />
            </div>
            <span class="text-sm font-semibold">{successMsg}</span>
          </div>
          <button
            onClick={clearSuccessMessage}
            class="min-h-[44px] min-w-[44px] p-2 text-action/70 hover:text-action rounded-lg flex items-center justify-center"
            aria-label="Dismiss"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && !loading && (
        <div class="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-danger shadow-xs">
          <div class="flex items-start gap-2.5">
            <AlertCircleIcon size={20} class="shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchAdminProviders()}
            class="min-h-[44px] px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-main hover:bg-background flex items-center gap-1.5 shrink-0"
          >
            <RefreshIcon size={14} />
            <span>{t('admin.retry')}</span>
          </button>
        </div>
      )}

      {/* Controls Bar: Search & Filters */}
      <div class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div class="md:col-span-6 relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub">
              <SearchIcon size={18} />
            </div>
            <input
              type="text"
              value={providerSearchQuery.value}
              onInput={(e) => {
                providerSearchQuery.value = (e.target as HTMLInputElement).value;
              }}
              placeholder={t('admin.search_placeholder')}
              class="w-full min-h-[48px] pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-main placeholder-text-sub/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>

          {/* Status Filter */}
          <div class="md:col-span-3">
            <select
              value={providerStatusFilter.value}
              onChange={(e) => {
                providerStatusFilter.value = (e.target as HTMLSelectElement).value as any;
              }}
              class="w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              aria-label="Filter by status"
            >
              <option value="all">{t('admin.filter_all')}</option>
              <option value="pending">{t('admin.filter_pending')}</option>
              <option value="active">{t('admin.filter_active')}</option>
              <option value="inactive">{t('admin.filter_inactive')}</option>
              <option value="rejected">{t('admin.filter_rejected')}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div class="md:col-span-3">
            <select
              value={providerCategoryFilter.value}
              onChange={(e) => {
                providerCategoryFilter.value = (e.target as HTMLSelectElement).value;
              }}
              class="w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              aria-label="Filter by category"
            >
              <option value="all">{t('admin.filter_category_all')}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'hi' ? c.titleHi : c.titleEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div class="bg-surface border border-border rounded-lg p-12 text-center shadow-xs">
          <div class="flex flex-col items-center justify-center gap-3">
            <SpinnerIcon size={32} class="text-brand animate-spin" />
            <p class="text-sm font-medium text-text-sub">{t('admin.loading')}</p>
          </div>
        </div>
      )}

      {/* Empty State: Zero registered providers */}
      {!loading && totalCount === 0 && (
        <div class="bg-surface border border-border rounded-lg p-10 text-center shadow-xs">
          <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-text-sub">
            <ToolIcon size={28} />
          </div>
          <h3 class="text-base font-bold text-text-main mb-1">
            {t('admin.no_providers_registered')}
          </h3>
          <p class="text-sm text-text-sub max-w-md mx-auto mb-6">
            {t('admin.no_providers_registered_desc')}
          </p>
          <button
            onClick={() => openAddModal(cats[0]?.id)}
            class="min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors"
          >
            <PlusIcon size={18} />
            <span>{t('admin.add_provider')}</span>
          </button>
        </div>
      )}

      {/* Empty State: Search/Filter produced zero results */}
      {!loading && totalCount > 0 && list.length === 0 && (
        <div class="bg-surface border border-border rounded-lg p-8 text-center shadow-xs">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-text-sub">
            <SearchIcon size={24} />
          </div>
          <h3 class="text-base font-semibold text-text-main mb-1">
            {t('admin.no_providers_match')}
          </h3>
          <p class="text-xs text-text-sub mb-4">
            {t('admin.search_placeholder')}
          </p>
          <button
            onClick={handleClearFilters}
            class="min-h-[48px] px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors"
          >
            {t('admin.clear_filters')}
          </button>
        </div>
      )}

      {/* Provider List (Desktop Table View) */}
      {!loading && list.length > 0 && (
        <div class="hidden md:block bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-border text-xs font-bold text-text-sub uppercase tracking-wider">
                <th class="py-3.5 px-4">{t('admin.col_name')}</th>
                <th class="py-3.5 px-4">{t('admin.col_phone')}</th>
                <th class="py-3.5 px-4">{t('admin.col_category')}</th>
                <th class="py-3.5 px-4">{t('admin.col_area')}</th>
                <th class="py-3.5 px-4">{t('admin.col_status')}</th>
                <th class="py-3.5 px-4">{t('admin.col_availability')}</th>
                <th class="py-3.5 px-4 text-right">{t('admin.col_actions')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-sm">
              {list.map((provider) => {
                const categoryTitle =
                  lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
                const isToggling = statusTogglingId.value === provider.id;
                const isPending = provider.verificationStatus === 'PENDING_VERIFICATION';
                const isRejected = provider.verificationStatus === 'REJECTED';

                return (
                  <tr
                    key={provider.id}
                    class={`transition-colors ${
                      isPending
                        ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                        : isRejected
                        ? 'bg-red-50/60 hover:bg-red-100/60 border-l-4 border-l-red-500'
                        : 'hover:bg-slate-50/75'
                    }`}
                  >
                    {/* Name */}
                    <td class="py-3.5 px-4 font-semibold text-text-main">
                      {provider.fullName || '—'}
                    </td>

                    {/* Phone */}
                    <td class="py-3.5 px-4 font-mono text-xs text-text-main">
                      {provider.phone}
                    </td>

                    {/* Category */}
                    <td class="py-3.5 px-4">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-brand border border-blue-200">
                        {categoryTitle}
                      </span>
                    </td>

                    {/* Service Area */}
                    <td class="py-3.5 px-4 text-text-sub text-xs">
                      {provider.serviceArea}
                    </td>

                    {/* Status Column */}
                    <td class="py-3.5 px-4">
                      {isPending ? (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse"></span>
                          <span>{t('admin.status_pending_verification')}</span>
                        </span>
                      ) : isRejected ? (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs">
                          <span class="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                          <span>{t('admin.filter_rejected')}</span>
                        </span>
                      ) : provider.isActive ? (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-action border border-green-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-action inline-block"></span>
                          <span>{t('admin.status_active')}</span>
                        </span>
                      ) : (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-danger border border-red-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-danger inline-block"></span>
                          <span>{t('admin.status_inactive')}</span>
                        </span>
                      )}
                    </td>

                    {/* Availability */}
                    <td class="py-3.5 px-4">
                      {isPending ? (
                        <span class="text-xs font-medium text-amber-700">
                          {t('admin.status_pending_verification')}
                        </span>
                      ) : isRejected ? (
                        <span class="text-xs font-medium text-red-700">
                          {t('admin.filter_rejected')}
                        </span>
                      ) : provider.isAvailable ? (
                        <span class="text-xs font-medium text-text-main">
                          {t('admin.available')}
                        </span>
                      ) : (
                        <span class="text-xs font-medium text-text-sub">
                          {t('admin.unavailable')}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td class="py-3.5 px-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        {isPending || isRejected ? (
                          <button
                            onClick={() => openReviewModal(provider)}
                            class={`min-h-[48px] px-3.5 py-2 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors ${
                              isRejected
                                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                                : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                            }`}
                            title={t('admin.review_application')}
                          >
                            <FileTextIcon size={14} />
                            <span>{t('admin.review_application')}</span>
                          </button>
                        ) : (
                          <>
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(provider)}
                              class="min-h-[48px] px-3 py-2 bg-white border border-border hover:bg-background rounded-lg text-xs font-semibold text-text-main flex items-center gap-1.5 transition-colors"
                              title={t('admin.edit')}
                            >
                              <EditIcon size={14} />
                              <span>{t('admin.edit')}</span>
                            </button>

                            {/* Status Toggle Action */}
                            {provider.isActive ? (
                              <button
                                onClick={() => openDeactivateModal(provider)}
                                disabled={isToggling}
                                class="min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {isToggling ? (
                                  <SpinnerIcon size={14} class="animate-spin inline" />
                                ) : (
                                  <span>{t('admin.deactivate')}</span>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => activateProvider(provider)}
                                disabled={isToggling}
                                class="min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {isToggling ? (
                                  <SpinnerIcon size={14} class="animate-spin inline" />
                                ) : (
                                  <span>{t('admin.activate')}</span>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider List (Mobile Card View) */}
      {!loading && list.length > 0 && (
        <div class="block md:hidden space-y-3">
          {list.map((provider) => {
            const categoryTitle =
              lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
            const isToggling = statusTogglingId.value === provider.id;
            const isPending = provider.verificationStatus === 'PENDING_VERIFICATION';
            const isRejected = provider.verificationStatus === 'REJECTED';

            return (
              <div
                key={provider.id}
                class={`bg-surface border rounded-lg p-4 shadow-xs space-y-3 ${
                  isPending
                    ? 'border-amber-400 bg-amber-50/25 ring-1 ring-amber-300'
                    : isRejected
                    ? 'border-red-400 bg-red-50/25 ring-1 ring-red-300'
                    : 'border-border'
                }`}
              >
                {/* Header: Name and Status */}
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-bold text-base text-text-main leading-tight">
                      {provider.fullName || '—'}
                    </h4>
                    <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-blue-50 text-brand border border-blue-200">
                      {categoryTitle}
                    </span>
                  </div>

                  {isPending ? (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse"></span>
                      <span>{t('admin.status_pending_verification')}</span>
                    </span>
                  ) : isRejected ? (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                      <span>{t('admin.filter_rejected')}</span>
                    </span>
                  ) : provider.isActive ? (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-action border border-green-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-action inline-block"></span>
                      <span>{t('admin.status_active')}</span>
                    </span>
                  ) : (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-danger border border-red-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-danger inline-block"></span>
                      <span>{t('admin.status_inactive')}</span>
                    </span>
                  )}
                </div>

                {/* Info Grid */}
                <div class="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div>
                    <span class="text-text-sub block">{t('admin.col_phone')}</span>
                    <span class="font-mono text-text-main font-medium">{provider.phone}</span>
                  </div>
                  <div>
                    <span class="text-text-sub block">{t('admin.col_area')}</span>
                    <span class="text-text-main font-medium">{provider.serviceArea}</span>
                  </div>
                </div>

                {/* Actions */}
                <div class="pt-1">
                  {isPending || isRejected ? (
                    <button
                      onClick={() => openReviewModal(provider)}
                      class={`w-full min-h-[48px] px-4 py-2.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors ${
                        isRejected
                          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                          : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                      }`}
                    >
                      <FileTextIcon size={16} />
                      <span>{t('admin.review_application')}</span>
                    </button>
                  ) : (
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openEditModal(provider)}
                        class="min-h-[48px] px-3 py-2 bg-white border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-background flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <EditIcon size={16} />
                        <span>{t('admin.edit')}</span>
                      </button>

                      {provider.isActive ? (
                        <button
                          onClick={() => openDeactivateModal(provider)}
                          disabled={isToggling}
                          class="min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                          {isToggling ? (
                            <SpinnerIcon size={16} class="animate-spin" />
                          ) : (
                            <span>{t('admin.deactivate')}</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => activateProvider(provider)}
                          disabled={isToggling}
                          class="min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                          {isToggling ? (
                            <SpinnerIcon size={16} class="animate-spin" />
                          ) : (
                            <span>{t('admin.activate')}</span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================== */}
      {/* ADD PROVIDER MODAL                                 */}
      {/* ================================================== */}
      {isAddModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 class="text-base font-bold text-text-main">
                {t('admin.add_provider')}
              </h3>
              <button
                onClick={closeAddModal}
                disabled={isFormSubmitting.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAddProvider();
              }}
              class="p-6 space-y-4"
            >
              {/* Error Alert */}
              {formError.value && (
                <div class="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{formError.value}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_full_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={addFullName.value}
                  onInput={(e) => {
                    addFullName.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_full_name_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_phone')} *
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub font-mono text-xs font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addPhone.value}
                    onInput={(e) => {
                      // Only allow digits
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 10);
                      addPhone.value = val;
                    }}
                    placeholder={t('admin.field_phone_placeholder')}
                    class="w-full min-h-[48px] pl-12 pr-3.5 py-2.5 bg-background border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
              </div>

              {/* Service Category */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_category')} *
                </label>
                <select
                  required
                  value={addCategoryId.value}
                  onChange={(e) => {
                    addCategoryId.value = (e.target as HTMLSelectElement).value;
                  }}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="" disabled>
                    {t('admin.field_select_category')}
                  </option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'hi' ? c.titleHi : c.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Language */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_preferred_language')}
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="add_lang"
                      value="hi"
                      checked={addPreferredLanguage.value === 'hi'}
                      onChange={() => {
                        addPreferredLanguage.value = 'hi';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_hindi')}
                    </span>
                  </label>
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="add_lang"
                      value="en"
                      checked={addPreferredLanguage.value === 'en'}
                      onChange={() => {
                        addPreferredLanguage.value = 'en';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_english')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Service Area */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_service_area')}
                </label>
                <input
                  type="text"
                  value={addServiceArea.value}
                  onInput={(e) => {
                    addServiceArea.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_service_area_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Modal Actions */}
              <div class="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isFormSubmitting.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.creating')}</span>
                    </>
                  ) : (
                    <span>{t('admin.add_provider')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* EDIT PROVIDER MODAL                                */}
      {/* ================================================== */}
      {isEditModalOpen.value && editingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 class="text-base font-bold text-text-main">
                {t('admin.edit_provider')}
              </h3>
              <button
                onClick={closeEditModal}
                disabled={isFormSubmitting.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitEditProvider();
              }}
              class="p-6 space-y-4"
            >
              {/* Error Alert */}
              {formError.value && (
                <div class="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{formError.value}</span>
                </div>
              )}

              {/* Phone (READ-ONLY) */}
              <div>
                <label class="block text-xs font-bold text-text-sub uppercase tracking-wider mb-1.5">
                  {t('admin.field_phone')} ({t('admin.field_phone_readonly_hint')})
                </label>
                <input
                  type="text"
                  disabled
                  value={editingProvider.value.phone}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-slate-100 border border-border rounded-lg text-sm font-mono text-text-sub cursor-not-allowed"
                />
              </div>

              {/* Full Name */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_full_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName.value}
                  onInput={(e) => {
                    editFullName.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_full_name_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Service Category */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_category')} *
                </label>
                <select
                  required
                  value={editCategoryId.value}
                  onChange={(e) => {
                    editCategoryId.value = (e.target as HTMLSelectElement).value;
                  }}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'hi' ? c.titleHi : c.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Language */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_preferred_language')}
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="edit_lang"
                      value="hi"
                      checked={editPreferredLanguage.value === 'hi'}
                      onChange={() => {
                        editPreferredLanguage.value = 'hi';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_hindi')}
                    </span>
                  </label>
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="edit_lang"
                      value="en"
                      checked={editPreferredLanguage.value === 'en'}
                      onChange={() => {
                        editPreferredLanguage.value = 'en';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_english')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Service Area */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_service_area')}
                </label>
                <input
                  type="text"
                  value={editServiceArea.value}
                  onInput={(e) => {
                    editServiceArea.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_service_area_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Modal Actions */}
              <div class="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isFormSubmitting.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.saving')}</span>
                    </>
                  ) : (
                    <span>{t('admin.save')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* REVIEW WORKER APPLICATION MODAL                    */}
      {/* ================================================== */}
      {isReviewModalOpen.value && reviewingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-3xl shadow-xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-slate-50">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileTextIcon size={20} />
                </div>
                <div>
                  <h3 class="text-base font-bold text-text-main leading-tight">
                    {t('admin.review_modal_title')}
                  </h3>
                  <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse"></span>
                    <span>{t('admin.status_pending_verification')}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={closeReviewModal}
                disabled={isVerifyingWorker.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div class="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Error Banner */}
              {verifyError.value && (
                <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{verifyError.value}</span>
                </div>
              )}

              {/* Existing Rejection Reason Banner */}
              {reviewingProvider.value.verificationStatus === 'REJECTED' && reviewingProvider.value.rejectionReason && (
                <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
                  <div class="font-bold text-danger flex items-center gap-1.5 text-sm">
                    <AlertCircleIcon size={16} />
                    <span>{t('onboarding.rejection_reason_label')}</span>
                  </div>
                  <p class="text-text-main font-medium leading-relaxed">
                    {reviewingProvider.value.rejectionReason}
                  </p>
                </div>
              )}

              {/* Section 1: Worker Information */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                  <span>{t('admin.worker_info_section')}</span>
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 border border-border/80 rounded-lg p-4 text-xs">
                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.field_full_name')}</span>
                    <span class="text-sm font-bold text-text-main">{reviewingProvider.value.fullName || '—'}</span>
                  </div>

                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.field_phone')}</span>
                    <span class="text-sm font-mono font-bold text-text-main">+91 {reviewingProvider.value.phone}</span>
                  </div>

                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.field_category')}</span>
                    <span class="text-sm font-semibold text-brand">
                      {lang === 'hi' ? reviewingProvider.value.categoryTitleHi : reviewingProvider.value.categoryTitleEn}
                    </span>
                  </div>

                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.field_service_area')}</span>
                    <span class="text-sm font-medium text-text-main">{reviewingProvider.value.serviceArea || 'Chandil'}</span>
                  </div>

                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.submitted_on')}</span>
                    <span class="text-xs text-text-main font-mono">
                      {reviewingProvider.value.submittedAt
                        ? new Date(reviewingProvider.value.submittedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>

                  <div>
                    <span class="text-text-sub block font-medium mb-0.5">{t('admin.col_status')}</span>
                    {reviewingProvider.value.verificationStatus === 'REJECTED' ? (
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-900 border border-red-300">
                        {t('admin.filter_rejected')}
                      </span>
                    ) : (
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {t('admin.status_pending_verification')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Verification Documents */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                  {t('admin.documents_section')}
                </h4>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Aadhaar Front */}
                  <AuthenticatedDocumentPreview
                    url={`/api/admin/providers/${reviewingProvider.value.id}/documents/aadhaar-front`}
                    title={t('admin.doc_aadhaar_front')}
                    hasDocument={!!reviewingProvider.value.hasAadhaarFront}
                    lang={lang}
                  />

                  {/* Aadhaar Back */}
                  <AuthenticatedDocumentPreview
                    url={`/api/admin/providers/${reviewingProvider.value.id}/documents/aadhaar-back`}
                    title={t('admin.doc_aadhaar_back')}
                    hasDocument={!!reviewingProvider.value.hasAadhaarBack}
                    lang={lang}
                  />

                  {/* Worker Photo */}
                  <AuthenticatedDocumentPreview
                    url={`/api/workers/${reviewingProvider.value.id}/photo`}
                    title={t('admin.doc_worker_photo')}
                    hasDocument={!!reviewingProvider.value.hasPhoto}
                    lang={lang}
                  />
                </div>
              </div>

              {/* Section 3: Verification Confirmation Notice */}
              <div class="p-4 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-text-sub space-y-1.5">
                <div class="font-bold text-brand flex items-center gap-1.5 text-sm">
                  <CheckIcon size={16} />
                  <span>{t('admin.verify_confirm_title')}</span>
                </div>
                <p class="leading-relaxed">
                  {t('admin.verify_confirm_desc', {
                    name: reviewingProvider.value.fullName || reviewingProvider.value.phone,
                  })}
                </p>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div class="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => openRejectModal(reviewingProvider.value!)}
                disabled={isVerifyingWorker.value}
                class="min-h-[48px] px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-300 text-danger font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <XIcon size={18} />
                <span>{t('admin.reject_worker_btn')}</span>
              </button>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={isVerifyingWorker.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>

                <button
                  type="button"
                  onClick={() => verifyWorkerProvider(reviewingProvider.value!.id)}
                  disabled={isVerifyingWorker.value}
                  class="min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isVerifyingWorker.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin text-white" />
                      <span>{t('admin.verifying')}</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon size={18} />
                      <span>{t('admin.verify_worker_btn')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* REJECT WORKER CONFIRMATION MODAL                   */}
      {/* ================================================== */}
      {isRejectModalOpen.value && reviewingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-8">
            <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-red-50/50">
              <div class="flex items-center gap-2 text-danger font-bold text-base">
                <AlertCircleIcon size={20} />
                <h3>{t('admin.reject_modal_title')}</h3>
              </div>
              <button
                onClick={closeRejectModal}
                disabled={isRejectingWorker.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div class="p-6 space-y-4">
              <p class="text-xs text-text-sub leading-relaxed">
                {t('admin.reject_confirm_warning')}
              </p>

              {rejectError.value && (
                <div class="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{rejectError.value}</span>
                </div>
              )}

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-xs font-bold text-text-main uppercase tracking-wider">
                    {t('admin.reject_reason_label')} *
                  </label>
                  <span class="text-[11px] text-text-sub font-mono">
                    {rejectingReason.value.length}/500
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  maxLength={500}
                  value={rejectingReason.value}
                  onInput={(e) => {
                    rejectingReason.value = (e.target as HTMLTextAreaElement).value;
                  }}
                  placeholder={t('admin.reject_reason_placeholder')}
                  class="w-full p-3 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                />
              </div>

              <div class="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={isRejectingWorker.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => rejectWorkerProvider(reviewingProvider.value!.id, rejectingReason.value)}
                  disabled={isRejectingWorker.value || rejectingReason.value.trim().length === 0}
                  class="min-h-[48px] px-5 py-2.5 bg-danger hover:bg-red-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isRejectingWorker.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin text-white" />
                      <span>{t('admin.rejecting_worker')}</span>
                    </>
                  ) : (
                    <span>{t('admin.reject_confirm_btn')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* DEACTIVATE CONFIRMATION MODAL                      */}
      {/* ================================================== */}
      {deactivatingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-md shadow-lg overflow-hidden my-8">
            <div class="p-6">
              <div class="w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center mb-4">
                <AlertCircleIcon size={24} />
              </div>

              <h3 class="text-base font-bold text-text-main mb-2">
                {t('admin.deactivate_modal_title')}
              </h3>

              <p class="text-sm text-text-sub leading-relaxed mb-4">
                {t('admin.deactivate_confirm_desc', {
                  name:
                    deactivatingProvider.value.fullName ||
                    deactivatingProvider.value.phone,
                })}
              </p>

              {/* Error Alert (e.g. 409 ACTIVE_BOOKING_EXISTS) */}
              {deactivationError.value && (
                <div class="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{deactivationError.value}</span>
                </div>
              )}

              {/* Confirmation Actions */}
              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeactivateModal}
                  disabled={isDeactivating.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeactivation}
                  disabled={isDeactivating.value}
                  class="min-h-[48px] px-5 py-2.5 bg-danger hover:bg-red-800 text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isDeactivating.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.deactivate')}...</span>
                    </>
                  ) : (
                    <span>{t('admin.confirm_deactivate_btn')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* FULL-SCREEN DOCUMENT ZOOM VIEWER                    */}
      {/* ================================================== */}
      {viewingDocument.value && (
        <DocumentZoomViewer
          title={viewingDocument.value.title}
          url={viewingDocument.value.url}
          initialBlobUrl={viewingDocument.value.blobUrl}
          lang={lang}
        />
      )}
    </div>
  );
}
