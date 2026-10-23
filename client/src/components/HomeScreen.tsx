import { useState } from 'preact/hooks';
import {
  navigateTo,
  searchQuery,
  filterType,
  filterCategory,
  campusItems,
  fetchCampusItems,
} from '../state/campus';
import { CAMPUS_CATEGORIES, CampusCategory } from '@shared';

export function HomeScreen() {
  const [localSearch, setLocalSearch] = useState('');

  const handleSearchSubmit = (e: Event) => {
    e.preventDefault();
    searchQuery.value = localSearch;
    navigateTo('browse');
    fetchCampusItems();
  };

  const handleCategoryClick = (catId: CampusCategory) => {
    filterCategory.value = catId;
    navigateTo('browse');
    fetchCampusItems();
  };

  // Recent 4 items
  const recentItems = campusItems.value.slice(0, 4);

  return (
    <div class="space-y-8 pb-12">
      {/* Hero Section */}
      <section class="bg-gradient-to-b from-brand/5 via-brand/10 to-transparent rounded-2xl p-6 sm:p-10 border border-border/60 text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold mb-4">
          <span>🏛️</span> Official Campus Network
        </div>
        <h1 class="text-3xl sm:text-4xl font-extrabold text-brand tracking-tight max-w-2xl mx-auto leading-tight">
          Reconnect With What Matters on Campus
        </h1>
        <p class="text-sm sm:text-base text-text-sub max-w-xl mx-auto mt-3">
          Misplaced your calculator, student ID, keys or water bottle? Or discovered something left behind in a lecture hall or gym? CampusFind makes campus returns safe, fast, and verified.
        </p>

        {/* Quick Search Form */}
        <form onSubmit={handleSearchSubmit} class="mt-6 max-w-xl mx-auto flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-sub">🔍</span>
            <input
              type="text"
              value={localSearch}
              onInput={(e) => setLocalSearch((e.target as HTMLInputElement).value)}
              placeholder="Search lost or found items (e.g., AirPods, ID Card, Hydro Flask)..."
              class="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand shadow-xs text-text-main"
            />
          </div>
          <button
            type="submit"
            class="px-5 py-3 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brand-dark transition-colors shadow-sm shrink-0"
          >
            Search
          </button>
        </form>

        {/* Primary Action Cards (Report Lost vs Report Found) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
          {/* Report Lost Action Card */}
          <button
            onClick={() => navigateTo('report-lost')}
            class="flex items-center gap-4 p-5 bg-surface border-2 border-amber-200 hover:border-amber-400 rounded-2xl shadow-xs hover:shadow-md transition-all text-left group"
          >
            <div class="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shrink-0">
              📢
            </div>
            <div>
              <div class="text-base font-bold text-text-main group-hover:text-amber-800 transition-colors">
                I Lost Something
              </div>
              <div class="text-xs text-text-sub mt-0.5">
                Post details, last-seen location, and description.
              </div>
            </div>
          </button>

          {/* Report Found Action Card */}
          <button
            onClick={() => navigateTo('report-found')}
            class="flex items-center gap-4 p-5 bg-surface border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl shadow-xs hover:shadow-md transition-all text-left group"
          >
            <div class="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shrink-0">
              🎁
            </div>
            <div>
              <div class="text-base font-bold text-text-main group-hover:text-emerald-800 transition-colors">
                I Found Something
              </div>
              <div class="text-xs text-text-sub mt-0.5">
                Safely report a found item. Sensitive data stays concealed.
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Quick Category Icons */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-bold text-text-main">Popular Categories</h2>
          <button
            onClick={() => {
              filterCategory.value = 'all';
              navigateTo('browse');
            }}
            class="text-xs font-semibold text-brand hover:underline"
          >
            View All →
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {CAMPUS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              class="flex flex-col items-center justify-center p-3 bg-surface border border-border/80 hover:border-brand rounded-xl shadow-2xs hover:bg-slate-50 transition-all text-center group"
            >
              <span class="text-2xl mb-1 group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span class="text-xs font-semibold text-text-main line-clamp-1">{cat.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Items Section */}
      <section>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-text-main">Recently Reported on Campus</h2>
            <p class="text-xs text-text-sub">Real-time status of lost items and turned-in property</p>
          </div>
          <button
            onClick={() => {
              filterType.value = 'all';
              filterCategory.value = 'all';
              navigateTo('browse');
            }}
            class="px-3.5 py-1.5 text-xs font-bold text-brand bg-brand/10 hover:bg-brand/15 rounded-lg transition-colors"
          >
            Browse All ({campusItems.value.length})
          </button>
        </div>

        {recentItems.length === 0 ? (
          <div class="bg-surface border border-border rounded-xl p-8 text-center">
            <p class="text-text-sub text-sm">No items currently reported.</p>
          </div>
        ) : (
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentItems.map((item) => {
              const isLost = item.type === 'lost';
              return (
                <div
                  key={item.id}
                  onClick={() => navigateTo('item-detail', item.id)}
                  class="bg-surface border border-border hover:border-brand/60 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col"
                >
                  {/* Image or Icon Placeholder */}
                  <div class="h-36 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div class="flex flex-col items-center justify-center text-slate-400">
                        <span class="text-4xl">
                          {CAMPUS_CATEGORIES.find((c) => c.id === item.category)?.icon || '📦'}
                        </span>
                      </div>
                    )}

                    {/* Type Tag */}
                    <div class="absolute top-2.5 left-2.5">
                      <span
                        class={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs ${
                          isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isLost ? 'Lost' : 'Found'}
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
                            : 'bg-white/90 text-text-sub border border-border/80'
                        }`}
                      >
                        {item.status === 'returned'
                          ? 'Returned'
                          : item.status === 'claim_pending'
                          ? 'Claim Pending'
                          : 'Open'}
                      </span>
                    </div>
                  </div>

                  {/* Item Content */}
                  <div class="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-text-main line-clamp-1 hover:text-brand transition-colors">
                        {item.title}
                      </h3>
                      <p class="text-xs text-text-sub line-clamp-2 mt-1">{item.description}</p>
                    </div>

                    <div class="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-sub">
                      <span class="truncate max-w-[130px]">📍 {item.location}</span>
                      <span>📅 {item.dateOccurred}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Safety & Protocol Banner */}
      <section class="bg-blue-50/60 border border-blue-200/70 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-xl shrink-0">
          🛡️
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-bold text-blue-900">Safe Campus Verification Guarantee</h4>
          <p class="text-xs text-blue-800/80 mt-0.5">
            Personal contact details are never exposed publicly. Found identification cards, bank cards, and valuables are shielded. When claiming an item, claimants must provide a private distinguishing feature to verify rightful ownership.
          </p>
        </div>
        <button
          onClick={() => navigateTo('browse')}
          class="text-xs font-bold text-blue-900 bg-white border border-blue-300 px-3.5 py-2 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
        >
          Explore Listings
        </button>
      </section>
    </div>
  );
}
