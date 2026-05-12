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
