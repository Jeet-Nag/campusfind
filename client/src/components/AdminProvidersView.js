import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useEffect, useState, useRef } from 'preact/hooks';
import { currentLanguage, t } from '../state/language';
import { categories, fetchCategories } from '../state/categories';
import { authToken, handleSessionExpired } from '../state/auth';
import { providersList, isProvidersLoading, providersError, providerSearchQuery, providerStatusFilter, providerCategoryFilter, filteredProviders, isAddModalOpen, isEditModalOpen, editingProvider, isReviewModalOpen, reviewingProvider, isVerifyingWorker, verifyError, isFormSubmitting, formError, formSuccessMessage, deactivatingProvider, isDeactivating, deactivationError, statusTogglingId, addFullName, addPhone, addCategoryId, addPreferredLanguage, addServiceArea, editFullName, editCategoryId, editPreferredLanguage, editServiceArea, fetchAdminProviders, openAddModal, closeAddModal, submitAddProvider, openEditModal, closeEditModal, submitEditProvider, openReviewModal, closeReviewModal, verifyWorkerProvider, isRejectModalOpen, rejectingReason, isRejectingWorker, rejectError, openRejectModal, closeRejectModal, rejectWorkerProvider, viewingDocument, openDocumentViewer, closeDocumentViewer, openDeactivateModal, closeDeactivateModal, confirmDeactivation, activateProvider, clearSuccessMessage, } from '../state/admin-providers';
import { ToolIcon, SearchIcon, PlusIcon, EditIcon, SpinnerIcon, AlertCircleIcon, CheckIcon, RefreshIcon, XIcon, FileTextIcon, ImageIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon, RotateCcwIcon, } from './icons';
function AuthenticatedDocumentPreview({ url, title, hasDocument, lang, }) {
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const blobUrlRef = useRef(null);
    const fetchDocument = () => {
        if (!hasDocument) {
            setBlobUrl(null);
            setLoading(false);
            setError(false);
            return;
        }
        const token = authToken.value;
        if (!token)
            return;
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
            if (!active)
                return;
            const objectUrl = URL.createObjectURL(blob);
            blobUrlRef.current = objectUrl;
            setBlobUrl(objectUrl);
            setLoading(false);
        })
            .catch((err) => {
            if (!active)
                return;
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
            if (cancel)
                cancel();
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [url, hasDocument]);
    return (_jsxs("div", { class: "border border-border rounded-lg bg-surface overflow-hidden flex flex-col shadow-2xs", children: [_jsxs("div", { class: "px-3 py-2 bg-slate-100 border-b border-border flex items-center justify-between", children: [_jsx("span", { class: "text-xs font-bold text-text-main truncate", children: title }), hasDocument ? (_jsx("span", { class: "text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-action", children: lang === 'hi' ? 'अपलोड किया गया' : 'Uploaded' })) : (_jsx("span", { class: "text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-text-sub", children: t('admin.doc_not_available') }))] }), _jsxs("div", { class: "p-3 flex-1 flex flex-col items-center justify-center min-h-[170px] bg-slate-50/50", children: [!hasDocument && (_jsxs("div", { class: "text-center p-4 text-text-sub", children: [_jsx(ImageIcon, { size: 32, class: "mx-auto mb-1.5 text-slate-400" }), _jsx("span", { class: "text-xs font-medium", children: t('admin.doc_not_available') })] })), hasDocument && loading && (_jsxs("div", { class: "text-center p-4", children: [_jsx(SpinnerIcon, { size: 24, class: "animate-spin text-brand mx-auto mb-2" }), _jsx("span", { class: "text-xs text-text-sub font-medium", children: t('admin.doc_loading') })] })), hasDocument && !loading && error && (_jsxs("div", { class: "text-center p-3", children: [_jsx(AlertCircleIcon, { size: 24, class: "text-danger mx-auto mb-1.5" }), _jsx("span", { class: "text-xs text-danger block mb-2 font-medium", children: t('admin.doc_load_error') }), _jsxs("button", { type: "button", onClick: fetchDocument, class: "px-2.5 py-1 text-xs font-semibold bg-white border border-border rounded hover:bg-slate-50 text-text-main inline-flex items-center gap-1 shadow-2xs", children: [_jsx(RefreshIcon, { size: 12 }), _jsx("span", { children: t('admin.retry') })] })] })), hasDocument && !loading && !error && blobUrl && (_jsxs("div", { class: "w-full flex flex-col items-center", children: [_jsxs("button", { type: "button", onClick: () => openDocumentViewer(title, url, blobUrl), class: "group relative w-full overflow-hidden rounded border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer", "aria-label": `${t('admin.view_document')}: ${title}`, children: [_jsx("img", { src: blobUrl, alt: title, class: "max-h-48 w-full object-contain transition-transform duration-200 group-hover:scale-102" }), _jsx("div", { class: "absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center", children: _jsxs("span", { class: "opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/85 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md", children: [_jsx(MaximizeIcon, { size: 14 }), _jsx("span", { children: t('admin.view_document') })] }) })] }), _jsxs("button", { type: "button", onClick: () => openDocumentViewer(title, url, blobUrl), class: "mt-2.5 w-full min-h-[38px] py-1.5 px-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-border text-text-main text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors", children: [_jsx(MaximizeIcon, { size: 14 }), _jsx("span", { children: t('admin.view_document') })] })] }))] })] }));
}
function DocumentZoomViewer({ title, url, initialBlobUrl, lang }) {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [resolvedBlobUrl, setResolvedBlobUrl] = useState(initialBlobUrl);
    const [loading, setLoading] = useState(!initialBlobUrl);
    const [loadError, setLoadError] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const lastTouchDist = useRef(null);
    const touchStartPos = useRef(null);
    const localBlobRef = useRef(null);
    // Fallback fetch if initialBlobUrl was not provided
    useEffect(() => {
        if (initialBlobUrl) {
            setResolvedBlobUrl(initialBlobUrl);
            setLoading(false);
            return;
        }
        const token = authToken.value;
        if (!token)
            return;
        let active = true;
        setLoading(true);
        setLoadError(false);
        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
            if (!res.ok)
                throw new Error('FAILED');
            return res.blob();
        })
            .then((blob) => {
            if (!active)
                return;
            const bUrl = URL.createObjectURL(blob);
            localBlobRef.current = bUrl;
            setResolvedBlobUrl(bUrl);
            setLoading(false);
        })
            .catch(() => {
            if (!active)
                return;
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
            if (next <= 1)
                setPos({ x: 0, y: 0 });
            return next;
        });
    };
    const resetZoom = () => {
        setScale(1);
        setPos({ x: 0, y: 0 });
    };
    // Keyboard navigation (Esc, +, -, 0)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDocumentViewer();
            }
            else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            }
            else if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            }
            else if (e.key === '0') {
                e.preventDefault();
                resetZoom();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    // Mouse pan handlers
    const handleMouseDown = (e) => {
        if (e.button !== 0)
            return;
        dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        setIsDragging(true);
    };
    const handleMouseMove = (e) => {
        if (!isDragging)
            return;
        setPos({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y,
        });
    };
    const handleMouseUp = () => setIsDragging(false);
    // Wheel zoom
    const handleWheel = (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            zoomIn();
        }
        else {
            zoomOut();
        }
    };
    // Touch pan & Pinch zoom
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            lastTouchDist.current = dist;
        }
        else if (e.touches.length === 1) {
            touchStartPos.current = {
                x: e.touches[0].clientX - pos.x,
                y: e.touches[0].clientY - pos.y,
            };
            setIsDragging(true);
        }
    };
    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && lastTouchDist.current !== null) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const factor = dist / lastTouchDist.current;
            lastTouchDist.current = dist;
            setScale((prev) => Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.5), 4));
        }
        else if (e.touches.length === 1 && touchStartPos.current && isDragging) {
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
    return (_jsxs("div", { class: "fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none", role: "dialog", "aria-modal": "true", "aria-label": title, onClick: (e) => {
            if (e.target === e.currentTarget)
                closeDocumentViewer();
        }, children: [_jsxs("div", { class: "px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0 z-10 text-white", children: [_jsxs("div", { class: "flex items-center gap-3", children: [_jsx("span", { class: "font-bold text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md", children: title }), _jsx("span", { class: "hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700", children: t('admin.doc_viewer_title') })] }), _jsxs("button", { type: "button", onClick: closeDocumentViewer, class: "min-h-[44px] min-w-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg flex items-center gap-1.5 transition-colors text-xs font-semibold cursor-pointer", "aria-label": t('admin.close_viewer'), children: [_jsx(XIcon, { size: 18 }), _jsx("span", { class: "hidden sm:inline", children: t('admin.close_viewer') })] })] }), _jsxs("div", { class: "flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4 touch-none cursor-grab active:cursor-grabbing", onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, onWheel: handleWheel, onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd, onDblClick: () => {
                    if (scale > 1)
                        resetZoom();
                    else
                        zoomIn();
                }, children: [loading && (_jsxs("div", { class: "text-center p-6 text-white", children: [_jsx(SpinnerIcon, { size: 32, class: "animate-spin text-brand-light mx-auto mb-2" }), _jsx("span", { class: "text-xs font-medium text-slate-300", children: t('admin.doc_loading') })] })), loadError && (_jsxs("div", { class: "text-center p-6 text-white bg-slate-900 border border-red-500/30 rounded-xl max-w-sm", children: [_jsx(AlertCircleIcon, { size: 32, class: "text-red-400 mx-auto mb-2" }), _jsx("span", { class: "text-xs text-red-300 block mb-3 font-medium", children: t('admin.doc_load_error') }), _jsx("button", { type: "button", onClick: closeDocumentViewer, class: "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer", children: t('admin.close_viewer') })] })), !loading && !loadError && resolvedBlobUrl && (_jsx("img", { src: resolvedBlobUrl, alt: title, draggable: false, class: "pointer-events-auto select-none rounded shadow-2xl transition-transform", style: {
                            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                            maxWidth: '92vw',
                            maxHeight: '76vh',
                            objectFit: 'contain',
                        } }))] }), _jsx("div", { class: "p-4 flex items-center justify-center shrink-0 z-10 pointer-events-none", children: _jsxs("div", { class: "pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 rounded-xl px-3 py-2 flex items-center gap-2 sm:gap-3 shadow-xl", children: [_jsxs("button", { type: "button", onClick: zoomOut, disabled: scale <= 0.5, class: "min-h-[44px] min-w-[44px] p-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold cursor-pointer", "aria-label": t('admin.zoom_out'), children: [_jsx(ZoomOutIcon, { size: 18 }), _jsx("span", { class: "hidden md:inline", children: t('admin.zoom_out') })] }), _jsxs("span", { class: "px-2.5 py-1 font-mono text-xs font-bold text-amber-400 bg-slate-950 rounded-md border border-slate-800 min-w-[54px] text-center", children: [Math.round(scale * 100), "%"] }), _jsxs("button", { type: "button", onClick: zoomIn, disabled: scale >= 4, class: "min-h-[44px] min-w-[44px] p-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold cursor-pointer", "aria-label": t('admin.zoom_in'), children: [_jsx(ZoomInIcon, { size: 18 }), _jsx("span", { class: "hidden md:inline", children: t('admin.zoom_in') })] }), _jsx("div", { class: "h-5 w-px bg-slate-700 mx-0.5 sm:mx-1" }), _jsxs("button", { type: "button", onClick: resetZoom, class: "min-h-[44px] min-w-[44px] px-2.5 py-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold text-slate-200 hover:text-white cursor-pointer", "aria-label": t('admin.zoom_reset'), children: [_jsx(RotateCcwIcon, { size: 16 }), _jsx("span", { children: t('admin.zoom_reset') })] }), _jsx("div", { class: "h-5 w-px bg-slate-700 mx-0.5 sm:mx-1" }), _jsxs("button", { type: "button", onClick: closeDocumentViewer, class: "min-h-[44px] min-w-[44px] px-2.5 py-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold text-slate-200 hover:text-white cursor-pointer", "aria-label": t('admin.close_viewer'), children: [_jsx(XIcon, { size: 16 }), _jsx("span", { children: t('admin.close_viewer') })] })] }) })] }));
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
    return (_jsxs("div", { class: "space-y-6", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { class: "text-xl md:text-2xl font-bold text-text-main", children: t('admin.providers_title') }), _jsx("p", { class: "text-sm text-text-sub mt-0.5", children: t('admin.providers_subtitle') })] }), _jsx("div", { children: _jsxs("button", { onClick: () => openAddModal(cats[0]?.id), class: "min-h-[48px] px-4 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors w-full sm:w-auto", "aria-label": t('admin.add_provider'), children: [_jsx(PlusIcon, { size: 18 }), _jsx("span", { children: t('admin.add_provider') })] }) })] }), successMsg && (_jsxs("div", { class: "p-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between gap-3 text-action shadow-xs animate-fadeIn", children: [_jsxs("div", { class: "flex items-center gap-2.5", children: [_jsx("div", { class: "w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0", children: _jsx(CheckIcon, { size: 16 }) }), _jsx("span", { class: "text-sm font-semibold", children: successMsg })] }), _jsx("button", { onClick: clearSuccessMessage, class: "min-h-[44px] min-w-[44px] p-2 text-action/70 hover:text-action rounded-lg flex items-center justify-center", "aria-label": "Dismiss", children: _jsx(XIcon, { size: 16 }) })] })), error && !loading && (_jsxs("div", { class: "p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-danger shadow-xs", children: [_jsxs("div", { class: "flex items-start gap-2.5", children: [_jsx(AlertCircleIcon, { size: 20, class: "shrink-0 mt-0.5" }), _jsx("div", { children: _jsx("p", { class: "text-sm font-semibold", children: error }) })] }), _jsxs("button", { onClick: () => fetchAdminProviders(), class: "min-h-[44px] px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-main hover:bg-background flex items-center gap-1.5 shrink-0", children: [_jsx(RefreshIcon, { size: 14 }), _jsx("span", { children: t('admin.retry') })] })] })), _jsx("div", { class: "bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3", children: _jsxs("div", { class: "grid grid-cols-1 md:grid-cols-12 gap-3", children: [_jsxs("div", { class: "md:col-span-6 relative", children: [_jsx("div", { class: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub", children: _jsx(SearchIcon, { size: 18 }) }), _jsx("input", { type: "text", value: providerSearchQuery.value, onInput: (e) => {
                                        providerSearchQuery.value = e.target.value;
                                    }, placeholder: t('admin.search_placeholder'), class: "w-full min-h-[48px] pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-main placeholder-text-sub/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] }), _jsx("div", { class: "md:col-span-3", children: _jsxs("select", { value: providerStatusFilter.value, onChange: (e) => {
                                    providerStatusFilter.value = e.target.value;
                                }, class: "w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand", "aria-label": "Filter by status", children: [_jsx("option", { value: "all", children: t('admin.filter_all') }), _jsx("option", { value: "pending", children: t('admin.filter_pending') }), _jsx("option", { value: "active", children: t('admin.filter_active') }), _jsx("option", { value: "inactive", children: t('admin.filter_inactive') }), _jsx("option", { value: "rejected", children: t('admin.filter_rejected') })] }) }), _jsx("div", { class: "md:col-span-3", children: _jsxs("select", { value: providerCategoryFilter.value, onChange: (e) => {
                                    providerCategoryFilter.value = e.target.value;
                                }, class: "w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand", "aria-label": "Filter by category", children: [_jsx("option", { value: "all", children: t('admin.filter_category_all') }), cats.map((c) => (_jsx("option", { value: c.id, children: lang === 'hi' ? c.titleHi : c.titleEn }, c.id)))] }) })] }) }), loading && (_jsx("div", { class: "bg-surface border border-border rounded-lg p-12 text-center shadow-xs", children: _jsxs("div", { class: "flex flex-col items-center justify-center gap-3", children: [_jsx(SpinnerIcon, { size: 32, class: "text-brand animate-spin" }), _jsx("p", { class: "text-sm font-medium text-text-sub", children: t('admin.loading') })] }) })), !loading && totalCount === 0 && (_jsxs("div", { class: "bg-surface border border-border rounded-lg p-10 text-center shadow-xs", children: [_jsx("div", { class: "w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-text-sub", children: _jsx(ToolIcon, { size: 28 }) }), _jsx("h3", { class: "text-base font-bold text-text-main mb-1", children: t('admin.no_providers_registered') }), _jsx("p", { class: "text-sm text-text-sub max-w-md mx-auto mb-6", children: t('admin.no_providers_registered_desc') }), _jsxs("button", { onClick: () => openAddModal(cats[0]?.id), class: "min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors", children: [_jsx(PlusIcon, { size: 18 }), _jsx("span", { children: t('admin.add_provider') })] })] })), !loading && totalCount > 0 && list.length === 0 && (_jsxs("div", { class: "bg-surface border border-border rounded-lg p-8 text-center shadow-xs", children: [_jsx("div", { class: "w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-text-sub", children: _jsx(SearchIcon, { size: 24 }) }), _jsx("h3", { class: "text-base font-semibold text-text-main mb-1", children: t('admin.no_providers_match') }), _jsx("p", { class: "text-xs text-text-sub mb-4", children: t('admin.search_placeholder') }), _jsx("button", { onClick: handleClearFilters, class: "min-h-[48px] px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors", children: t('admin.clear_filters') })] })), !loading && list.length > 0 && (_jsx("div", { class: "hidden md:block bg-surface border border-border rounded-lg shadow-xs overflow-hidden", children: _jsxs("table", { class: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { class: "bg-slate-50 border-b border-border text-xs font-bold text-text-sub uppercase tracking-wider", children: [_jsx("th", { class: "py-3.5 px-4", children: t('admin.col_name') }), _jsx("th", { class: "py-3.5 px-4", children: t('admin.col_phone') }), _jsx("th", { class: "py-3.5 px-4", children: t('admin.col_category') }), _jsx("th", { class: "py-3.5 px-4", children: t('admin.col_area') }), _jsx("th", { class: "py-3.5 px-4", children: t('admin.col_status') }), _jsx("th", { class: "py-3.5 px-4", children: t('admin.col_availability') }), _jsx("th", { class: "py-3.5 px-4 text-right", children: t('admin.col_actions') })] }) }), _jsx("tbody", { class: "divide-y divide-border text-sm", children: list.map((provider) => {
                                const categoryTitle = lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
                                const isToggling = statusTogglingId.value === provider.id;
                                const isPending = provider.verificationStatus === 'PENDING_VERIFICATION';
                                const isRejected = provider.verificationStatus === 'REJECTED';
                                return (_jsxs("tr", { class: `transition-colors ${isPending
                                        ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                                        : isRejected
                                            ? 'bg-red-50/60 hover:bg-red-100/60 border-l-4 border-l-red-500'
                                            : 'hover:bg-slate-50/75'}`, children: [_jsx("td", { class: "py-3.5 px-4 font-semibold text-text-main", children: provider.fullName || '—' }), _jsx("td", { class: "py-3.5 px-4 font-mono text-xs text-text-main", children: provider.phone }), _jsx("td", { class: "py-3.5 px-4", children: _jsx("span", { class: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-brand border border-blue-200", children: categoryTitle }) }), _jsx("td", { class: "py-3.5 px-4 text-text-sub text-xs", children: provider.serviceArea }), _jsx("td", { class: "py-3.5 px-4", children: isPending ? (_jsxs("span", { class: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse" }), _jsx("span", { children: t('admin.status_pending_verification') })] })) : isRejected ? (_jsxs("span", { class: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-red-600 inline-block" }), _jsx("span", { children: t('admin.filter_rejected') })] })) : provider.isActive ? (_jsxs("span", { class: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-action border border-green-200", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-action inline-block" }), _jsx("span", { children: t('admin.status_active') })] })) : (_jsxs("span", { class: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-danger border border-red-200", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-danger inline-block" }), _jsx("span", { children: t('admin.status_inactive') })] })) }), _jsx("td", { class: "py-3.5 px-4", children: isPending ? (_jsx("span", { class: "text-xs font-medium text-amber-700", children: t('admin.status_pending_verification') })) : isRejected ? (_jsx("span", { class: "text-xs font-medium text-red-700", children: t('admin.filter_rejected') })) : provider.isAvailable ? (_jsx("span", { class: "text-xs font-medium text-text-main", children: t('admin.available') })) : (_jsx("span", { class: "text-xs font-medium text-text-sub", children: t('admin.unavailable') })) }), _jsx("td", { class: "py-3.5 px-4 text-right", children: _jsx("div", { class: "flex items-center justify-end gap-2", children: isPending || isRejected ? (_jsxs("button", { onClick: () => openReviewModal(provider), class: `min-h-[48px] px-3.5 py-2 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors ${isRejected
                                                        ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                                                        : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'}`, title: t('admin.review_application'), children: [_jsx(FileTextIcon, { size: 14 }), _jsx("span", { children: t('admin.review_application') })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => openEditModal(provider), class: "min-h-[48px] px-3 py-2 bg-white border border-border hover:bg-background rounded-lg text-xs font-semibold text-text-main flex items-center gap-1.5 transition-colors", title: t('admin.edit'), children: [_jsx(EditIcon, { size: 14 }), _jsx("span", { children: t('admin.edit') })] }), provider.isActive ? (_jsx("button", { onClick: () => openDeactivateModal(provider), disabled: isToggling, class: "min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50", children: isToggling ? (_jsx(SpinnerIcon, { size: 14, class: "animate-spin inline" })) : (_jsx("span", { children: t('admin.deactivate') })) })) : (_jsx("button", { onClick: () => activateProvider(provider), disabled: isToggling, class: "min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50", children: isToggling ? (_jsx(SpinnerIcon, { size: 14, class: "animate-spin inline" })) : (_jsx("span", { children: t('admin.activate') })) }))] })) }) })] }, provider.id));
                            }) })] }) })), !loading && list.length > 0 && (_jsx("div", { class: "block md:hidden space-y-3", children: list.map((provider) => {
                    const categoryTitle = lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
                    const isToggling = statusTogglingId.value === provider.id;
                    const isPending = provider.verificationStatus === 'PENDING_VERIFICATION';
                    const isRejected = provider.verificationStatus === 'REJECTED';
                    return (_jsxs("div", { class: `bg-surface border rounded-lg p-4 shadow-xs space-y-3 ${isPending
                            ? 'border-amber-400 bg-amber-50/25 ring-1 ring-amber-300'
                            : isRejected
                                ? 'border-red-400 bg-red-50/25 ring-1 ring-red-300'
                                : 'border-border'}`, children: [_jsxs("div", { class: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h4", { class: "font-bold text-base text-text-main leading-tight", children: provider.fullName || '—' }), _jsx("span", { class: "inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-blue-50 text-brand border border-blue-200", children: categoryTitle })] }), isPending ? (_jsxs("span", { class: "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse" }), _jsx("span", { children: t('admin.status_pending_verification') })] })) : isRejected ? (_jsxs("span", { class: "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-red-600 inline-block" }), _jsx("span", { children: t('admin.filter_rejected') })] })) : provider.isActive ? (_jsxs("span", { class: "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-action border border-green-200", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-action inline-block" }), _jsx("span", { children: t('admin.status_active') })] })) : (_jsxs("span", { class: "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-danger border border-red-200", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-danger inline-block" }), _jsx("span", { children: t('admin.status_inactive') })] }))] }), _jsxs("div", { class: "grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60", children: [_jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: t('admin.col_phone') }), _jsx("span", { class: "font-mono text-text-main font-medium", children: provider.phone })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: t('admin.col_area') }), _jsx("span", { class: "text-text-main font-medium", children: provider.serviceArea })] })] }), _jsx("div", { class: "pt-1", children: isPending || isRejected ? (_jsxs("button", { onClick: () => openReviewModal(provider), class: `w-full min-h-[48px] px-4 py-2.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors ${isRejected
                                        ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                                        : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'}`, children: [_jsx(FileTextIcon, { size: 16 }), _jsx("span", { children: t('admin.review_application') })] })) : (_jsxs("div", { class: "grid grid-cols-2 gap-2", children: [_jsxs("button", { onClick: () => openEditModal(provider), class: "min-h-[48px] px-3 py-2 bg-white border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-background flex items-center justify-center gap-1.5 transition-colors", children: [_jsx(EditIcon, { size: 16 }), _jsx("span", { children: t('admin.edit') })] }), provider.isActive ? (_jsx("button", { onClick: () => openDeactivateModal(provider), disabled: isToggling, class: "min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center", children: isToggling ? (_jsx(SpinnerIcon, { size: 16, class: "animate-spin" })) : (_jsx("span", { children: t('admin.deactivate') })) })) : (_jsx("button", { onClick: () => activateProvider(provider), disabled: isToggling, class: "min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center", children: isToggling ? (_jsx(SpinnerIcon, { size: 16, class: "animate-spin" })) : (_jsx("span", { children: t('admin.activate') })) }))] })) })] }, provider.id));
                }) })), isAddModalOpen.value && (_jsx("div", { class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8", children: [_jsxs("div", { class: "px-6 py-4 border-b border-border flex items-center justify-between", children: [_jsx("h3", { class: "text-base font-bold text-text-main", children: t('admin.add_provider') }), _jsx("button", { onClick: closeAddModal, disabled: isFormSubmitting.value, class: "min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50", "aria-label": "Close", children: _jsx(XIcon, { size: 20 }) })] }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                submitAddProvider();
                            }, class: "p-6 space-y-4", children: [formError.value && (_jsxs("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5" }), _jsx("span", { children: formError.value })] })), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('admin.field_full_name'), " *"] }), _jsx("input", { type: "text", required: true, value: addFullName.value, onInput: (e) => {
                                                addFullName.value = e.target.value;
                                            }, placeholder: t('admin.field_full_name_placeholder'), class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('admin.field_phone'), " *"] }), _jsxs("div", { class: "relative", children: [_jsx("div", { class: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub font-mono text-xs font-semibold", children: "+91" }), _jsx("input", { type: "tel", required: true, maxLength: 10, value: addPhone.value, onInput: (e) => {
                                                        // Only allow digits
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                        addPhone.value = val;
                                                    }, placeholder: t('admin.field_phone_placeholder'), class: "w-full min-h-[48px] pl-12 pr-3.5 py-2.5 bg-background border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('admin.field_category'), " *"] }), _jsxs("select", { required: true, value: addCategoryId.value, onChange: (e) => {
                                                addCategoryId.value = e.target.value;
                                            }, class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand", children: [_jsx("option", { value: "", disabled: true, children: t('admin.field_select_category') }), cats.map((c) => (_jsx("option", { value: c.id, children: lang === 'hi' ? c.titleHi : c.titleEn }, c.id)))] })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('admin.field_preferred_language') }), _jsxs("div", { class: "grid grid-cols-2 gap-3", children: [_jsxs("label", { class: "min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50", children: [_jsx("input", { type: "radio", name: "add_lang", value: "hi", checked: addPreferredLanguage.value === 'hi', onChange: () => {
                                                                addPreferredLanguage.value = 'hi';
                                                            }, class: "text-brand focus:ring-brand" }), _jsx("span", { class: "text-sm font-medium text-text-main", children: t('admin.lang_hindi') })] }), _jsxs("label", { class: "min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50", children: [_jsx("input", { type: "radio", name: "add_lang", value: "en", checked: addPreferredLanguage.value === 'en', onChange: () => {
                                                                addPreferredLanguage.value = 'en';
                                                            }, class: "text-brand focus:ring-brand" }), _jsx("span", { class: "text-sm font-medium text-text-main", children: t('admin.lang_english') })] })] })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('admin.field_service_area') }), _jsx("input", { type: "text", value: addServiceArea.value, onInput: (e) => {
                                                addServiceArea.value = e.target.value;
                                            }, placeholder: t('admin.field_service_area_placeholder'), class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] }), _jsxs("div", { class: "pt-4 border-t border-border flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: closeAddModal, disabled: isFormSubmitting.value, class: "min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50", children: t('admin.cancel') }), _jsx("button", { type: "submit", disabled: isFormSubmitting.value, class: "min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50", children: isFormSubmitting.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin" }), _jsx("span", { children: t('admin.creating') })] })) : (_jsx("span", { children: t('admin.add_provider') })) })] })] })] }) })), isEditModalOpen.value && editingProvider.value && (_jsx("div", { class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8", children: [_jsxs("div", { class: "px-6 py-4 border-b border-border flex items-center justify-between", children: [_jsx("h3", { class: "text-base font-bold text-text-main", children: t('admin.edit_provider') }), _jsx("button", { onClick: closeEditModal, disabled: isFormSubmitting.value, class: "min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50", "aria-label": "Close", children: _jsx(XIcon, { size: 20 }) })] }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                submitEditProvider();
                            }, class: "p-6 space-y-4", children: [formError.value && (_jsxs("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5" }), _jsx("span", { children: formError.value })] })), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-sub uppercase tracking-wider mb-1.5", children: [t('admin.field_phone'), " (", t('admin.field_phone_readonly_hint'), ")"] }), _jsx("input", { type: "text", disabled: true, value: editingProvider.value.phone, class: "w-full min-h-[48px] px-3.5 py-2.5 bg-slate-100 border border-border rounded-lg text-sm font-mono text-text-sub cursor-not-allowed" })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('admin.field_full_name'), " *"] }), _jsx("input", { type: "text", required: true, value: editFullName.value, onInput: (e) => {
                                                editFullName.value = e.target.value;
                                            }, placeholder: t('admin.field_full_name_placeholder'), class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('admin.field_category'), " *"] }), _jsx("select", { required: true, value: editCategoryId.value, onChange: (e) => {
                                                editCategoryId.value = e.target.value;
                                            }, class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand", children: cats.map((c) => (_jsx("option", { value: c.id, children: lang === 'hi' ? c.titleHi : c.titleEn }, c.id))) })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('admin.field_preferred_language') }), _jsxs("div", { class: "grid grid-cols-2 gap-3", children: [_jsxs("label", { class: "min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50", children: [_jsx("input", { type: "radio", name: "edit_lang", value: "hi", checked: editPreferredLanguage.value === 'hi', onChange: () => {
                                                                editPreferredLanguage.value = 'hi';
                                                            }, class: "text-brand focus:ring-brand" }), _jsx("span", { class: "text-sm font-medium text-text-main", children: t('admin.lang_hindi') })] }), _jsxs("label", { class: "min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50", children: [_jsx("input", { type: "radio", name: "edit_lang", value: "en", checked: editPreferredLanguage.value === 'en', onChange: () => {
                                                                editPreferredLanguage.value = 'en';
                                                            }, class: "text-brand focus:ring-brand" }), _jsx("span", { class: "text-sm font-medium text-text-main", children: t('admin.lang_english') })] })] })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('admin.field_service_area') }), _jsx("input", { type: "text", value: editServiceArea.value, onInput: (e) => {
                                                editServiceArea.value = e.target.value;
                                            }, placeholder: t('admin.field_service_area_placeholder'), class: "w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand" })] }), _jsxs("div", { class: "pt-4 border-t border-border flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: closeEditModal, disabled: isFormSubmitting.value, class: "min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50", children: t('admin.cancel') }), _jsx("button", { type: "submit", disabled: isFormSubmitting.value, class: "min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50", children: isFormSubmitting.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin" }), _jsx("span", { children: t('admin.saving') })] })) : (_jsx("span", { children: t('admin.save') })) })] })] })] }) })), isReviewModalOpen.value && reviewingProvider.value && (_jsx("div", { class: "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 overflow-y-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl w-full max-w-3xl shadow-xl overflow-hidden my-6 max-h-[90vh] flex flex-col", children: [_jsxs("div", { class: "px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-slate-50", children: [_jsxs("div", { class: "flex items-center gap-2.5", children: [_jsx("div", { class: "w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0", children: _jsx(FileTextIcon, { size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { class: "text-base font-bold text-text-main leading-tight", children: t('admin.review_modal_title') }), _jsxs("span", { class: "inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-amber-600 inline-block animate-pulse" }), _jsx("span", { children: t('admin.status_pending_verification') })] })] })] }), _jsx("button", { onClick: closeReviewModal, disabled: isVerifyingWorker.value, class: "min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors", "aria-label": "Close", children: _jsx(XIcon, { size: 20 }) })] }), _jsxs("div", { class: "p-6 space-y-6 overflow-y-auto flex-1", children: [verifyError.value && (_jsxs("div", { class: "p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5" }), _jsx("span", { children: verifyError.value })] })), reviewingProvider.value.verificationStatus === 'REJECTED' && reviewingProvider.value.rejectionReason && (_jsxs("div", { class: "p-4 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1", children: [_jsxs("div", { class: "font-bold text-danger flex items-center gap-1.5 text-sm", children: [_jsx(AlertCircleIcon, { size: 16 }), _jsx("span", { children: t('onboarding.rejection_reason_label') })] }), _jsx("p", { class: "text-text-main font-medium leading-relaxed", children: reviewingProvider.value.rejectionReason })] })), _jsxs("div", { class: "space-y-3", children: [_jsx("h4", { class: "text-xs font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: t('admin.worker_info_section') }) }), _jsxs("div", { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 border border-border/80 rounded-lg p-4 text-xs", children: [_jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.field_full_name') }), _jsx("span", { class: "text-sm font-bold text-text-main", children: reviewingProvider.value.fullName || '—' })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.field_phone') }), _jsxs("span", { class: "text-sm font-mono font-bold text-text-main", children: ["+91 ", reviewingProvider.value.phone] })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.field_category') }), _jsx("span", { class: "text-sm font-semibold text-brand", children: lang === 'hi' ? reviewingProvider.value.categoryTitleHi : reviewingProvider.value.categoryTitleEn })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.field_service_area') }), _jsx("span", { class: "text-sm font-medium text-text-main", children: reviewingProvider.value.serviceArea || 'Chandil' })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.submitted_on') }), _jsx("span", { class: "text-xs text-text-main font-mono", children: reviewingProvider.value.submittedAt
                                                                ? new Date(reviewingProvider.value.submittedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })
                                                                : '—' })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block font-medium mb-0.5", children: t('admin.col_status') }), reviewingProvider.value.verificationStatus === 'REJECTED' ? (_jsx("span", { class: "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-900 border border-red-300", children: t('admin.filter_rejected') })) : (_jsx("span", { class: "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300", children: t('admin.status_pending_verification') }))] })] })] }), _jsxs("div", { class: "space-y-3", children: [_jsx("h4", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: t('admin.documents_section') }), _jsxs("div", { class: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsx(AuthenticatedDocumentPreview, { url: `/api/admin/providers/${reviewingProvider.value.id}/documents/aadhaar-front`, title: t('admin.doc_aadhaar_front'), hasDocument: !!reviewingProvider.value.hasAadhaarFront, lang: lang }), _jsx(AuthenticatedDocumentPreview, { url: `/api/admin/providers/${reviewingProvider.value.id}/documents/aadhaar-back`, title: t('admin.doc_aadhaar_back'), hasDocument: !!reviewingProvider.value.hasAadhaarBack, lang: lang }), _jsx(AuthenticatedDocumentPreview, { url: `/api/workers/${reviewingProvider.value.id}/photo`, title: t('admin.doc_worker_photo'), hasDocument: !!reviewingProvider.value.hasPhoto, lang: lang })] })] }), _jsxs("div", { class: "p-4 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-text-sub space-y-1.5", children: [_jsxs("div", { class: "font-bold text-brand flex items-center gap-1.5 text-sm", children: [_jsx(CheckIcon, { size: 16 }), _jsx("span", { children: t('admin.verify_confirm_title') })] }), _jsx("p", { class: "leading-relaxed", children: t('admin.verify_confirm_desc', {
                                                name: reviewingProvider.value.fullName || reviewingProvider.value.phone,
                                            }) })] })] }), _jsxs("div", { class: "px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-slate-50", children: [_jsxs("button", { type: "button", onClick: () => openRejectModal(reviewingProvider.value), disabled: isVerifyingWorker.value, class: "min-h-[48px] px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-300 text-danger font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50", children: [_jsx(XIcon, { size: 18 }), _jsx("span", { children: t('admin.reject_worker_btn') })] }), _jsxs("div", { class: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: closeReviewModal, disabled: isVerifyingWorker.value, class: "min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50", children: t('admin.cancel') }), _jsx("button", { type: "button", onClick: () => verifyWorkerProvider(reviewingProvider.value.id), disabled: isVerifyingWorker.value, class: "min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50", children: isVerifyingWorker.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin text-white" }), _jsx("span", { children: t('admin.verifying') })] })) : (_jsxs(_Fragment, { children: [_jsx(CheckIcon, { size: 18 }), _jsx("span", { children: t('admin.verify_worker_btn') })] })) })] })] })] }) })), isRejectModalOpen.value && reviewingProvider.value && (_jsx("div", { class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-8", children: [_jsxs("div", { class: "px-6 py-4 border-b border-border flex items-center justify-between bg-red-50/50", children: [_jsxs("div", { class: "flex items-center gap-2 text-danger font-bold text-base", children: [_jsx(AlertCircleIcon, { size: 20 }), _jsx("h3", { children: t('admin.reject_modal_title') })] }), _jsx("button", { onClick: closeRejectModal, disabled: isRejectingWorker.value, class: "min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50", "aria-label": "Close", children: _jsx(XIcon, { size: 20 }) })] }), _jsxs("div", { class: "p-6 space-y-4", children: [_jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: t('admin.reject_confirm_warning') }), rejectError.value && (_jsxs("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5" }), _jsx("span", { children: rejectError.value })] })), _jsxs("div", { children: [_jsxs("div", { class: "flex items-center justify-between mb-1.5", children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider", children: [t('admin.reject_reason_label'), " *"] }), _jsxs("span", { class: "text-[11px] text-text-sub font-mono", children: [rejectingReason.value.length, "/500"] })] }), _jsx("textarea", { required: true, rows: 4, maxLength: 500, value: rejectingReason.value, onInput: (e) => {
                                                rejectingReason.value = e.target.value;
                                            }, placeholder: t('admin.reject_reason_placeholder'), class: "w-full p-3 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400" })] }), _jsxs("div", { class: "pt-3 border-t border-border flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: closeRejectModal, disabled: isRejectingWorker.value, class: "min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50", children: t('admin.cancel') }), _jsx("button", { type: "button", onClick: () => rejectWorkerProvider(reviewingProvider.value.id, rejectingReason.value), disabled: isRejectingWorker.value || rejectingReason.value.trim().length === 0, class: "min-h-[48px] px-5 py-2.5 bg-danger hover:bg-red-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50", children: isRejectingWorker.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin text-white" }), _jsx("span", { children: t('admin.rejecting_worker') })] })) : (_jsx("span", { children: t('admin.reject_confirm_btn') })) })] })] })] }) })), deactivatingProvider.value && (_jsx("div", { class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto", children: _jsx("div", { class: "bg-surface border border-border rounded-xl w-full max-w-md shadow-lg overflow-hidden my-8", children: _jsxs("div", { class: "p-6", children: [_jsx("div", { class: "w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center mb-4", children: _jsx(AlertCircleIcon, { size: 24 }) }), _jsx("h3", { class: "text-base font-bold text-text-main mb-2", children: t('admin.deactivate_modal_title') }), _jsx("p", { class: "text-sm text-text-sub leading-relaxed mb-4", children: t('admin.deactivate_confirm_desc', {
                                    name: deactivatingProvider.value.fullName ||
                                        deactivatingProvider.value.phone,
                                }) }), deactivationError.value && (_jsxs("div", { class: "p-3 mb-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5" }), _jsx("span", { children: deactivationError.value })] })), _jsxs("div", { class: "flex items-center justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: closeDeactivateModal, disabled: isDeactivating.value, class: "min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50", children: t('admin.cancel') }), _jsx("button", { type: "button", onClick: confirmDeactivation, disabled: isDeactivating.value, class: "min-h-[48px] px-5 py-2.5 bg-danger hover:bg-red-800 text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50", children: isDeactivating.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin" }), _jsxs("span", { children: [t('admin.deactivate'), "..."] })] })) : (_jsx("span", { children: t('admin.confirm_deactivate_btn') })) })] })] }) }) })), viewingDocument.value && (_jsx(DocumentZoomViewer, { title: viewingDocument.value.title, url: viewingDocument.value.url, initialBlobUrl: viewingDocument.value.blobUrl, lang: lang }))] }));
}
