import { useEffect } from 'preact/hooks';
import {
  campusItems,
  itemsLoading,
  itemsError,
  filterType,
  filterCategory,
  filterLocation,
  filterStatus,
  searchQuery,
  fetchCampusItems,
  navigateTo,
} from '../state/campus';
import { CAMPUS_CATEGORIES, CAMPUS_LOCATIONS } from '@shared';

export function BrowseScreen() {
  useEffect(() => {
    fetchCampusItems();
  }, [
    filterType.value,
    filterCategory.value,
    filterLocation.value,
    filterStatus.value,
    searchQuery.value,
  ]);

  const resetFilters = () => {
    filterType.value = 'all';
    filterCategory.value = 'all';
    filterLocation.value = 'all';
    filterStatus.value = 'all';
    searchQuery.value = '';
    fetchCampusItems();
  };

  const hasActiveFilters =
    filterType.value !== 'all' ||
    filterCategory.value !== 'all' ||
    filterLocation.value !== 'all' ||
    filterStatus.value !== 'all' ||
    searchQuery.value.trim().length > 0;

  return (
    <div class="space-y-6 pb-12">
      {/* Top Header & Search */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-brand tracking-tight">Browse Campus Items</h1>
          <p class="text-xs sm:text-sm text-text-sub mt-0.5">
            Search lost items reported by students or items turned into campus desks
          </p>
        </div>

        {/* Quick Report CTAs */}
        <div class="flex items-center gap-2">
          <button
            onClick={() => navigateTo('report-lost')}
            class="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-xs"
          >
            + Report Lost
          </button>
          <button
            onClick={() => navigateTo('report-found')}
            class="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
          >
            + Report Found
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div class="bg-surface border border-border rounded-xl p-4 shadow-xs space-y-4">
        {/* Type Filter Tabs: All / Lost / Found */}
        <div class="flex items-center p-1 bg-slate-100 rounded-lg max-w-sm">
          <button
            onClick={() => {
              filterType.value = 'all';
            }}
            class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              filterType.value === 'all'
                ? 'bg-white text-text-main shadow-xs'
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => {
              filterType.value = 'lost';
            }}
            class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              filterType.value === 'lost'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-text-sub hover:text-amber-800'
            }`}
          >
            📢 Lost Items
          </button>
          <button
            onClick={() => {
              filterType.value = 'found';
            }}
            class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              filterType.value === 'found'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-text-sub hover:text-emerald-800'
            }`}
          >
            🎁 Found Items
          </button>
        </div>

        {/* Search Input & Dropdowns Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery.value}
              onInput={(e) => {
                searchQuery.value = (e.target as HTMLInputElement).value;
              }}
              placeholder="Search title, keywords..."
              class="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
            />
            {searchQuery.value && (
              <button
                onClick={() => {
                  searchQuery.value = '';
                }}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-sub hover:text-text-main"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={filterCategory.value}
              onChange={(e) => {
                filterCategory.value = (e.target as HTMLSelectElement).value;
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CAMPUS_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location Dropdown */}
          <div>
            <select
              value={filterLocation.value}
              onChange={(e) => {
                filterLocation.value = (e.target as HTMLSelectElement).value;
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer"
            >
              <option value="all">All Campus Locations</option>
              {CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  📍 {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={filterStatus.value}
              onChange={(e) => {
                filterStatus.value = (e.target as HTMLSelectElement).value;
              }}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">🟢 Open (Active)</option>
              <option value="claim_pending">🟡 Claim Pending</option>
              <option value="returned">🔵 Returned / Resolved</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Action */}
        <div class="flex items-center justify-between text-xs text-text-sub pt-1">
          <span>
            Found <strong>{campusItems.value.length}</strong> {campusItems.value.length === 1 ? 'item' : 'items'}
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              class="text-brand font-semibold hover:underline flex items-center gap-1"
            >
              <span>↺</span> Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Listing Area */}
      {itemsLoading.value ? (
        /* Loading Skeleton */
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} class="bg-surface border border-border rounded-xl p-4 space-y-3 animate-pulse">
              <div class="h-36 bg-slate-200 rounded-lg"></div>
              <div class="h-4 bg-slate-200 rounded w-3/4"></div>
              <div class="h-3 bg-slate-100 rounded w-full"></div>
              <div class="h-3 bg-slate-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : itemsError.value ? (
        /* Error State */
        <div class="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-lg mx-auto">
          <div class="text-3xl mb-2">⚠️</div>
          <h3 class="text-base font-bold text-rose-900">Unable to load items</h3>
          <p class="text-xs text-rose-700 mt-1">{itemsError.value}</p>
          <button
            onClick={() => fetchCampusItems()}
            class="mt-4 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : campusItems.value.length === 0 ? (
        /* Empty State */
        <div class="bg-surface border border-border rounded-xl p-12 text-center max-w-md mx-auto space-y-3">
          <div class="text-4xl">🔍</div>
          <h3 class="text-base font-bold text-text-main">No Items Found</h3>
          <p class="text-xs text-text-sub">
            We couldn't find any items matching your current search criteria.
          </p>
          <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                class="px-4 py-2 text-xs font-bold border border-border rounded-lg text-text-sub hover:bg-slate-100 transition-colors"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={() => navigateTo('report-lost')}
              class="px-4 py-2 text-xs font-bold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
            >
              Post a Report
            </button>
          </div>
        </div>
      ) : (
        /* Items Grid */
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {campusItems.value.map((item) => {
            const isLost = item.type === 'lost';
            const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);

            return (
              <div
                key={item.id}
                onClick={() => navigateTo('item-detail', item.id)}
                class="bg-surface border border-border hover:border-brand/70 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top Image or Icon Section */}
                  <div class="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        class="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div class="flex flex-col items-center justify-center text-slate-400">
                        <span class="text-5xl">{catInfo?.icon || '📦'}</span>
                      </div>
                    )}

                    {/* Lost vs Found Badge */}
                    <div class="absolute top-2.5 left-2.5">
                      <span
                        class={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs ${
                          isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isLost ? '📢 Lost' : '🎁 Found'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div class="absolute top-2.5 right-2.5">
                      <span
                        class={`text-[10px] font-bold px-2 py-0.5 rounded shadow-xs backdrop-blur-md ${
                          item.status === 'returned'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.status === 'claim_pending'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-white/95 text-text-sub border border-border'
                        }`}
                      >
                        {item.status === 'returned'
                          ? '✓ Returned'
                          : item.status === 'claim_pending'
                          ? '⏳ Claim Pending'
                          : '● Open'}
                      </span>
                    </div>

                    {item.isSensitive && (
                      <div class="absolute bottom-2 left-2">
                        <span class="text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                          🔒 ID / Sensitive Item
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div class="p-4 space-y-2">
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-text-sub">
                      <span>{catInfo?.icon}</span>
                      <span>{catInfo?.label || item.category}</span>
                    </div>

                    <h3 class="text-sm font-bold text-text-main line-clamp-1 group-hover:text-brand transition-colors">
                      {item.title}
                    </h3>

                    <p class="text-xs text-text-sub line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Footer Location & Date */}
                <div class="p-4 pt-2 border-t border-border/50 bg-slate-50/50 flex items-center justify-between text-[11px] text-text-sub">
                  <span class="truncate max-w-[150px] font-medium text-text-main">
                    📍 {item.location}
                  </span>
                  <span>📅 {item.dateOccurred}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
