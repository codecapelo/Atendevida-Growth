import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { env, dashboardEnabled } from '#config/env.js';
import { logger } from '#lib/logger.js';
import { flash } from '#lib/flash.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    next: req.query.next ?? '/dashboard',
    error: null,
    hideChrome: true,
    title: 'Login',
  });
});

router.post('/login', async (req, res) => {
  if (!dashboardEnabled) {
    return res.status(503).render('login', {
      next: '/dashboard',
      error: 'Dashboard não configurado no servidor.',
      hideChrome: true,
      title: 'Login',
    });
  }

  const { email, password, next: nextUrl } = req.body;

  const emailMatch =
    typeof email === 'string' && email.toLowerCase() === env.DASHBOARD_EMAIL.toLowerCase();
  const passwordMatch =
    typeof password === 'string' && (await bcrypt.compare(password, env.DASHBOARD_PASSWORD_HASH));

  if (!emailMatch || !passwordMatch) {
    logger.warn({ email }, 'Tentativa de login inválida');
    return res.status(401).render('login', {
      next: nextUrl ?? '/dashboard',
      error: 'Credenciais inválidas.',
      hideChrome: true,
      title: 'Login',
    });
  }

  req.session.user = { email: env.DASHBOARD_EMAIL, loginAt: new Date().toISOString() };
  flash(req, 'success', 'Bem-vindo de volta!');
  logger.info({ email }, 'Login bem-sucedido');

  res.redirect(safeRedirectPath(nextUrl));
});

// Aceita apenas paths internos (começa com "/" e não é protocol-relative
// como "//evil.com" ou "/\\evil.com"). Caso contrário cai no dashboard.
function safeRedirectPath(value) {
  if (typeof value !== 'string') return '/dashboard';
  if (!value.startsWith('/')) return '/dashboard';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/dashboard';
  return value;
}

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

export default router;
