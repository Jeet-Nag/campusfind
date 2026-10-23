import { useState } from 'preact/hooks';
import { latestRelease, releasesList, isReleasesLoading, navigateBeta } from '../state/beta';
import { t } from '../state/language';
import { getApiUrl } from '../config/api';

export function BetaDownloadView() {
  const current = latestRelease.value;
  const history = releasesList.value;
  const loading = isReleasesLoading.value;
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const handleCopy = (sha: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sha).then(() => {
        setCopiedSha(sha);
        setTimeout(() => setCopiedSha(null), 2500);
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header Breadcrumb / Title */}
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <button onClick={() => navigateBeta('home')} class="hover:text-brand cursor-pointer">
            Portal Home
          </button>
          <span>&rsaquo;</span>
          <span class="text-brand">APK Download Center</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
          Chandil Home Services Android Releases
        </h1>
        <p class="text-sm text-text-sub max-w-2xl">
          Download and test verified Android application packages (APKs). Every binary is verified server-side with cryptographic SHA-256 integrity checksums.
        </p>
      </div>

      {/* Main Active Release Card */}
      {current ? (
        <div class="bg-surface border-2 border-emerald-600/30 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  LATEST STABLE BETA
                </span>
                <span class="text-xs text-text-sub font-mono">
                  Package: in.chandilservices.app
                </span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-black text-text-main">
                Release {current.versionDisplay}
                <span class="text-base font-normal text-text-sub ml-2">
                  (v{current.versionName} &bull; Build {current.androidVersionCode})
                </span>
              </h2>
            </div>

            {/* Direct streaming download button */}
            <a
              href={getApiUrl(`/api/beta/releases/${current.id}/download`)}
              download
              class="min-h-[48px] px-6 py-3 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
              </svg>
              <span>Download APK ({formatBytes(current.fileSize)})</span>
            </a>
          </div>

          {/* Metadata Specs Grid */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div class="bg-slate-50 border border-border p-3 rounded-lg">
              <span class="text-text-sub block mb-0.5">Release Date</span>
              <span class="text-text-main font-semibold text-sm">
                {formatDate(current.publishedAt || current.createdAt)}
              </span>
            </div>
            <div class="bg-slate-50 border border-border p-3 rounded-lg">
              <span class="text-text-sub block mb-0.5">Binary Size</span>
              <span class="text-text-main font-semibold text-sm">
                {formatBytes(current.fileSize)}
              </span>
            </div>
            <div class="bg-slate-50 border border-border p-3 rounded-lg">
              <span class="text-text-sub block mb-0.5">Android Target</span>
              <span class="text-text-main font-semibold text-sm">
                API {current.targetSdk} (Android 14)
              </span>
            </div>
            <div class="bg-slate-50 border border-border p-3 rounded-lg">
              <span class="text-text-sub block mb-0.5">Minimum Required</span>
              <span class="text-text-main font-semibold text-sm">
                API {current.minSdk} (Android 6.0+)
              </span>
            </div>
          </div>

          {/* Cryptographic SHA-256 Checksum */}
          <div class="bg-slate-50 border border-border p-4 rounded-lg space-y-1.5">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-text-main">Cryptographic Checksum (SHA-256)</span>
              <button
                onClick={() => handleCopy(current.sha256)}
                class="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
              >
                {copiedSha === current.sha256 ? '✓ Checksum Copied' : 'Copy Checksum'}
              </button>
            </div>
            <p class="font-mono text-xs text-text-sub break-all select-all bg-white p-2.5 rounded border border-border/80">
              {current.sha256}
            </p>
          </div>

          {/* Full Release Changelog */}
          <div class="space-y-2 pt-2">
            <h3 class="text-sm font-bold text-text-main uppercase tracking-wider">
              {t('beta.latest_changelog_title')}
            </h3>
            <div class="bg-white border border-border p-4 rounded-lg text-sm text-text-main whitespace-pre-line leading-relaxed">
              {current.changelog}
            </div>
          </div>
        </div>
      ) : (
        <div class="bg-surface border border-border rounded-xl p-8 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
            APK
          </div>
          <h3 class="text-lg font-bold text-text-main">
            {t('beta.no_releases_yet')}
          </h3>
          <p class="text-xs text-text-sub max-w-md mx-auto">
            Please log into the Admin Operations Control Center to upload and publish the latest build.
          </p>
          <a
            href="/admin"
            class="inline-block mt-2 px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark"
          >
            Open Admin Panel &rarr;
          </a>
        </div>
      )}

      {/* Installation Step-by-Step Guide */}
      <div class="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6">
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-text-main">
            {t('beta.install_guide_title')}
          </h3>
          <p class="text-xs text-text-sub">
            Android requires manual confirmation before installing apps outside the Google Play Store.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-slate-50 border border-border p-4 rounded-lg space-y-2">
            <div class="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h4 class="text-xs font-bold text-text-main">Download File</h4>
            <p class="text-xs text-text-sub leading-relaxed">
              Tap the download button above to save the APK file onto your Android device.
            </p>
          </div>

          <div class="bg-slate-50 border border-border p-4 rounded-lg space-y-2">
            <div class="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h4 class="text-xs font-bold text-text-main">Open Downloads</h4>
            <p class="text-xs text-text-sub leading-relaxed">
              Swipe down your notification bar or open the Files app &gt; Downloads to tap the downloaded APK.
            </p>
          </div>

          <div class="bg-slate-50 border border-border p-4 rounded-lg space-y-2">
            <div class="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
              3
            </div>
            <h4 class="text-xs font-bold text-text-main">Allow Unknown Source</h4>
            <p class="text-xs text-text-sub leading-relaxed">
              If prompted, tap "Settings" and toggle "Allow from this source" for your browser/file manager.
            </p>
          </div>

          <div class="bg-slate-50 border border-border p-4 rounded-lg space-y-2">
            <div class="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
              4
            </div>
            <h4 class="text-xs font-bold text-text-main">Complete Install</h4>
            <p class="text-xs text-text-sub leading-relaxed">
              Tap "Install" (or "Update" if upgrading). Your saved data, bookings, and logins are safely kept.
            </p>
          </div>
        </div>

        <div class="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
          <span class="font-bold">Important Notice:</span> Downloading an APK does not automatically install or update the app. You must tap the downloaded file and confirm installation in Android's package installer.
        </div>
      </div>

      {/* Previous Releases Archive */}
      <div class="space-y-4">
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-text-main">
            {t('beta.previous_releases_btn')}
          </h3>
          <p class="text-xs text-text-sub">
            Historical releases retained by the testing team. Older builds may be marked as withdrawn.
          </p>
        </div>

        {history && history.length > 0 ? (
          <div class="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden shadow-xs">
            {history.map((rel) => {
              const isWithdrawn = rel.releaseStatus === 'withdrawn';
              const isCurrent = rel.id === current?.id;

              return (
                <div key={rel.id} class={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isWithdrawn ? 'bg-red-50/50' : ''}`}>
                  <div class="space-y-1.5 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-base font-bold text-text-main">
                        {rel.versionDisplay}
                      </span>
                      <span class="text-xs text-text-sub">
                        (v{rel.versionName} &bull; Code {rel.androidVersionCode})
                      </span>
                      {isCurrent && (
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          CURRENT
                        </span>
                      )}
                      {isWithdrawn && (
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-danger border border-red-200">
                          WITHDRAWN
                        </span>
                      )}
                    </div>

                    {isWithdrawn && rel.withdrawalReason && (
                      <p class="text-xs text-danger font-medium">
                        ⚠️ Reason: {rel.withdrawalReason}
                      </p>
                    )}

                    <div class="flex flex-wrap items-center gap-3 text-xs text-text-sub">
                      <span>{formatDate(rel.publishedAt || rel.createdAt)}</span>
                      <span>&bull;</span>
                      <span>{formatBytes(rel.fileSize)}</span>
                      <span>&bull;</span>
                      <button
                        onClick={() => handleCopy(rel.sha256)}
                        class="text-brand hover:underline font-mono"
                        title="Copy SHA-256 Checksum"
                      >
                        SHA-256: {rel.sha256.slice(0, 12)}...
                      </button>
                    </div>

                    {rel.changelog && (
                      <p class="text-xs text-text-sub line-clamp-2 pt-0.5">
                        {rel.changelog}
                      </p>
                    )}
                  </div>

                  <div class="shrink-0">
                    <a
                      href={getApiUrl(`/api/beta/releases/${rel.id}/download`)}
                      download
                      class={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isWithdrawn
                          ? 'border border-red-300 text-danger hover:bg-red-50'
                          : 'border border-border text-text-main hover:bg-slate-50'
                      }`}
                    >
                      <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                      </svg>
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div class="p-6 text-center text-xs text-text-sub bg-surface border border-border rounded-xl">
            No previous releases recorded.
          </div>
        )}
      </div>
    </div>
  );
}
