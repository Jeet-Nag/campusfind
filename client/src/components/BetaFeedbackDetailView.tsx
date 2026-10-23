import { useState } from 'preact/hooks';
import {
  selectedFeedback,
  selectedFeedbackComments,
  isCommentsLoading,
  isSubmitting,
  submitComment,
  reportFeedbackItem,
  navigateBeta,
} from '../state/beta';
import { t } from '../state/language';
import { getApiUrl } from '../config/api';

export function BetaFeedbackDetailView() {
  const item = selectedFeedback.value;
  const comments = selectedFeedbackComments.value;
  const loading = isCommentsLoading.value;
  const submitting = isSubmitting.value;

  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [reported, setReported] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  if (loading && !item) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <div class="w-8 h-8 mx-auto border-3 border-brand border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs text-text-sub">Loading discussion...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 class="text-lg font-bold text-text-main">Discussion Not Found</h2>
        <p class="text-xs text-text-sub">This feedback item may have been moved or removed.</p>
        <button
          onClick={() => navigateBeta('feedback')}
          class="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg"
        >
          &larr; Back to Feedback Board
        </button>
      </div>
    );
  }

  const handleCommentSubmit = async (e: Event) => {
    e.preventDefault();
    setCommentError(null);

    if (!authorName.trim()) {
      setCommentError('Please enter your name.');
      return;
    }

    if (!message.trim()) {
      setCommentError('Please enter a response message.');
      return;
    }

    const ok = await submitComment(item.id, authorName.trim(), message.trim());
    if (ok) {
      setMessage('');
      setCommentSuccess(true);
      setTimeout(() => setCommentSuccess(false), 3000);
    }
  };

  const handleReport = async () => {
    if (reported) return;
    const ok = await reportFeedbackItem(item.id);
    if (ok) {
      setReported(true);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Navigation */}
      <div class="flex items-center justify-between">
        <button
          onClick={() => navigateBeta('feedback')}
          class="text-xs font-semibold text-text-sub hover:text-brand flex items-center gap-1 cursor-pointer"
        >
          &larr; Back to Feedback Board
        </button>

        <button
          onClick={handleReport}
          disabled={reported}
          class="text-xs text-text-sub hover:text-danger font-medium cursor-pointer"
        >
          {reported ? '✓ Reported for Review' : '🚩 Report Inappropriate'}
        </button>
      </div>

      {/* Main Feedback Item Card */}
      <div class="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
            {item.category.replace(/_/g, ' ')}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            Status: {item.status}
          </span>
          <span class="text-xs font-mono text-text-sub bg-slate-50 border border-border px-2 py-0.5 rounded">
            Version {item.appVersion}
          </span>
          <span class="text-xs text-text-sub capitalize">
            Role: {item.testerRole}
          </span>
        </div>

        <h1 class="text-xl sm:text-2xl font-black text-text-main leading-tight">
          {item.title}
        </h1>

        <div class="bg-slate-50 border border-border/80 rounded-lg p-5 text-sm text-text-main leading-relaxed whitespace-pre-line">
          {item.description}
        </div>

        {/* Attached Screenshot */}
        {item.screenshotUrl && (
          <div class="space-y-2 pt-2">
            <span class="text-xs font-bold text-text-sub uppercase tracking-wider block">
              Attached Screenshot
            </span>
            <div class="inline-block border border-border rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in">
              <img
                src={getApiUrl(item.screenshotUrl)}
                alt="Tester screenshot"
                onClick={() => setZoomImage(getApiUrl(item.screenshotUrl!))}
                class="max-w-xs max-h-64 object-contain rounded hover:opacity-90 transition-opacity"
              />
            </div>
            <p class="text-[11px] text-text-sub">Click image to inspect full-size.</p>
          </div>
        )}

        {/* Poster Metadata */}
        <div class="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-text-sub">
          <div>
            Submitted by <span class="font-bold text-text-main">{item.authorName}</span>
            {item.deviceModel && ` on ${item.deviceModel}`}
            {item.androidVersion && ` (${item.androidVersion})`}
          </div>
          <div>{formatDate(item.createdAt)}</div>
        </div>
      </div>

      {/* Threaded Discussion Section */}
      <div class="space-y-6">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="text-lg font-bold text-text-main">
            {t('beta.comments_heading')} ({comments.length})
          </h2>
          <span class="text-xs text-text-sub">Public beta discussion</span>
        </div>

        {/* Comments Feed */}
        {comments.length === 0 ? (
          <div class="p-8 text-center bg-surface border border-border rounded-xl text-xs text-text-sub">
            No replies posted yet. Share your thoughts or confirm this bug below!
          </div>
        ) : (
          <div class="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                class={`p-4 rounded-xl border ${
                  comment.isAdmin
                    ? 'bg-blue-50/70 border-blue-200'
                    : 'bg-surface border-border'
                } space-y-2`}
              >
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-text-main">{comment.authorName}</span>
                    {comment.isAdmin && (
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand text-white">
                        TEAM / ADMIN
                      </span>
                    )}
                  </div>
                  <span class="text-text-sub">{formatDate(comment.createdAt)}</span>
                </div>

                <p class="text-xs text-text-main leading-relaxed whitespace-pre-line">
                  {comment.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Reply Form */}
        <div class="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4">
          <h3 class="text-sm font-bold text-text-main">Add to the Discussion</h3>

          {commentSuccess && (
            <div class="p-3 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold">
              ✓ Reply posted successfully.
            </div>
          )}

          {commentError && (
            <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-semibold">
              ⚠️ {commentError}
            </div>
          )}

          <form onSubmit={handleCommentSubmit} class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1">
                Your Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Priya Sharma"
                value={authorName}
                onInput={(e: any) => setAuthorName(e.target.value)}
                disabled={submitting}
                class="w-full px-3.5 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1">
                Response
              </label>
              <textarea
                required
                rows={3}
                placeholder={t('beta.add_comment_placeholder')}
                value={message}
                onInput={(e: any) => setMessage(e.target.value)}
                disabled={submitting}
                class="w-full px-3.5 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand leading-relaxed"
              ></textarea>
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                class="min-h-[40px] px-5 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Posting...' : t('beta.add_comment_btn')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <div class="relative max-w-4xl max-h-[90vh]">
            <img src={zoomImage} alt="Zoomed screenshot" class="max-w-full max-h-[90vh] object-contain rounded" />
            <button
              class="absolute top-2 right-2 text-white bg-black/60 px-3 py-1 rounded-full text-xs font-bold"
              onClick={() => setZoomImage(null)}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
