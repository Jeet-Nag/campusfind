export function BetaFooter() {
  return (
    <footer class="bg-brand-dark text-slate-400 text-xs border-t border-slate-800 py-10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div class="space-y-1">
            <span class="font-bold text-white text-base">Chandil Home Services</span>
            <p class="text-xs text-slate-400">
              Hyperlocal technician & repair services for Chandil, Chowka, Kandra, and adjoining rural clusters in Jharkhand.
            </p>
          </div>

          <div class="flex items-center gap-4 text-xs font-semibold">
            <a href="tel:+919876543210" class="hover:text-emerald-400 transition-colors">
              📞 +91 98765 43210
            </a>
            <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" class="hover:text-emerald-400 transition-colors">
              💬 WhatsApp Support
            </a>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div>
            &copy; 2026 Chandil Home Services. Pre-release beta distribution portal.
          </div>
          <div class="flex items-center gap-3">
            <span>Package ID: <code class="text-slate-400">in.chandilservices.app</code></span>
            <span>&bull;</span>
            <a href="/admin" class="hover:text-slate-300">Admin Operations</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
