import { useEffect } from 'preact/hooks';
import {
  feedbackList,
  feedbackTotal,
  isFeedbackLoading,
  feedbackError,
  selectedCategory,
  selectedStatus,
  feedbackSearch,
  feedbackSort,
  fetchFeedbackList,
  navigateBeta,
} from '../state/beta';
import { t } from '../state/language';

export function BetaFeedbackView() {
  const items = feedbackList.value;
  const total = feedbackTotal.value;
  const loading = isFeedbackLoading.value;
  const error = feedbackError.value;
  const activeCat = selectedCategory.value;
  const activeStat = selectedStatus.value;
  const activeSort = feedbackSort.value;
  const query = feedbackSearch.value;

  useEffect(() => {
    fetchFeedbackList();
  }, [activeCat, activeStat, activeSort]);

  const categories = [
    { id: '', label: t('beta.filter_all') },
    { id: 'BUG_REPORT', label: 'Bug Report' },
    { id: 'UI_DESIGN', label: 'UI / Design' },
    { id: 'PERFORMANCE', label: 'Performance' },
    { id: 'AUTH', label: 'Login / Auth' },
    { id: 'BOOKING', label: 'Booking Flow' },
    { id: 'WORKER_EXPERIENCE', label: 'Worker Experience' },
    { id: 'FEATURE_REQUEST', label: 'Feature Request' },
    { id: 'OTHER', label: 'Other' },
  ];

  const statuses = [
    { id: '', label: 'All Statuses' },
    { id: 'NEW', label: 'New' },
    { id: 'UNDER_REVIEW', label: 'Under Review' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'FIXED', label: 'Fixed' },
    { id: 'WONT_FIX', label: 'Won’t Fix' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FIXED':
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">✓ Fixed</span>;
      case 'IN_PROGRESS':
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">In Progress</span>;
      case 'UNDER_REVIEW':
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Under Review</span>;
      case 'PLANNED':
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Planned</span>;
      case 'WONT_FIX':
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">Won’t Fix</span>;
      case 'NEW':
      default:
        return <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">New</span>;
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'BUG_REPORT':
        return <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-danger">Bug</span>;
      case 'PERFORMANCE':
        return <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800">Performance</span>;
      case 'UI_DESIGN':
        return <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">Design</span>;
      case 'FEATURE_REQUEST':
        return <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">Feature</span>;
      default:
        return <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">{cat.replace(/_/g, ' ')}</span>;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {t('beta.feedback_title')}
          </h1>
          <p class="text-sm text-text-sub mt-1">
            {t('beta.feedback_subtitle')}
          </p>
        </div>

        <button
          onClick={() => navigateBeta('submit-feedback')}
          class="min-h-[44px] px-5 py-2.5 bg-brand hover:bg-brand-dark active:bg-slate-900 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <span>+ {t('beta.submit_feedback_title')}</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div class="bg-surface border border-border rounded-xl p-4 shadow-xs space-y-4">
        {/* Search & Sort Row */}
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <input
              type="text"
              placeholder="Search feedback discussions..."
              value={query}
              onInput={(e: any) => {
                feedbackSearch.value = e.target.value;
              }}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') fetchFeedbackList();
              }}
              class="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-brand"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div class="flex gap-2">
            <select
              value={activeStat}
              onChange={(e: any) => {
                selectedStatus.value = e.target.value;
              }}
              class="px-3 py-2 border border-border rounded-lg text-xs font-semibold bg-white text-text-main focus:outline-none"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={activeSort}
              onChange={(e: any) => {
                feedbackSort.value = e.target.value;
              }}
              class="px-3 py-2 border border-border rounded-lg text-xs font-semibold bg-white text-text-main focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="most_discussed">Most Discussed</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div class="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                selectedCategory.value = cat.id;
              }}
              class={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeCat === cat.id
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-text-sub hover:text-text-main'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Feed */}
      {loading ? (
        <div class="py-16 text-center space-y-3">
          <div class="w-8 h-8 mx-auto border-3 border-brand border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs text-text-sub">Loading feedback community...</p>
        </div>
      ) : error ? (
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-danger">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div class="bg-surface border border-border rounded-xl p-12 text-center space-y-4">
          <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg">
            💬
          </div>
          <h3 class="text-base font-bold text-text-main">
            No feedback found
          </h3>
          <p class="text-xs text-text-sub max-w-sm mx-auto">
            Be the first tester to report a bug, suggestion, or comment on the current beta version.
          </p>
          <button
            onClick={() => navigateBeta('submit-feedback')}
            class="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark"
          >
            Submit Feedback &rarr;
          </button>
        </div>
      ) : (
        <div class="space-y-3">
          <div class="text-xs text-text-sub font-semibold px-1">
            Showing {items.length} of {total} discussions
          </div>

          <div class="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigateBeta('feedback-detail', item.id)}
                class="bg-surface border border-border hover:border-brand/40 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer space-y-2.5"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    {item.isPinned && (
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        📌 PINNED
                      </span>
                    )}
                    {getCategoryBadge(item.category)}
                    {getStatusBadge(item.status)}
                    <span class="text-[11px] font-mono text-text-sub bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.appVersion}
                    </span>
                    <span class="text-[11px] text-text-sub capitalize">
                      ({item.testerRole})
                    </span>
                  </div>

                  <span class="text-xs text-text-sub shrink-0">
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                <h3 class="text-base font-bold text-text-main leading-snug">
                  {item.title}
                </h3>

                <p class="text-xs text-text-sub line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                <div class="flex items-center justify-between text-xs text-text-sub pt-1 border-t border-border/40">
                  <span class="font-medium text-slate-700">
                    By {item.authorName}
                    {item.deviceModel && ` &bull; ${item.deviceModel}`}
                  </span>

                  <div class="flex items-center gap-1 font-semibold text-brand">
                    <span>💬 {item.commentsCount} comments</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
