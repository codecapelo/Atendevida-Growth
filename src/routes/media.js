import { Router } from 'express';
import { driveEnabled } from '#config/env.js';
import { streamFile } from '#services/drive-client.js';
import { logger } from '#lib/logger.js';

const router = Router();

router.get('/drive/:fileId', async (req, res) => {
  if (!driveEnabled) return res.status(503).json({ error: 'Drive desativado' });

  try {
    const { stream, mimeType, size } = await streamFile(req.params.fileId);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    if (size) res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
    stream.on('error', (err) => {
      logger.error({ err: err.message, fileId: req.params.fileId }, 'Erro no stream do Drive');
      if (!res.headersSent) res.status(502).end();
    });
  } catch (err) {
    logger.error({ err: err.message, fileId: req.params.fileId }, 'Erro ao servir mídia do Drive');
    res.status(err.statusCode || 502).json({ error: err.message });
  }
});

export default router;
