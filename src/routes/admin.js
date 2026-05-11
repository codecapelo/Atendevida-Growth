import { Router } from 'express';
import { z } from 'zod';
import { create, update, remove, findById } from '#services/post-repo.js';
import { flash } from '#lib/flash.js';
import { env } from '#config/env.js';

const router = Router();

const postSchema = z.object({
  data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  janela: z.enum(['manha', 'almoco', 'noite']),
  pilar: z.enum(['educacao', 'casos_comuns', 'bastidores', 'mitos', 'renovacao_receita']),
  formato: z.enum(['estatico', 'carrossel', 'reel', 'story']),
  tema: z.string().min(3).max(300),
  copy_principal: z.string().min(5),
  copy_curta: z.string().max(220).optional().nullable(),
  hashtags: z.string().optional().nullable(),
  cta: z.string().optional().nullable(),
  imagem_url: z.string().url().optional().or(z.literal('')),
  imagem_prompt: z.string().optional().nullable(),
  video_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(['rascunho', 'agendado', 'cancelado']).default('rascunho'),
});

function parseHashtags(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
}

function normalize(body) {
  const parsed = postSchema.parse(body);
  return {
    data_agendada: parsed.data_agendada,
    horario: parsed.horario.length === 5 ? `${parsed.horario}:00` : parsed.horario,
    janela: parsed.janela,
    timezone: env.TZ,
    pilar: parsed.pilar,
    formato: parsed.formato,
    tema: parsed.tema,
    copy_principal: parsed.copy_principal,
    copy_curta: parsed.copy_curta || null,
    hashtags: parseHashtags(parsed.hashtags),
    cta: parsed.cta || null,
    imagem_url: parsed.imagem_url || null,
    imagem_prompt: parsed.imagem_prompt || null,
    video_url: parsed.video_url || null,
    status: parsed.status,
  };
}

router.post('/posts', async (req, res, next) => {
  try {
    const values = normalize(req.body);
    const created = await create(values);
    flash(req, 'success', 'Post criado.');
    res.redirect(`/dashboard/posts/${created.id}`);
  } catch (err) {
    if (err.name === 'ZodError') {
      flash(req, 'error', 'Dados inválidos: ' + err.errors.map((e) => e.path.join('.') + ' ' + e.message).join('; '));
      return res.redirect('/dashboard/posts/new');
    }
    next(err);
  }
});

router.post('/posts/:id', async (req, res, next) => {
  try {
    const values = normalize(req.body);
    await update(req.params.id, values);
    flash(req, 'success', 'Post atualizado.');
    res.redirect(`/dashboard/posts/${req.params.id}`);
  } catch (err) {
    if (err.name === 'ZodError') {
      flash(req, 'error', 'Dados inválidos: ' + err.errors.map((e) => e.path.join('.') + ' ' + e.message).join('; '));
      return res.redirect(`/dashboard/posts/${req.params.id}/edit`);
    }
    next(err);
  }
});

router.post('/posts/:id/delete', async (req, res, next) => {
  try {
    await remove(req.params.id);
    flash(req, 'success', 'Post deletado.');
    res.redirect('/dashboard/posts');
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/cancel', async (req, res, next) => {
  try {
    await update(req.params.id, { status: 'cancelado' });
    flash(req, 'success', 'Post cancelado.');
    res.redirect(`/dashboard/posts/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/duplicate', async (req, res, next) => {
  try {
    const original = await findById(req.params.id);
    if (!original) return res.status(404).send('Post não encontrado');

    const { id, created_at, updated_at, posted_at, metrics_collected_at, instagram_post_id, instagram_permalink, metricas, erro_mensagem, ...rest } = original;
    const copy = { ...rest, status: 'rascunho' };
    const created = await create(copy);
    flash(req, 'success', 'Post duplicado como rascunho.');
    res.redirect(`/dashboard/posts/${created.id}/edit`);
  } catch (err) {
    next(err);
  }
});

export default router;
