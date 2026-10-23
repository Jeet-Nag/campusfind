import { useState, useEffect } from 'preact/hooks';
import { BetaFeedback, BetaFeedbackComment, BetaFeedbackStatus, BetaFeedbackCategory, ApiResponse } from '@shared';
import { authToken } from '../state/auth';
import { getApiUrl } from '../config/api';

export function AdminFeedbackView() {
  const [items, setItems] = useState<BetaFeedback[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportedOnly, setReportedOnly] = useState(false);

  // Moderation detail modal
  const [selectedItem, setSelectedItem] = useState<BetaFeedback | null>(null);
  const [comments, setComments] = useState<BetaFeedbackComment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adminReply, setAdminReply] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const token = authToken.value;

  const loadFeedback = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '50');

      const res = await fetch(getApiUrl(`/api/admin/beta/feedback?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ items: BetaFeedback[]; total: number }> = await res.json();
      if (data.success && data.data) {
        let result = data.data.items;
        if (reportedOnly) {
          result = result.filter((i) => i.isReported);
        }
        setItems(result);
        setTotalCount(data.data.total);
      } else {
        setError(data.error?.messageEn || 'Failed to load feedback.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [token, selectedStatus, selectedCategory, reportedOnly]);

  const handleSearchSubmit = (e: Event) => {
    e.preventDefault();
    loadFeedback();
  };

  // Open moderation modal
  const openDetail = async (item: BetaFeedback) => {
    setSelectedItem(item);
    setLoadingDetail(true);
    setAdminReply('');
    setReplyError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${item.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ feedback: BetaFeedback; comments: BetaFeedbackComment[] }> = await res.json();
      if (data.success && data.data) {
        setSelectedItem(data.data.feedback);
        setComments(data.data.comments || []);
      }
    } catch {
      // Fallback to comments loaded if any
    } finally {
      setLoadingDetail(false);
    }
  };

  // Quick Status change
  const handleStatusChange = async (feedbackId: string, newStatus: BetaFeedbackStatus) => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${feedbackId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((item) => (item.id === feedbackId ? { ...item, status: newStatus } : item))
        );
        if (selectedItem && selectedItem.id === feedbackId) {
          setSelectedItem({ ...selectedItem, status: newStatus });
        }
        setActionSuccess(`Status updated to ${newStatus}`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (feedbackId: string, currentPin: boolean) => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${feedbackId}/pin`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPinned: !currentPin }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((item) => (item.id === feedbackId ? { ...item, isPinned: !currentPin } : item))
        );
        if (selectedItem && selectedItem.id === feedbackId) {
          setSelectedItem({ ...selectedItem, isPinned: !currentPin });
        }
        setActionSuccess(!currentPin ? 'Discussion pinned to top.' : 'Discussion unpinned.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle pin.');
    }
  };

  // Moderate comment
  const handleModerateComment = async (commentId: string, newStatus: 'APPROVED' | 'FLAGGED') => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/feedback/comments/${commentId}/moderate`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ moderationStatus: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, moderationStatus: newStatus } : c))
        );
        setActionSuccess(`Comment ${newStatus === 'APPROVED' ? 'approved' : 'flagged'}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setReplyError(err.message || 'Failed to moderate comment.');
    }
  };

  // Submit admin reply
  const handleAdminReplySubmit = async (e: Event) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!adminReply.trim()) {
      setReplyError('Please enter a response message.');
      return;
    }

    setSubmittingReply(true);
    setReplyError(null);

    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${selectedItem.id}/comments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: adminReply.trim(),
          authorName: 'Chandil Team (Official Response)',
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.comment) {
        setComments((prev) => [...prev, data.data.comment]);
        setAdminReply('');
        setActionSuccess('Admin reply published.');
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setReplyError(data.error?.messageEn || 'Failed to post reply.');
      }
    } catch (err: any) {
      setReplyError(err.message || 'Error posting reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const getStatusBadge = (status: BetaFeedbackStatus) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'UNDER_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PLANNED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'FIXED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'WONT_FIX':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getCategoryBadge = (category: BetaFeedbackCategory) => {
    switch (category) {
      case 'BUG_REPORT':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'PERFORMANCE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'AUTH':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'BOOKING':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'WORKER_EXPERIENCE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'UI_DESIGN':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'FEATURE_REQUEST':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const reportedCount = items.filter((i) => i.isReported).length;

  return (
    <div class="space-y-6">
      {/* Header & Stats bar */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 class="text-xl font-bold text-text-main">Tester Feedback & Moderation</h2>
          <p class="text-xs text-text-sub mt-0.5">
            Review bug reports, user suggestions, and moderate community discussion threads.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={() => loadFeedback()}
            disabled={loading}
            class="px-3 py-1.5 bg-surface border border-border hover:bg-background rounded-lg text-xs font-semibold text-text-main transition-colors flex items-center gap-1.5"
          >
            Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          {actionSuccess}
        </div>
      )}

      {error && (
        <div class="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div class="bg-surface border border-border rounded-xl p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} class="flex flex-col sm:flex-row gap-3">
          <div class="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              placeholder="Search feedback titles, descriptions, or tester names..."
              class="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-text-main placeholder-text-sub focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <button
            type="submit"
            class="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors"
          >
            Search
          </button>
        </form>

        <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
          {/* Status Select */}
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-text-sub font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus((e.target as HTMLSelectElement).value)}
              class="px-2 py-1 text-xs bg-background border border-border rounded-md text-text-main"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="FIXED">Fixed</option>
              <option value="WONT_FIX">Won't Fix</option>
            </select>
          </div>

          {/* Category Select */}
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-text-sub font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}
              class="px-2 py-1 text-xs bg-background border border-border rounded-md text-text-main"
            >
              <option value="ALL">All Categories</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="AUTH">Authentication / Login</option>
              <option value="BOOKING">Booking Flow</option>
              <option value="WORKER_EXPERIENCE">Worker Experience</option>
              <option value="UI_DESIGN">UI / Design</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Reported Only Toggle */}
          <label class="flex items-center gap-1.5 text-xs text-text-main cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={reportedOnly}
              onChange={(e) => setReportedOnly((e.target as HTMLInputElement).checked)}
              class="rounded border-border text-red-600 focus:ring-red-500"
            />
            <span class={reportedCount > 0 ? 'text-red-700 font-semibold' : 'text-text-sub'}>
              Reported Only ({reportedCount})
            </span>
          </label>
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div class="py-12 text-center text-xs text-text-sub">Loading feedback items...</div>
      ) : items.length === 0 ? (
        <div class="bg-surface border border-border rounded-xl p-8 text-center space-y-2">
          <p class="text-sm font-semibold text-text-main">No feedback items found</p>
          <p class="text-xs text-text-sub">Try modifying your search or filter options.</p>
        </div>
      ) : (
        <div class="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              class={`bg-surface border rounded-xl p-4 shadow-xs hover:border-slate-300 transition-all ${
                item.isReported ? 'border-red-300 bg-red-50/20' : 'border-border'
              }`}
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="flex-1 space-y-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    {item.isPinned && (
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        PINNED
                      </span>
                    )}
                    {item.isReported && (
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                        REPORTED ({item.reportCount})
                      </span>
                    )}
                    <span
                      class={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadge(
                        item.category
                      )}`}
                    >
                      {item.category.replace('_', ' ')}
                    </span>
                    <span
                      class={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                    <span class="text-[11px] text-text-sub font-mono">App {item.appVersion}</span>
                  </div>

                  <h3
                    onClick={() => openDetail(item)}
                    class="text-sm font-bold text-text-main hover:text-brand cursor-pointer"
                  >
                    {item.title}
                  </h3>

                  <p class="text-xs text-text-sub line-clamp-2">{item.description}</p>

                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-sub pt-1">
                    <span>By: <strong class="text-text-main">{item.authorName}</strong> ({item.testerRole})</span>
                    {item.deviceModel && <span>Device: {item.deviceModel}</span>}
                    {item.androidVersion && <span>Android: {item.androidVersion}</span>}
                    <span>Comments: {item.commentsCount}</span>
                    <span>Date: {new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                {/* Quick Moderation Actions */}
                <div class="flex flex-wrap md:flex-col items-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                  <div class="flex items-center gap-1.5">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(item.id, (e.target as HTMLSelectElement).value as BetaFeedbackStatus)
                      }
                      class="px-2 py-1 text-xs bg-background border border-border rounded text-text-main font-medium"
                    >
                      <option value="NEW">New</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="PLANNED">Planned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="FIXED">Fixed</option>
                      <option value="WONT_FIX">Won't Fix</option>
                    </select>

                    <button
                      onClick={() => handleTogglePin(item.id, item.isPinned)}
                      title={item.isPinned ? 'Unpin' : 'Pin to top'}
                      class={`px-2.5 py-1 text-xs rounded border font-medium ${
                        item.isPinned
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-background text-text-sub border-border hover:text-text-main'
                      }`}
                    >
                      {item.isPinned ? 'Pinned' : 'Pin'}
                    </button>
                  </div>

                  <button
                    onClick={() => openDetail(item)}
                    class="px-3 py-1 bg-brand text-white text-xs font-semibold rounded hover:bg-brand-dark transition-colors"
                  >
                    View & Moderate &rarr;
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Moderation Detail Drawer / Modal */}
      {selectedItem && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-surface border border-border rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadge(
                    selectedItem.category
                  )}`}
                >
                  {selectedItem.category.replace('_', ' ')}
                </span>
                <h3 class="text-sm font-bold truncate max-w-md">{selectedItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div class="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-text-main">
              {/* Metadata strip */}
              <div class="bg-background border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span class="text-text-sub block">Submitted By</span>
                  <span class="font-bold text-text-main">{selectedItem.authorName}</span>
                </div>
                <div>
                  <span class="text-text-sub block">Tester Role</span>
                  <span class="font-semibold text-text-main">{selectedItem.testerRole}</span>
                </div>
                <div>
                  <span class="text-text-sub block">App Version</span>
                  <span class="font-mono text-text-main">{selectedItem.appVersion}</span>
                </div>
                <div>
                  <span class="text-text-sub block">Device / OS</span>
                  <span class="text-text-main">
                    {selectedItem.deviceModel || 'N/A'} {selectedItem.androidVersion ? `(Android ${selectedItem.androidVersion})` : ''}
                  </span>
                </div>
              </div>

              {/* Status & Pin Quick Controls in Modal */}
              <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-border rounded-xl">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-text-main">Resolution Status:</span>
                  <select
                    value={selectedItem.status}
                    onChange={(e) =>
                      handleStatusChange(
                        selectedItem.id,
                        (e.target as HTMLSelectElement).value as BetaFeedbackStatus
                      )
                    }
                    class="px-2.5 py-1 text-xs bg-white border border-border rounded font-semibold text-brand"
                  >
                    <option value="NEW">NEW</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="PLANNED">PLANNED</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="FIXED">FIXED</option>
                    <option value="WONT_FIX">WONT FIX</option>
                  </select>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    onClick={() => handleTogglePin(selectedItem.id, selectedItem.isPinned)}
                    class={`px-3 py-1 rounded border text-xs font-semibold ${
                      selectedItem.isPinned
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-white text-text-sub border-border hover:text-text-main'
                    }`}
                  >
                    {selectedItem.isPinned ? 'Pinned to Top' : 'Pin to Top'}
                  </button>
                </div>
              </div>

              {/* Full Description */}
              <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-text-sub uppercase tracking-wider">Report Description</h4>
                <div class="bg-surface border border-border rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
                  {selectedItem.description}
                </div>
              </div>

              {/* Screenshot if available */}
              {selectedItem.screenshotUrl && (
                <div class="space-y-1.5">
                  <h4 class="text-xs font-bold text-text-sub uppercase tracking-wider">Attached Screenshot</h4>
                  <div class="p-2 bg-background border border-border rounded-xl inline-block max-w-sm">
                    <img
                      src={getApiUrl(selectedItem.screenshotUrl)}
                      alt="Tester bug screenshot"
                      class="rounded-lg max-h-48 cursor-pointer object-cover hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImage(getApiUrl(selectedItem.screenshotUrl!))}
                    />
                    <span class="block text-[10px] text-text-sub mt-1 text-center">Click to zoom full image</span>
                  </div>
                </div>
              )}

              {/* Threaded Comments & Moderation */}
              <div class="space-y-3 pt-4 border-t border-border">
                <h4 class="text-xs font-bold text-text-main uppercase tracking-wider flex items-center justify-between">
                  <span>Discussion Comments ({comments.length})</span>
                  {loadingDetail && <span class="text-text-sub font-normal">Refreshing...</span>}
                </h4>

                {comments.length === 0 ? (
                  <p class="text-text-sub text-xs italic">No comments posted yet.</p>
                ) : (
                  <div class="space-y-2">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        class={`p-3 rounded-xl border text-xs ${
                          c.moderationStatus === 'FLAGGED'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : c.isAdmin
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-background border-border'
                        }`}
                      >
                        <div class="flex items-center justify-between gap-2 mb-1">
                          <div class="flex items-center gap-1.5">
                            <strong class="text-text-main">{c.authorName}</strong>
                            {c.isAdmin && (
                              <span class="px-1.5 py-0.2 bg-emerald-700 text-white rounded text-[9px] font-bold">
                                OFFICIAL
                              </span>
                            )}
                            <span class="text-[10px] text-text-sub">
                              {new Date(c.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Moderate comment status */}
                          <div class="flex items-center gap-1.5">
                            <span
                              class={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                c.moderationStatus === 'APPROVED'
                                  ? 'text-emerald-700 bg-emerald-100'
                                  : 'text-red-700 bg-red-100'
                              }`}
                            >
                              {c.moderationStatus}
                            </span>
                            {c.moderationStatus === 'FLAGGED' ? (
                              <button
                                onClick={() => handleModerateComment(c.id, 'APPROVED')}
                                class="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded text-[10px] font-semibold hover:bg-emerald-50"
                              >
                                Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleModerateComment(c.id, 'FLAGGED')}
                                class="px-2 py-0.5 bg-white border border-red-300 text-red-700 rounded text-[10px] font-semibold hover:bg-red-50"
                              >
                                Flag / Hide
                              </button>
                            )}
                          </div>
                        </div>

                        <p class="whitespace-pre-wrap mt-1">{c.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin Official Reply Form */}
                <form onSubmit={handleAdminReplySubmit} class="mt-4 pt-4 border-t border-border space-y-2">
                  <h5 class="text-xs font-bold text-text-main">Post Official Developer Response</h5>
                  {replyError && <p class="text-xs text-red-600">{replyError}</p>}
                  <textarea
                    rows={3}
                    value={adminReply}
                    onInput={(e) => setAdminReply((e.target as HTMLTextAreaElement).value)}
                    placeholder="Write an official update (e.g. 'Fix deployed in v2 release', 'We could not reproduce on Android 12, can you clarify?')..."
                    class="w-full p-2.5 text-xs bg-background border border-border rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <div class="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingReply || !adminReply.trim()}
                      class="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
                    >
                      {submittingReply ? 'Posting...' : 'Post Official Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div class="px-6 py-3 bg-background border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                class="px-4 py-1.5 bg-surface border border-border text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          class="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div class="relative max-w-4xl max-h-[90vh]">
            <img src={zoomImage} alt="Zoomed screenshot" class="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            <button
              onClick={() => setZoomImage(null)}
              class="absolute top-2 right-2 px-3 py-1 bg-black/60 text-white rounded text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
