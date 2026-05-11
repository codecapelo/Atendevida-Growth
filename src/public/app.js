/* global Alpine */
document.addEventListener('alpine:init', () => {
  Alpine.data('dashboardStats', ({ initial }) => ({
    data: initial,
    init() {
      this.start();
    },
    start() {
      setInterval(async () => {
        try {
          const res = await fetch('/api/stats');
          if (!res.ok) return;
          const json = await res.json();
          this.data = json;
        } catch (_) {
          /* silent */
        }
      }, 30000);
    },
  }));
});
