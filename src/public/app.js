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

  Alpine.data('postForm', ({ driveEnabled, initial, postId }) => ({
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
      this.form.imagem_url = `${location.origin}/media/drive/${file.id}`;
      const input = this.$root.querySelector('input[name="imagem_url"]');
      if (input) input.value = this.form.imagem_url;
      this.drivePickerOpen = false;
    },
  }));
});
