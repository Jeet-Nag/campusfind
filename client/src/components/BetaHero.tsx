import { useState } from 'preact/hooks';
import { latestRelease, isReleasesLoading, navigateBeta } from '../state/beta';
import { t } from '../state/language';
import { getApiUrl } from '../config/api';

export function BetaHero() {
  const release = latestRelease.value;
  const loading = isReleasesLoading.value;
  const [copied, setCopied] = useState(false);

  const handleCopySha256 = (sha: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sha).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Recent build';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent build';
    }
  };

  return (
    <section class="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-brand-dark via-brand to-slate-900 text-white">
      {/* Restrained architectural grid texture for depth */}
      <div
        class="absolute inset-0 opacity-[0.03] pointer-events-none"
        style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 24px 24px;"
      ></div>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Editorial Headline & Beta Mission */}
          <div class="lg:col-span-7 space-y-5">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{t('beta.portal_badge')}</span>
              <span class="text-slate-400 text-[10px]">&bull;</span>
              <span class="text-slate-300">Android Build</span>
            </div>

            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {t('beta.hero_title')}
            </h1>

            <p class="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              {t('beta.hero_subtitle')}
            </p>

            {/* Quick action buttons */}
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => navigateBeta('download')}
                class="px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-sm text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                </svg>
                <span>{t('beta.download_latest_btn')}</span>
              </button>

              <button
                onClick={() => navigateBeta('submit-feedback')}
                class="px-4 py-3 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-800 border border-slate-600 text-sm font-semibold text-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 24 24">
                  <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4 7.58 4 4 7.58 4 12H1l4 4 4-4H6z" />
                </svg>
                <span>{t('beta.report_bug_btn')}</span>
              </button>

              <button
                onClick={() => navigateBeta('feedback')}
                class="px-4 py-3 rounded-lg hover:bg-slate-800/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <span>{t('beta.feedback_title')} &rarr;</span>
              </button>
            </div>

            {/* Pre-launch Disclaimer Warning */}
            <div class="p-3.5 rounded-lg bg-amber-950/60 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5 max-w-xl">
              <span class="text-amber-400 font-bold shrink-0 text-base leading-none mt-0.5">⚠️</span>
              <div class="leading-relaxed">
                <span class="font-bold text-amber-300">{t('beta.beta_warning_title')}:</span>{' '}
                {t('beta.beta_warning_desc')}
              </div>
            </div>
          </div>

          {/* Right Column: Dimensional Layered Release Card */}
          <div class="lg:col-span-5">
            <div class="relative">
              {/* Subtle back depth card */}
              <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-blue-500/20 blur-sm transform -rotate-1"></div>

              {/* Main Dimensional Card */}
              <div class="relative bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-2xl space-y-5">
                <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span class="text-[11px] font-bold tracking-wider text-slate-400 uppercase block">
                      Current Testing Build
                    </span>
                    <div class="flex items-baseline gap-2 mt-0.5">
                      <span class="text-2xl font-black text-white">
                        {release ? release.versionDisplay : 'v1.0-beta'}
                      </span>
                      {release && (
                        <span class="text-xs text-slate-400 font-mono">
                          (Code {release.androidVersionCode} &bull; {release.versionName})
                        </span>
                      )}
                    </div>
                  </div>

                  <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wider">
                    {release ? 'Active Release' : 'Staging Ready'}
                  </span>
                </div>

                {/* Release Metadata Grid */}
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="bg-slate-800/80 border border-slate-700/60 p-3 rounded-lg">
                    <span class="text-slate-400 block mb-0.5">{t('beta.file_size_label')}</span>
                    <span class="text-slate-100 font-semibold text-sm">
                      {release ? formatBytes(release.fileSize) : '7.5 MB'}
                    </span>
                  </div>

                  <div class="bg-slate-800/80 border border-slate-700/60 p-3 rounded-lg">
                    <span class="text-slate-400 block mb-0.5">{t('beta.release_date_label')}</span>
                    <span class="text-slate-100 font-semibold text-sm">
                      {release ? formatDate(release.publishedAt || release.createdAt) : 'Today'}
                    </span>
                  </div>

                  <div class="col-span-2 bg-slate-800/80 border border-slate-700/60 p-3 rounded-lg space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400">{t('beta.checksum_label')}</span>
                      {release && (
                        <button
                          onClick={() => handleCopySha256(release.sha256)}
                          class="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                        >
                          {copied ? t('beta.checksum_copied') : 'Copy'}
                        </button>
                      )}
                    </div>
                    <p class="font-mono text-[11px] text-slate-300 break-all select-all">
                      {release ? release.sha256 : 'ECC348AF972999745F6206B47B03083D545D08D9243184AC86E84370E9E98283'}
                    </p>
                  </div>
                </div>

                {/* Changelog Snippet */}
                {release && release.changelog && (
                  <div class="border-t border-slate-800 pt-3">
                    <span class="text-xs font-bold text-slate-300 block mb-1">
                      {t('beta.latest_changelog_title')}:
                    </span>
                    <p class="text-xs text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-line">
                      {release.changelog}
                    </p>
                  </div>
                )}

                {/* Primary Download Button */}
                {release ? (
                  <a
                    href={getApiUrl(`/api/beta/releases/${release.id}/download`)}
                    download
                    class="w-full min-h-[48px] px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                    </svg>
                    <span>Download {release.versionDisplay} APK</span>
                  </a>
                ) : (
                  <button
                    onClick={() => navigateBeta('download')}
                    class="w-full min-h-[48px] px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2"
                  >
                    <span>Browse Release Center &rarr;</span>
                  </button>
                )}

                <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Package: in.chandilservices.app</span>
                  <span>{t('beta.supported_android')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
