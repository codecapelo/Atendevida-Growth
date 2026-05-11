import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieSession from 'cookie-session';
import expressLayouts from 'express-ejs-layouts';

import { env, dashboardEnabled } from '#config/env.js';
import { logger } from '#lib/logger.js';
import { consumeFlash } from '#lib/flash.js';
import { requireAuth, attachUser } from '#middleware/require-auth.js';
import { startCronJobs } from '#jobs/instagram-poster.js';
import { startMetricsCollector } from '#jobs/metrics-collector.js';

import healthRoute from '#routes/health.js';
import webhookRoute from '#routes/webhook.js';
import authRoute from '#routes/auth.js';
import dashboardRoute from '#routes/dashboard.js';
import adminRoute from '#routes/admin.js';
import apiRoute from '#routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── View engine ─────────────────────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// ── Body parsing ────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// ── Static ──────────────────────────────────────────────────
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// ── Session (somente se dashboard configurado) ──────────────
if (dashboardEnabled) {
  app.use(
    cookieSession({
      name: 'atendevida_session',
      keys: [env.SESSION_SECRET],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    }),
  );
  app.use(consumeFlash);
  app.use(attachUser);
}

// ── Locals globais ──────────────────────────────────────────
app.use((_req, res, next) => {
  res.locals.dryRun = env.DRY_RUN;
  res.locals.user = res.locals.user ?? null;
  res.locals.flash = res.locals.flash ?? null;
  next();
});

// ── Rotas públicas ──────────────────────────────────────────
app.use('/health', healthRoute);
app.use('/webhook', webhookRoute);

// ── Dashboard (somente se configurado) ─────────────────────
if (dashboardEnabled) {
  app.use('/', authRoute);
  app.use('/dashboard', requireAuth, dashboardRoute);
  app.use('/admin', requireAuth, adminRoute);
  app.use('/api', requireAuth, apiRoute);

  app.get('/', (req, res) => {
    res.redirect(req.session?.user ? '/dashboard' : '/login');
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      message:
        'Dashboard desativado. Configure DASHBOARD_EMAIL, DASHBOARD_PASSWORD_HASH e SESSION_SECRET para habilitar.',
    });
  });
}

// ── Error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Erro não tratado');
  if (res.headersSent) return;
  res.status(500).send('Erro interno. Confira os logs.');
});

// ── Workers ─────────────────────────────────────────────────
if (env.ENABLE_AUTOPOST) startCronJobs();
if (env.ENABLE_METRICS_COLLECTOR) startMetricsCollector();

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, dry_run: env.DRY_RUN, dashboard: dashboardEnabled },
    'Server up',
  );
});
