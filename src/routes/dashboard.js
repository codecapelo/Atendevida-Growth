import { Router } from 'express';
import {
  findById,
  list,
  statsForToday,
  upcoming,
  lastMetricsCollection,
  calendarRange,
  topByReach,
} from '#services/post-repo.js';
import { env, driveEnabled } from '#config/env.js';
import { logger } from '#lib/logger.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [stats, next24h, lastMetrics] = await Promise.all([
      statsForToday(env.TZ),
      upcoming({ limit: 10 }),
      lastMetricsCollection(),
    ]);
    res.render('home', {
      title: 'Visão geral',
      pageTitle: 'Visão geral',
      pageSubtitle: 'Status das publicações automáticas no Instagram',
      active: 'home',
      stats,
      upcoming: next24h,
      lastMetrics,
      driveEnabled,
      llmProvider: env.LLM_PROVIDER,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/calendar', async (_req, res, next) => {
  try {
    const days = 7;
    const posts = await calendarRange(days);

    const dates = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const grid = {};
    for (const date of dates) {
      grid[date] = { manha: null, almoco: null, noite: null };
    }
    for (const p of posts) {
      if (grid[p.data_agendada] && grid[p.data_agendada][p.janela] === null) {
        grid[p.data_agendada][p.janela] = p;
      }
    }

    res.render('calendar', {
      title: 'Calendário',
      pageTitle: 'Calendário',
      pageSubtitle: 'Próximos 7 dias por janela',
      active: 'calendar',
      dates,
      grid,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics', async (_req, res, next) => {
  try {
    const top = await topByReach({ days: 30, limit: 15 });
    const totals = top.reduce(
      (acc, r) => {
        const m = r.metricas || {};
        acc.impressions += m.impressions ?? 0;
        acc.reach += m.reach ?? 0;
        acc.likes += m.likes ?? 0;
        acc.saved += m.saved ?? 0;
        acc.comments += m.comments ?? 0;
        return acc;
      },
      { impressions: 0, reach: 0, likes: 0, saved: 0, comments: 0 },
    );
    res.render('metrics', {
      title: 'Métricas',
      pageTitle: 'Métricas',
      pageSubtitle: 'Top posts por alcance — últimos 30 dias',
      active: 'metrics',
      top,
      totals,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao carregar métricas');
    next(err);
  }
});

router.get('/posts', async (req, res, next) => {
  try {
    // parseInt('abc') é NaN e Math.max(1, NaN) também é NaN, fazendo
    // offset virar NaN e a query falhar. Default para 1 em qualquer
    // valor não-numérico/<=0.
    const parsedPage = parseInt(req.query.page ?? '1', 10);
    const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
    const limit = 20;
    const filters = {
      status: req.query.status || undefined,
      pilar: req.query.pilar || undefined,
      janela: req.query.janela || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      limit,
      offset: (page - 1) * limit,
    };
    const { rows, count } = await list(filters);
    res.render('posts/list', {
      title: 'Posts',
      pageTitle: 'Posts',
      pageSubtitle: `${count} posts`,
      active: 'posts',
      rows,
      count,
      page,
      pages: Math.max(1, Math.ceil(count / limit)),
      filters: req.query,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/new', (req, res) => {
  // Default da data precisa estar no fuso de negócio. toISOString() retorna
  // UTC e perto da meia-noite UTC mostra o dia seguinte como sugestão.
  const today = todayInBusinessTz(env.TZ);
  const empty = {
    id: null,
    data_agendada: req.query.data || today,
    horario: defaultHorarioFor(req.query.janela),
    janela: req.query.janela || 'manha',
    timezone: env.TZ,
    pilar: 'educacao',
    formato: 'estatico',
    tema: '',
    copy_principal: '',
    copy_curta: '',
    hashtags: [],
    cta: 'Atendimento em minutos pelo link da bio',
    imagem_url: '',
    imagem_prompt: '',
    video_url: '',
    status: 'rascunho',
  };
  res.render('posts/form', {
    title: 'Novo post',
    pageTitle: 'Novo post',
    pageSubtitle: 'Crie uma publicação para o calendário',
    active: 'new',
    post: empty,
    isNew: true,
    driveEnabled,
    publicBaseUrl: env.PUBLIC_BASE_URL ?? '',
  });
});

router.get('/posts/:id/edit', async (req, res, next) => {
  try {
    const post = await findById(req.params.id);
    if (!post) return res.status(404).send('Post não encontrado');
    res.render('posts/form', {
      title: 'Editar post',
      pageTitle: 'Editar post',
      pageSubtitle: post.tema,
      active: 'posts',
      post,
      isNew: false,
      driveEnabled,
      publicBaseUrl: env.PUBLIC_BASE_URL ?? '',
    });
  } catch (err) {
    next(err);
  }
});

function defaultHorarioFor(janela) {
  if (janela === 'almoco') return '12:00';
  if (janela === 'noite') return '21:00';
  return '07:00';
}

// Retorna o ISO date (YYYY-MM-DD) "hoje" no fuso informado, via
// Intl.DateTimeFormat — evita o drift de toISOString().split('T')[0]
// que devolve dia em UTC.
function todayInBusinessTz(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

router.get('/posts/:id', async (req, res, next) => {
  try {
    const post = await findById(req.params.id);
    if (!post) return res.status(404).send('Post não encontrado');
    res.render('posts/detail', {
      title: post.tema || 'Detalhe',
      pageTitle: post.tema || 'Detalhe do post',
      pageSubtitle: `${post.data_agendada} · ${post.janela}`,
      active: 'posts',
      post,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
