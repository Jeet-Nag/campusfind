import { useState, useEffect } from 'preact/hooks';
import { AppRelease, ApiResponse } from '@shared';
import { authToken } from '../state/auth';
import { getApiUrl } from '../config/api';

export function AdminReleasesView() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Withdraw modal state
  const [withdrawTarget, setWithdrawTarget] = useState<AppRelease | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const token = authToken.value;

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch releases
      const res = await fetch(getApiUrl('/api/admin/beta/releases'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ releases: AppRelease[] }> = await res.json();
      if (data.success && data.data) {
        setReleases(data.data.releases);
      }

      // 2. Fetch analytics
      const anaRes = await fetch(getApiUrl('/api/admin/beta/analytics'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const anaData = await anaRes.json();
      if (anaData.success && anaData.data) {
        setAnalytics(anaData.data);
      }

      // 3. Fetch audit logs
      const auditRes = await fetch(getApiUrl('/api/admin/beta/audit-logs'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const auditData = await auditRes.json();
      if (auditData.success && auditData.data) {
        setAuditLogs(auditData.data.logs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load release management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleUploadSubmit = async (e: Event) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select an APK file.');
      return;
    }
    if (!changelog.trim()) {
      setUploadError('Please enter release notes.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('apk', uploadFile);
      formData.append('changelog', changelog.trim());

      const res = await fetch(getApiUrl('/api/admin/beta/releases/upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setUploadError(json.error?.messageEn || 'Failed to upload and validate APK.');
        return;
      }

      setUploadSuccess(`Release ${json.data.release.versionDisplay} uploaded in draft status.`);
      setUploadFile(null);
      setChangelog('');
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess(null);
        loadData();
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Network error during upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handlePublish = async (release: AppRelease) => {
    if (!confirm(`Are you sure you want to publish ${release.versionDisplay} as the active latest download?`)) {
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/releases/${release.id}/publish`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (json.success) {
        loadData();
      } else {
        alert(json.error?.messageEn || 'Failed to publish release.');
      }
    } catch (err: any) {
      alert(err.message || 'Error publishing release.');
    }
  };

  const handleWithdrawConfirm = async (e: Event) => {
    e.preventDefault();
    if (!withdrawTarget) return;
    if (!withdrawReason.trim() || withdrawReason.trim().length < 3) {
      setWithdrawError('Please enter a reason for withdrawal (at least 3 characters).');
      return;
    }

    setWithdrawLoading(true);
    setWithdrawError(null);

    try {
      const res = await fetch(getApiUrl(`/api/admin/beta/releases/${withdrawTarget.id}/withdraw`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: withdrawReason.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        setWithdrawTarget(null);
        setWithdrawReason('');
        loadData();
      } else {
        setWithdrawError(json.error?.messageEn || 'Failed to withdraw release.');
      }
    } catch (err: any) {
      setWithdrawError(err.message || 'Error withdrawing release.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div class="space-y-8">
      {/* Title Bar & Actions */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-text-main">
            APK Release & Distribution Operations
          </h2>
          <p class="text-xs text-text-sub mt-0.5">
            Automatic version allocation, Android manifest extraction, and public distribution controls.
          </p>
        </div>

        <button
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
            setUploadSuccess(null);
          }}
          class="min-h-[44px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <span>+ Upload New APK Release</span>
        </button>
      </div>

      {/* Analytics KPI Cards */}
      {analytics && (
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <span class="text-xs text-text-sub block mb-1">Total Downloads</span>
            <span class="text-2xl font-black text-text-main">
              {analytics.releases?.total_downloads || 0}
            </span>
          </div>
          <div class="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <span class="text-xs text-text-sub block mb-1">Total Releases</span>
            <span class="text-2xl font-black text-text-main">
              {analytics.releases?.total_releases || 0}
            </span>
          </div>
          <div class="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <span class="text-xs text-text-sub block mb-1">Active Published</span>
            <span class="text-2xl font-black text-emerald-700">
              {analytics.releases?.published_releases || 0}
            </span>
          </div>
          <div class="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <span class="text-xs text-text-sub block mb-1">Draft Builds</span>
            <span class="text-2xl font-black text-amber-700">
              {analytics.releases?.draft_releases || 0}
            </span>
          </div>
        </div>
      )}

      {/* Releases Table */}
      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
        <div class="p-4 border-b border-border bg-slate-50 flex items-center justify-between">
          <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">
            All Android Releases ({releases.length})
          </h3>
          <button onClick={loadData} class="text-xs text-brand hover:underline font-semibold">
            Refresh
          </button>
        </div>

        {loading ? (
          <div class="py-12 text-center text-xs text-text-sub">Loading releases...</div>
        ) : error ? (
          <div class="p-4 text-xs text-danger bg-red-50">{error}</div>
        ) : releases.length === 0 ? (
          <div class="py-12 text-center text-xs text-text-sub">
            No releases uploaded yet. Click "Upload New APK Release" to upload the first build.
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-text-sub font-semibold border-b border-border">
                <tr>
                  <th class="p-3.5">Release</th>
                  <th class="p-3.5">Android Code & Name</th>
                  <th class="p-3.5">Size</th>
                  <th class="p-3.5">Status</th>
                  <th class="p-3.5">Downloads</th>
                  <th class="p-3.5">SHA-256</th>
                  <th class="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                {releases.map((rel) => {
                  return (
                    <tr key={rel.id} class="hover:bg-slate-50/80">
                      <td class="p-3.5 font-bold text-text-main">
                        <div class="flex items-center gap-1.5">
                          <span>{rel.versionDisplay}</span>
                          {rel.isLatest && (
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td class="p-3.5 text-text-sub font-mono">
                        Code {rel.androidVersionCode} &bull; v{rel.versionName}
                      </td>
                      <td class="p-3.5 text-text-sub">
                        {formatBytes(rel.fileSize)}
                      </td>
                      <td class="p-3.5">
                        {rel.releaseStatus === 'published' ? (
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            PUBLISHED
                          </span>
                        ) : rel.releaseStatus === 'draft' ? (
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            DRAFT
                          </span>
                        ) : (
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-danger">
                            WITHDRAWN
                          </span>
                        )}
                      </td>
                      <td class="p-3.5 font-semibold text-text-main">
                        {rel.downloadCount}
                      </td>
                      <td class="p-3.5 font-mono text-[11px] text-text-sub" title={rel.sha256}>
                        {rel.sha256.slice(0, 10)}...
                      </td>
                      <td class="p-3.5 text-right space-x-2">
                        {rel.releaseStatus === 'draft' && (
                          <button
                            onClick={() => handlePublish(rel)}
                            class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Publish
                          </button>
                        )}

                        {rel.releaseStatus === 'published' && (
                          <button
                            onClick={() => {
                              setWithdrawTarget(rel);
                              setWithdrawReason('');
                              setWithdrawError(null);
                            }}
                            class="px-2.5 py-1 border border-red-300 text-danger hover:bg-red-50 font-semibold rounded text-[11px] cursor-pointer"
                          >
                            Withdraw
                          </button>
                        )}

                        <a
                          href={getApiUrl(`/api/beta/releases/${rel.id}/download`)}
                          download
                          class="px-2.5 py-1 border border-border text-text-sub hover:text-text-main rounded text-[11px] inline-block"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit History Log */}
      <div class="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-3">
        <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">
          Recent Release Audit Trail
        </h3>
        {auditLogs.length === 0 ? (
          <p class="text-xs text-text-sub">No recent audit records.</p>
        ) : (
          <div class="divide-y divide-border text-xs">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} class="py-2.5 flex items-center justify-between text-text-sub">
                <div>
                  <span class="font-bold text-text-main mr-2 font-mono">{log.action}</span>
                  <span>{log.entity_type} {log.entity_id.slice(0, 8)}...</span>
                  {log.details && (
                    <span class="ml-2 font-mono text-[11px] text-slate-500">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </span>
                  )}
                </div>
                <div class="shrink-0 text-slate-400">
                  {new Date(log.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal Dialog */}
      {isUploadOpen && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-text-main">
                Upload New Android APK Release
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                disabled={uploadLoading}
                class="text-text-sub hover:text-text-main font-bold"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-text-sub leading-relaxed">
              The server will automatically parse the APK binary, verify the package ID (<code class="font-mono">in.chandilservices.app</code>), allocate the next release number, and compute its SHA-256 hash.
            </p>

            {uploadError && (
              <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-medium">
                ⚠️ {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div class="p-3 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold">
                ✓ {uploadSuccess}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  APK Binary File (.apk) <span class="text-danger">*</span>
                </label>
                <input
                  type="file"
                  required
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(e: any) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={uploadLoading}
                  class="w-full text-xs text-text-sub file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  Release Notes / Changelog <span class="text-danger">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="What changed in this build? e.g. Fixed crash on Android 10, improved voice note recording clarity..."
                  value={changelog}
                  onInput={(e: any) => setChangelog(e.target.value)}
                  disabled={uploadLoading}
                  class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand leading-relaxed"
                ></textarea>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={uploadLoading}
                  class="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  class="px-5 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploadLoading ? 'Verifying APK...' : 'Upload & Validate APK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal Dialog */}
      {withdrawTarget && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 class="text-base font-bold text-danger">
              Withdraw Release {withdrawTarget.versionDisplay}
            </h3>

            <p class="text-xs text-text-sub leading-relaxed">
              Withdrawing a release removes it from active recommendation. Please state the reason for withdrawing this release:
            </p>

            {withdrawError && (
              <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs">
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdrawConfirm} class="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="e.g. Critical payment gateway bug identified. Replaced by v2."
                value={withdrawReason}
                onInput={(e: any) => setWithdrawReason(e.target.value)}
                disabled={withdrawLoading}
                class="w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand"
              ></textarea>

              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawTarget(null)}
                  disabled={withdrawLoading}
                  class="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  class="px-5 py-2 bg-danger hover:bg-red-800 text-white font-bold text-xs rounded-lg"
                >
                  {withdrawLoading ? 'Withdrawing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
