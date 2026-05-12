import { Router } from 'express';
import { z } from 'zod';
import { create, update, remove, findById } from '#services/post-repo.js';
import { flash } from '#lib/flash.js';
import { env } from '#config/env.js';

const router = Router();

// Regex só valida formato; "2026-02-31" passa. Refine constrói o Date
// e confirma que os componentes voltam idênticos (sem rollover).
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar em YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, 'Data inexistente no calendário');

// Hora real (00..23 : 00..59 [: 00..59]).
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Horário deve estar em HH:MM ou HH:MM:SS (24h)');

const postSchema = z.object({
  data_agendada: isoDateSchema,
  horario: timeSchema,
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
  status: z
    .enum(['rascunho', 'agendado', 'cancelado', 'publicando', 'publicado', 'falhou'])
    .default('rascunho'),
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

// Bate antes de qualquer chamada ao Supabase: ID malformado retorna 400
// em vez de virar 500 via cast error do Postgres (22P02).
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireValidId(req, res, next) {
  if (!UUID_RX.test(req.params.id ?? '')) {
    return res.status(400).send('ID de post inválido');
  }
  next();
}
router.use('/posts/:id', requireValidId);

router.post('/posts/:id', async (req, res, next) => {
  try {
    const values = normalize(req.body);
    const updated = await update(req.params.id, values);
    if (!updated) return res.status(404).send('Post não encontrado');
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
    const ok = await remove(req.params.id);
    if (!ok) return res.status(404).send('Post não encontrado');
    flash(req, 'success', 'Post deletado.');
    res.redirect('/dashboard/posts');
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/cancel', async (req, res, next) => {
  try {
    const updated = await update(req.params.id, { status: 'cancelado' });
    if (!updated) return res.status(404).send('Post não encontrado');
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
