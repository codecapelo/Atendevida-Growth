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

  Alpine.data('postForm', ({ driveEnabled, publicBaseUrl, initial, postId }) => ({
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

    // ── Drive Picker ────────────────────────────────────
    drivePickerOpen: false,
    driveFiles: [],
    driveLoading: false,
    driveError: null,
    async openDrivePicker() {
      if (!driveEnabled) return;
      this.drivePickerOpen = true;
      if (this.driveFiles.length) return;
      this.driveLoading = true;
      this.driveError = null;
      try {
        const res = await fetch('/api/drive/files');
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao listar Drive');
        const json = await res.json();
        this.driveFiles = json.files || [];
      } catch (err) {
        this.driveError = err.message;
      } finally {
        this.driveLoading = false;
      }
    },
    pickDriveFile(file) {
      // PUBLIC_BASE_URL é o domínio público (Railway/produção). Sem ele, Meta
      // tentaria baixar a imagem de "localhost" se o admin acessar pelo dev.
      // Em dev sem PUBLIC_BASE_URL definido, cai pra location.origin (vai
      // funcionar entre máquinas na mesma rede mas não na publicação real).
      const base = (publicBaseUrl || '').replace(/\/$/, '') || location.origin;
      this.form.imagem_url = `${base}/media/drive/${file.id}`;
      const input = this.$root.querySelector('input[name="imagem_url"]');
      if (input) input.value = this.form.imagem_url;
      this.drivePickerOpen = false;
    },

    // ── Refine Modal ────────────────────────────────────
    refineOpen: false,
    refineLoading: false,
    refineError: null,
    refineResult: null,
    async openRefine() {
      if (!this.postId) return;
      this.refineOpen = true;
      this.refineLoading = true;
      this.refineError = null;
      this.refineResult = null;
      try {
        const hashtagsRaw = this.$root.querySelector('input[name="hashtags"]').value;
        const body = {
          tema: this.form.tema,
          pilar: this.form.pilar,
          formato: this.form.formato,
          copy_principal: this.form.copy_principal,
          copy_curta: this.form.copy_curta,
          hashtags: parseHashtags(hashtagsRaw),
        };
        const res = await fetch(`/admin/posts/${this.postId}/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao chamar IA');
        this.refineResult = await res.json();
      } catch (err) {
        this.refineError = err.message;
      } finally {
        this.refineLoading = false;
      }
    },
    useRefined() {
      if (!this.refineResult) return;
      this.form.copy_principal = this.refineResult.caption;
      this.form.copy_curta = this.refineResult.copy_curta;
      this.form.hashtags = this.refineResult.hashtags;

      const root = this.$root;
      root.querySelector('textarea[name="copy_principal"]').value = this.refineResult.caption;
      root.querySelector('textarea[name="copy_curta"]').value = this.refineResult.copy_curta || '';
      root.querySelector('input[name="hashtags"]').value = (this.refineResult.hashtags || []).join(' ');

      this.refineOpen = false;
    },
  }));
});

function parseHashtags(raw) {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
}
