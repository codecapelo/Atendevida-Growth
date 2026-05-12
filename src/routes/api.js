import { Router } from 'express';
import { env, driveEnabled } from '#config/env.js';
import { statsForToday, upcoming } from '#services/post-repo.js';
import { listFiles } from '#services/drive-client.js';
import { logger } from '#lib/logger.js';

const router = Router();

router.get('/stats', async (_req, res) => {
  try {
    const stats = await statsForToday(env.TZ);
    const next = await upcoming({ limit: 1 });
    res.json({
      agendados: stats.agendados,
      publicados: stats.publicados,
      falhados: stats.falhados,
      publicando: stats.publicando,
      proximoPost: next[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/drive/files', async (_req, res) => {
  if (!driveEnabled) {
    return res.status(503).json({ error: 'Google Drive não configurado' });
  }
  try {
    const files = await listFiles();
    res.json({ files });
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao listar arquivos do Drive');
    res.status(502).json({ error: err.message });
  }
});

export default router;
