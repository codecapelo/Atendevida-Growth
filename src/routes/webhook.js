import { Router } from 'express';

const router = Router();

// Futuro: webhook de notificações da Meta (v0.2)
router.post('/meta', (_req, res) => {
  res.status(501).json({ error: 'Não implementado' });
});

export default router;
