import { useEffect, useState } from 'preact/hooks';
import {
  myReports,
  myClaims,
  myReportsLoading,
  myReportsError,
  fetchMyReports,
  updateItemReport,
  deleteItemReport,
  navigateTo,
  showNotification,
} from '../state/campus';
import { currentUser, isAuthenticated } from '../state/auth';
import { CAMPUS_CATEGORIES, CampusItemStatus } from '@shared';

export function MyReportsScreen() {
  const [activeTab, setActiveTab] = useState<'reports' | 'claims'>('reports');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContact, setEditContact] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isAuthenticated.value) {
      fetchMyReports();
    }
  }, [isAuthenticated.value]);

  if (!isAuthenticated.value) {
    return (
      <div class="max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-8 text-center space-y-4">
        <div class="text-4xl">👤</div>
        <h2 class="text-lg font-bold text-text-main">Sign In Required</h2>
        <p class="text-xs text-text-sub">
          Please sign in to view and manage your reported items and claims.
        </p>
        <button
          onClick={() => navigateTo('auth')}
          class="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-xs"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleStatusChange = async (itemId: string, status: CampusItemStatus) => {
    const res = await updateItemReport(itemId, { status });
    if (res.success) {
      showNotification(`Item status updated to ${status.replace('_', ' ')}.`, 'success');
      fetchMyReports();
    } else {
      showNotification(res.error || 'Failed to update status.', 'error');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    const res = await deleteItemReport(itemId);
    if (res.success) {
      showNotification('Report deleted successfully.', 'info');
      fetchMyReports();
    } else {
      showNotification(res.error || 'Failed to delete report.', 'error');
    }
  };

  const startEditing = (item: any) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditContact(item.contactMethod);
  };

  const handleSaveEdit = async (itemId: string) => {
    setSavingEdit(true);
    const res = await updateItemReport(itemId, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      contactMethod: editContact.trim(),
    });
    setSavingEdit(false);

    if (res.success) {
      setEditingItemId(null);
      showNotification('Report updated successfully.', 'success');
      fetchMyReports();
    } else {
      showNotification(res.error || 'Failed to update report.', 'error');
    }
  };

  return (
    <div class="max-w-3xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold text-brand tracking-tight">My Campus Dashboard</h1>
          <p class="text-xs text-text-sub mt-0.5">
            Logged in as <strong>{currentUser.value?.fullName}</strong> ({currentUser.value?.email})
          </p>
        </div>

        {/* Quick Report Actions */}
        <div class="flex items-center gap-2">
          <button
            onClick={() => navigateTo('report-lost')}
            class="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-2xs"
          >
            + Report Lost
          </button>
          <button
            onClick={() => navigateTo('report-found')}
            class="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
          >
            + Report Found
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex items-center p-1 bg-slate-100 rounded-xl max-w-sm">
        <button
          onClick={() => setActiveTab('reports')}
          class={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'reports'
              ? 'bg-white text-text-main shadow-xs'
              : 'text-text-sub hover:text-text-main'
          }`}
        >
          <span>📋</span> My Reports ({myReports.value.length})
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          class={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'claims'
              ? 'bg-white text-text-main shadow-xs'
              : 'text-text-sub hover:text-text-main'
          }`}
        >
          <span>🤝</span> My Claims ({myClaims.value.length})
        </button>
      </div>

      {/* Error or Loading */}
      {myReportsLoading.value ? (
        <div class="py-12 text-center text-xs text-text-sub font-semibold">
          Loading your campus dashboard...
        </div>
      ) : myReportsError.value ? (
        <div class="p-4 bg-rose-50 text-rose-800 rounded-xl text-xs">{myReportsError.value}</div>
      ) : activeTab === 'reports' ? (
        /* Tab 1: My Reported Items */
        myReports.value.length === 0 ? (
          <div class="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
            <div class="text-3xl">📭</div>
            <h3 class="text-sm font-bold text-text-main">No Reports Posted Yet</h3>
            <p class="text-xs text-text-sub">
              You haven't posted any lost or found items on CampusFind yet.
            </p>
            <div class="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => navigateTo('report-lost')}
                class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Report Lost Item
              </button>
              <button
                onClick={() => navigateTo('report-found')}
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Report Found Item
              </button>
            </div>
          </div>
        ) : (
          <div class="space-y-4">
            {myReports.value.map((item) => {
              const isLost = item.type === 'lost';
              const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);

              return (
                <div
                  key={item.id}
                  class="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4 transition-all"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <span
                        class={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isLost ? 'Lost' : 'Found'}
                      </span>
                      <span class="text-xs font-semibold text-text-sub">
                        {catInfo?.icon} {catInfo?.label}
                      </span>
                      <span class="text-xs text-text-sub">• 📅 {item.dateOccurred}</span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <span
                        class={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          item.status === 'returned'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.status === 'claim_pending'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-slate-100 text-slate-800 border border-border'
                        }`}
                      >
                        Status: {item.status === 'returned' ? '✓ Returned' : item.status === 'claim_pending' ? '⏳ Claim Pending' : '● Open'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description or Edit Mode */}
                  {editingItemId === item.id ? (
                    <div class="space-y-3 p-3 bg-slate-50 border border-border rounded-xl">
                      <div>
                        <label class="block text-[11px] font-bold text-text-main mb-1">Item Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onInput={(e) => setEditTitle((e.target as HTMLInputElement).value)}
                          class="w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-main mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onInput={(e) => setEditDescription((e.target as HTMLTextAreaElement).value)}
                          class="w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-main mb-1">Contact Method</label>
                        <input
                          type="text"
                          value={editContact}
                          onInput={(e) => setEditContact((e.target as HTMLInputElement).value)}
                          class="w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs"
                        />
                      </div>
                      <div class="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={savingEdit}
                          class="px-3.5 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-dark"
                        >
                          {savingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          class="px-3.5 py-1.5 text-xs text-text-sub hover:text-text-main"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3
                        onClick={() => navigateTo('item-detail', item.id)}
                        class="text-base font-bold text-text-main hover:text-brand cursor-pointer transition-colors"
                      >
                        {item.title}
                      </h3>
                      <p class="text-xs text-text-sub mt-1 leading-relaxed">{item.description}</p>
                      <div class="text-[11px] text-text-sub mt-2">
                        <span>📍 Location: <strong>{item.location}</strong></span> |{' '}
                        <span>Claims received: <strong>{item.claimsCount || 0}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div class="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5">
                      <button
                        onClick={() => navigateTo('item-detail', item.id)}
                        class="px-3 py-1.5 text-xs font-bold bg-brand/10 hover:bg-brand/20 text-brand rounded-lg transition-colors"
                      >
                        View Details & Claims ({item.claimsCount || 0})
                      </button>
                      <button
                        onClick={() => startEditing(item)}
                        class="px-3 py-1.5 text-xs font-semibold border border-border hover:bg-slate-100 text-text-sub rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        class="px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div class="flex items-center gap-1.5">
                      {item.status !== 'returned' ? (
                        <button
                          onClick={() => handleStatusChange(item.id, 'returned')}
                          class="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                        >
                          ✓ Mark Returned
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(item.id, 'open')}
                          class="px-3 py-1.5 text-xs font-semibold border border-border text-text-sub hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Reopen Item
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Tab 2: My Claims */
        myClaims.value.length === 0 ? (
          <div class="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
            <div class="text-3xl">🤝</div>
            <h3 class="text-sm font-bold text-text-main">No Claims Submitted</h3>
            <p class="text-xs text-text-sub">
              When you find a lost or found item that belongs to you, you can submit a claim.
            </p>
            <button
              onClick={() => navigateTo('browse')}
              class="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors"
            >
              Browse Campus Items
            </button>
          </div>
        ) : (
          <div class="space-y-4">
            {myClaims.value.map((claim) => (
              <div
                key={claim.id}
                class="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-text-sub block">
                      Claim for {claim.itemType?.toUpperCase() || 'ITEM'}
                    </span>
                    <h3
                      onClick={() => navigateTo('item-detail', claim.itemId)}
                      class="text-sm font-bold text-text-main hover:text-brand cursor-pointer transition-colors"
                    >
                      {claim.itemTitle || 'Campus Item'}
                    </h3>
                    <div class="text-[11px] text-text-sub mt-0.5">
                      📍 {claim.itemLocation || 'Campus'} • Submitted on {claim.createdAt.split('T')[0]}
                    </div>
                  </div>

                  <span
                    class={`text-xs font-bold px-2.5 py-1 rounded-md ${
                      claim.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : claim.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {claim.status === 'accepted'
                      ? '✓ Accepted'
                      : claim.status === 'rejected'
                      ? '✕ Declined'
                      : '⏳ Pending Review'}
                  </span>
                </div>

                <div class="p-3 bg-background border border-border rounded-xl text-xs space-y-1">
                  <span class="text-text-sub font-semibold block">Your Distinguishing Proof:</span>
                  <p class="text-text-main">{claim.distinguishingFeature}</p>
                </div>

                {claim.ownerResponse && (
                  <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                    <span class="font-bold block">Response from Reporter:</span>
                    <p>{claim.ownerResponse}</p>
                  </div>
                )}

                <div class="pt-2 flex justify-end">
                  <button
                    onClick={() => navigateTo('item-detail', claim.itemId)}
                    class="text-xs font-bold text-brand hover:underline"
                  >
                    View Item Page →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
