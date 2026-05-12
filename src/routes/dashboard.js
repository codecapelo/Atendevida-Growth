import { Router } from 'express';
import { findById, list, statsForToday, upcoming, lastMetricsCollection } from '#services/post-repo.js';
import { env, driveEnabled } from '#config/env.js';

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
