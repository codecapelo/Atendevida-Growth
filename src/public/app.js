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

  Alpine.data('postForm', ({ initial, postId }) => ({
    form: {
      copy_principal: initial.copy_principal || '',
      copy_curta: initial.copy_curta || '',
      hashtags: initial.hashtags || [],
      cta: initial.cta || '',
      imagem_url: initial.imagem_url || '',
      imagem_prompt: initial.imagem_prompt || '',
      video_url: initial.video_url || '',
      pilar: initial.pilar,
      formato: initial.formato,
      tema: initial.tema,
    },
    postId,
  }));
});
