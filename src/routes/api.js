import { Router } from 'express';
import { env } from '#config/env.js';
import { statsForToday, upcoming } from '#services/post-repo.js';

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

export default router;
