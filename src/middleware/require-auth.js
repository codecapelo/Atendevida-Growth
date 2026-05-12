import { dashboardEnabled } from '#config/env.js';

export function requireAuth(req, res, next) {
  if (!dashboardEnabled) {
    return res.status(503).send(
      'Dashboard não configurado. Defina DASHBOARD_EMAIL, DASHBOARD_PASSWORD_HASH e SESSION_SECRET nas env vars.',
    );
  }
  if (!req.session?.user) {
    const next = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${next}`);
  }
  return next();
}

export function attachUser(req, res, next) {
  res.locals.user = req.session?.user ?? null;
  next();
}
