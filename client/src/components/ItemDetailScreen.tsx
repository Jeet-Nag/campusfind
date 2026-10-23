import { useEffect, useState } from 'preact/hooks';
import {
  activeItem,
  activeItemClaims,
  itemDetailLoading,
  itemDetailError,
  fetchItemDetail,
  submitClaimRequest,
  reviewClaimRequest,
  updateItemReport,
  deleteItemReport,
  navigateTo,
  showNotification,
} from '../state/campus';
import { currentUser, isAuthenticated } from '../state/auth';
import { CAMPUS_CATEGORIES, CampusItemStatus } from '@shared';

interface ItemDetailScreenProps {
  itemId: string;
}

export function ItemDetailScreen({ itemId }: ItemDetailScreenProps) {
  // Claim submission form state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimantName, setClaimantName] = useState(currentUser.value?.fullName || '');
  const [claimantContact, setClaimantContact] = useState(currentUser.value?.email || '');
  const [distinguishingFeature, setDistinguishingFeature] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Owner claim review response
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null);
  const [ownerResponseMessage, setOwnerResponseMessage] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (itemId) {
      fetchItemDetail(itemId);
    }
  }, [itemId, currentUser.value?.id]);

  if (itemDetailLoading.value) {
    return (
      <div class="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div class="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs text-text-sub font-semibold">Loading item details...</p>
      </div>
    );
  }

  if (itemDetailError.value || !activeItem.value) {
    return (
      <div class="max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-8 text-center space-y-3">
        <div class="text-3xl">⚠️</div>
        <h2 class="text-base font-bold text-text-main">Item Not Found</h2>
        <p class="text-xs text-text-sub">
          {itemDetailError.value || 'This report may have been deleted or does not exist.'}
        </p>
        <button
          onClick={() => navigateTo('browse')}
          class="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors"
        >
          Back to Browse Items
        </button>
      </div>
    );
  }

  const item = activeItem.value;
  const isOwner = currentUser.value?.id === item.userId;
  const isLost = item.type === 'lost';
  const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);

  // Submit Claim handler
  const handleSubmitClaim = async (e: Event) => {
    e.preventDefault();
    if (!distinguishingFeature.trim() || distinguishingFeature.trim().length < 5) {
      setClaimError('Please describe a distinguishing feature (at least 5 characters).');
      return;
    }
    if (!claimantContact.trim()) {
      setClaimError('Please provide your campus email or phone.');
      return;
    }

    setSubmittingClaim(true);
    setClaimError(null);

    const res = await submitClaimRequest(item.id, {
      claimantName: claimantName.trim() || 'Student Claimant',
      claimantContact: claimantContact.trim(),
      distinguishingFeature: distinguishingFeature.trim(),
      message: claimMessage.trim() || undefined,
    });

    setSubmittingClaim(false);

    if (res.success) {
      setShowClaimModal(false);
      setDistinguishingFeature('');
      setClaimMessage('');
      showNotification('Your claim has been submitted to the reporter!', 'success');
    } else {
      setClaimError(res.error || 'Failed to submit claim.');
    }
  };

  // Review Claim handler (Owner accept/reject)
  const handleReviewClaim = async (claimId: string, status: 'accepted' | 'rejected') => {
    setReviewSubmitting(true);
    const res = await reviewClaimRequest(claimId, status, ownerResponseMessage || undefined);
    setReviewSubmitting(false);

    if (res.success) {
      setReviewingClaimId(null);
      setOwnerResponseMessage('');
      showNotification(
        status === 'accepted'
          ? 'Claim accepted! Communication instructions sent.'
          : 'Claim declined.',
        'info'
      );
    } else {
      showNotification(res.error || 'Failed to review claim.', 'error');
    }
  };

  // Update Item Status handler (Owner mark returned / reopen)
  const handleStatusChange = async (newStatus: CampusItemStatus) => {
    const res = await updateItemReport(item.id, { status: newStatus });
    if (res.success) {
      showNotification(`Item marked as ${newStatus.replace('_', ' ')}.`, 'success');
    } else {
      showNotification(res.error || 'Failed to update status.', 'error');
    }
  };

  // Delete Item handler
  const handleDeleteItem = async () => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }
    const res = await deleteItemReport(item.id);
    if (res.success) {
      showNotification('Report deleted successfully.', 'info');
      navigateTo('browse');
    } else {
      showNotification(res.error || 'Failed to delete report.', 'error');
    }
  };

  return (
    <div class="max-w-2xl mx-auto pb-16 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigateTo('browse')}
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-text-sub hover:text-brand transition-colors"
      >
        <span>←</span> Back to Browse
      </button>

      {/* Main Item Card */}
      <div class="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
        {/* Photo or Header Illustration */}
        <div class="h-64 sm:h-72 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              class="w-full h-full object-cover"
            />
          ) : (
            <div class="flex flex-col items-center justify-center text-slate-400">
              <span class="text-6xl mb-2">{catInfo?.icon || '📦'}</span>
              <span class="text-xs font-semibold uppercase tracking-wider">{catInfo?.label}</span>
            </div>
          )}

          {/* Type Badge */}
          <div class="absolute top-4 left-4">
            <span
              class={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-md shadow-sm ${
                isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isLost ? '📢 Lost Item' : '🎁 Found Item'}
            </span>
          </div>

          {/* Status Badge */}
          <div class="absolute top-4 right-4">
            <span
              class={`text-xs font-bold px-3 py-1 rounded-md shadow-sm backdrop-blur-md ${
                item.status === 'returned'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : item.status === 'claim_pending'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-white/95 text-text-sub border border-border'
              }`}
            >
              {item.status === 'returned'
                ? '✓ Returned / Resolved'
                : item.status === 'claim_pending'
                ? '⏳ Claim Pending'
                : '● Open'}
            </span>
          </div>
        </div>

        {/* Item Details Body */}
        <div class="p-6 space-y-5">
          {/* Title & Category */}
          <div>
            <div class="flex items-center gap-2 text-xs font-semibold text-text-sub mb-1">
              <span>{catInfo?.icon}</span>
              <span>{catInfo?.label}</span>
            </div>
            <h1 class="text-2xl font-extrabold text-text-main leading-tight">{item.title}</h1>
          </div>

          {/* Quick Info Grid */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-border/70 rounded-xl text-xs">
            <div>
              <span class="text-text-sub font-medium block">Campus Location</span>
              <span class="text-text-main font-bold mt-0.5 block">📍 {item.location}</span>
            </div>
            <div>
              <span class="text-text-sub font-medium block">
                {isLost ? 'Date Lost' : 'Date Found'}
              </span>
              <span class="text-text-main font-bold mt-0.5 block">📅 {item.dateOccurred}</span>
            </div>
            <div>
              <span class="text-text-sub font-medium block">Reported By</span>
              <span class="text-text-main font-bold mt-0.5 block">
                👤 {item.reporterName || 'Campus Student'}
              </span>
            </div>
            <div>
              <span class="text-text-sub font-medium block">Handoff / Contact Point</span>
              <span class="text-text-main font-bold mt-0.5 block">🏢 {item.contactMethod}</span>
            </div>
          </div>

          {/* Description */}
          <div class="space-y-1.5">
            <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">Description</h3>
            <p class="text-sm text-text-sub leading-relaxed whitespace-pre-line bg-background p-3.5 rounded-xl border border-border/60">
              {item.description}
            </p>
          </div>

          {/* Private Sensitive Details Box (Owner Only) */}
          {isOwner && item.isSensitive && item.sensitiveDetails && (
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <span>🔒</span> Confidential Distinguishing Details (Private to You)
              </div>
              <p class="text-xs text-amber-800 leading-relaxed">{item.sensitiveDetails}</p>
              <p class="text-[10px] text-amber-700/80 mt-1">
                This was hidden from public listings to protect confidential IDs or numbers. Use this to verify submitted claims below.
              </p>
            </div>
          )}

          {/* Student Privacy & Safety Reminder for Non-Owners */}
          {!isOwner && (
            <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
              <span class="text-lg">🛡️</span>
              <div class="text-xs text-blue-900">
                <span class="font-bold">Privacy Protected:</span> Direct personal phone and email addresses are withheld to safeguard student privacy. If this item belongs to you, submit a claim below describing a distinguishing feature.
              </div>
            </div>
          )}

          {/* Action Row */}
          <div class="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            {isOwner ? (
              /* Owner Actions */
              <div class="w-full space-y-3">
                <div class="text-xs font-bold text-text-main flex items-center justify-between">
                  <span>Manage Your Report:</span>
                  <button
                    onClick={handleDeleteItem}
                    class="text-xs font-semibold text-danger hover:underline"
                  >
                    Delete Report
                  </button>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStatusChange('returned')}
                    disabled={item.status === 'returned'}
                    class={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                      item.status === 'returned'
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    ✓ Mark as Returned / Resolved
                  </button>

                  <button
                    onClick={() => handleStatusChange('open')}
                    disabled={item.status === 'open'}
                    class={`px-4 py-2 text-xs font-bold rounded-xl border border-border transition-colors ${
                      item.status === 'open'
                        ? 'bg-slate-100 text-text-sub cursor-default'
                        : 'text-text-main hover:bg-slate-100'
                    }`}
                  >
                    Set to Open
                  </button>

                  <button
                    onClick={() => handleStatusChange('claim_pending')}
                    disabled={item.status === 'claim_pending'}
                    class={`px-4 py-2 text-xs font-bold rounded-xl border border-border transition-colors ${
                      item.status === 'claim_pending'
                        ? 'bg-blue-100 text-blue-800 cursor-default'
                        : 'text-text-main hover:bg-slate-100'
                    }`}
                  >
                    Set to Claim Pending
                  </button>
                </div>
              </div>
            ) : (
              /* Non-Owner Claimant Actions */
              <div class="w-full flex items-center justify-between">
                {isAuthenticated.value ? (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    disabled={item.status === 'returned'}
                    class={`w-full py-3.5 px-6 font-bold text-sm text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
                      item.status === 'returned'
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-brand hover:bg-brand-dark'
                    }`}
                  >
                    <span>🤝</span>
                    {item.status === 'returned'
                      ? 'Item Already Returned'
                      : isLost
                      ? 'I Found This Item (Contact Reporter)'
                      : 'Claim This Item (Prove Ownership)'}
                  </button>
                ) : (
                  <button
                    onClick={() => navigateTo('auth')}
                    class="w-full py-3.5 px-6 font-bold text-sm bg-brand hover:bg-brand-dark text-white rounded-xl shadow-xs transition-colors"
                  >
                    Sign In to Claim This Item
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Owner View: Received Claims Section */}
      {isOwner && (
        <section class="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-text-main">Submitted Claims & Verification Requests</h2>
              <p class="text-xs text-text-sub">
                Review distinguishing feature proofs submitted by students
              </p>
            </div>
            <span class="px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-bold">
              {activeItemClaims.value.length} {activeItemClaims.value.length === 1 ? 'Claim' : 'Claims'}
            </span>
          </div>

          {activeItemClaims.value.length === 0 ? (
            <div class="p-6 bg-background rounded-xl border border-dashed border-border text-center">
              <p class="text-xs text-text-sub font-medium">No claims submitted yet for this item.</p>
            </div>
          ) : (
            <div class="space-y-4">
              {activeItemClaims.value.map((claim) => (
                <div
                  key={claim.id}
                  class="p-4 bg-background border border-border rounded-xl space-y-3"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="text-sm font-bold text-text-main">{claim.claimantName}</div>
                      <div class="text-xs text-text-sub">Contact: <strong>{claim.claimantContact}</strong></div>
                    </div>
                    <span
                      class={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        claim.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : claim.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {claim.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Distinguishing Feature Proof */}
                  <div class="p-3 bg-white border border-border rounded-lg text-xs space-y-1">
                    <span class="font-bold text-brand block">Distinguishing Feature Proof:</span>
                    <p class="text-text-main leading-relaxed">{claim.distinguishingFeature}</p>
                  </div>

                  {claim.message && (
                    <div class="text-xs text-text-sub">
                      <strong>Note from claimant:</strong> {claim.message}
                    </div>
                  )}

                  {claim.ownerResponse && (
                    <div class="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <strong>Your response:</strong> {claim.ownerResponse}
                    </div>
                  )}

                  {/* Owner Action Buttons */}
                  {claim.status === 'pending' && (
                    <div class="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => setReviewingClaimId(claim.id)}
                        class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Accept Claim
                      </button>
                      <button
                        onClick={() => handleReviewClaim(claim.id, 'rejected')}
                        class="px-3.5 py-1.5 border border-border text-text-sub hover:text-danger hover:bg-slate-100 text-xs font-bold rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {/* Response message input when accepting */}
                  {reviewingClaimId === claim.id && (
                    <div class="p-3 bg-white border border-emerald-200 rounded-lg space-y-2">
                      <label class="block text-xs font-bold text-emerald-900">
                        Instructions / Meeting Point for Claimant:
                      </label>
                      <input
                        type="text"
                        value={ownerResponseMessage}
                        onInput={(e) => setOwnerResponseMessage((e.target as HTMLInputElement).value)}
                        placeholder="e.g. Can meet at Library Circulation Desk today at 3pm, or call me at..."
                        class="w-full px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 text-text-main"
                      />
                      <div class="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewClaim(claim.id, 'accepted')}
                          disabled={reviewSubmitting}
                          class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                        >
                          {reviewSubmitting ? 'Confirming...' : 'Confirm Acceptance'}
                        </button>
                        <button
                          onClick={() => setReviewingClaimId(null)}
                          class="px-3 py-1.5 text-xs text-text-sub hover:text-text-main font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Claim Modal / Drawer */}
      {showClaimModal && (
        <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-lg font-bold text-text-main">
                  {isLost ? 'Contact Item Reporter' : 'Submit Ownership Claim'}
                </h3>
                <p class="text-xs text-text-sub mt-0.5">
                  Prove ownership by describing secret distinguishing features.
                </p>
              </div>
              <button
                onClick={() => setShowClaimModal(false)}
                class="text-text-sub hover:text-text-main text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {claimError && (
              <div class="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {claimError}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-text-main mb-1">
                  Your Full Name <span class="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={claimantName}
                  onInput={(e) => setClaimantName((e.target as HTMLInputElement).value)}
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                  required
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-text-main mb-1">
                  Your Campus Email or Phone <span class="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={claimantContact}
                  onInput={(e) => setClaimantContact((e.target as HTMLInputElement).value)}
                  placeholder="e.g. student@campus.edu or 9876543210"
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                  required
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-text-main mb-1">
                  Distinguishing Feature Proof <span class="text-danger">*</span>
                </label>
                <textarea
                  rows={3}
                  value={distinguishingFeature}
                  onInput={(e) => setDistinguishingFeature((e.target as HTMLTextAreaElement).value)}
                  placeholder="Describe a distinguishing feature NOT visible in public photos (e.g. lock screen wallpaper, specific sticker, engraving, dent, scratch, serial number, inside contents)..."
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                  required
                />
                <p class="text-[11px] text-text-sub mt-1">
                  🛡️ This description is only shared with the person who reported the item to verify legitimate ownership.
                </p>
              </div>

              <div>
                <label class="block text-xs font-bold text-text-main mb-1">
                  Message / Pickup Arrangement (Optional)
                </label>
                <input
                  type="text"
                  value={claimMessage}
                  onInput={(e) => setClaimMessage((e.target as HTMLInputElement).value)}
                  placeholder="e.g. I can meet at the library desk between 2-4 PM today."
                  class="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                />
              </div>

              <div class="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  class="px-4 py-2.5 text-xs text-text-sub hover:text-text-main font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  class="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-xs"
                >
                  {submittingClaim ? 'Submitting Claim...' : 'Send Claim Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
