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

<<<<<<< HEAD
  Alpine.data('postForm', ({ driveEnabled, publicBaseUrl, initial, postId }) => ({
=======
  Alpine.data('postForm', ({ driveEnabled, initial, postId }) => ({
>>>>>>> 228f29e (feat(dashboard): PR 4 — Google Drive (seletor de imagem + proxy /media))
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
<<<<<<< HEAD
      // PUBLIC_BASE_URL é o domínio público (Railway/produção). Sem ele, Meta
      // tentaria baixar a imagem de "localhost" se o admin acessar pelo dev.
      // Em dev sem PUBLIC_BASE_URL definido, cai pra location.origin (vai
      // funcionar entre máquinas na mesma rede mas não na publicação real).
      const base = (publicBaseUrl || '').replace(/\/$/, '') || location.origin;
      this.form.imagem_url = `${base}/media/drive/${file.id}`;
=======
      this.form.imagem_url = `${location.origin}/media/drive/${file.id}`;
>>>>>>> 228f29e (feat(dashboard): PR 4 — Google Drive (seletor de imagem + proxy /media))
      const input = this.$root.querySelector('input[name="imagem_url"]');
      if (input) input.value = this.form.imagem_url;
      this.drivePickerOpen = false;
    },
  }));
});
