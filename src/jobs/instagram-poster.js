import cron from 'node-cron';
import { supabase } from '#services/supabase-client.js';
import { refineCaption } from '#services/caption-generator.js';
import { publish, MetaPublishError } from '#services/meta-publisher.js';
import { validateCaption, ComplianceError } from '#lib/compliance.js';
import { logger } from '#lib/logger.js';
import { SCHEDULES, TIMEZONE } from '#config/schedule.js';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Orquestra a publicação de um post para a janela especificada (chamado pelo cron).
 * @param {'manha' | 'almoco' | 'noite'} janela
 */
export async function runPostingJob(janela) {
  logger.info({ janela }, 'Iniciando job de postagem');

  const post = await fetchScheduledPost(janela);
  if (!post) {
    logger.info({ janela }, 'Nenhum post agendado para esta janela');
    return;
  }

  return runPostingJobForPost(post.id, { force: false, post });
}

/**
 * Publica um post específico. Reutilizado pelo cron e pelo botão "Publicar agora".
 * @param {string} postId
 * @param {{ force?: boolean, post?: object }} opts - force pula a checagem de status='agendado'.
 */
export async function runPostingJobForPost(postId, { force = false, post = null } = {}) {
  const fullPost = post ?? (await fetchById(postId));
  if (!fullPost) {
    logger.warn({ post_id: postId }, 'Post não encontrado');
    return;
  }

  const locked = await lockPost(postId, { force });
  if (!locked) {
    logger.warn({ post_id: postId }, 'Não foi possível adquirir lock para o post');
    return;
  }

  try {
    const { caption, hashtags, copy_curta } = await refineCaption(fullPost);

    const { valid, violations } = validateCaption(caption);
    if (!valid) {
      const error = new ComplianceError(violations);
      logger.error({ post_id: postId, violations }, 'Violação CFM detectada — post não publicado');
      await failPost(postId, error.message);
      return;
    }

    const fullCaption = formatCaption(caption, hashtags);
    const { igPostId, permalink } = await publishWithRetry(fullPost, fullCaption);

    await markPublished(postId, {
      instagram_post_id: igPostId,
      instagram_permalink: permalink,
      copy_curta,
      hashtags,
    });

    logger.info({ post_id: postId, ig_post_id: igPostId }, 'Post publicado com sucesso');
  } catch (err) {
    logger.error({ post_id: postId, err: err.message }, 'Falha ao publicar post');
    await failPost(postId, err.message);
  }
}

async function fetchScheduledPost(janela) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('atendevida_social_posts')
    .select('*')
    .eq('status', 'agendado')
    .eq('data_agendada', today)
    .eq('janela', janela)
    .order('horario', { ascending: true })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

async function fetchById(postId) {
  const { data, error } = await supabase
    .from('atendevida_social_posts')
    .select('*')
    .eq('id', postId)
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

async function lockPost(postId, { force }) {
  let q = supabase
    .from('atendevida_social_posts')
    .update({ status: 'publicando' })
    .eq('id', postId);

  if (!force) q = q.eq('status', 'agendado');

  const { data, error } = await q.select('id').single();
  if (error) return false;
  return !!data;
}

async function failPost(postId, message) {
  await supabase
    .from('atendevida_social_posts')
    .update({ status: 'falhou', erro_mensagem: message })
    .eq('id', postId);
}

async function markPublished(postId, { instagram_post_id, instagram_permalink, copy_curta, hashtags }) {
  await supabase
    .from('atendevida_social_posts')
    .update({
      status: 'publicado',
      instagram_post_id,
      instagram_permalink,
      copy_curta,
      hashtags,
      posted_at: new Date().toISOString(),
      erro_mensagem: null,
    })
    .eq('id', postId);
}

async function publishWithRetry(post, caption) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await publish(post, caption);
    } catch (err) {
      lastError = err;

      if (err instanceof MetaPublishError && err.statusCode >= 400 && err.statusCode < 500) {
        logger.warn({ post_id: post.id, status: err.statusCode }, 'Erro 4xx da Meta — sem retry');
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ post_id: post.id, attempt, delay_ms: delay }, 'Tentando novamente...');
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function formatCaption(caption, hashtags) {
  const tags = (hashtags || []).join(' ');
  return tags ? `${caption}\n\n${tags}` : caption;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registra os 3 crons (manhã, almoço, noite) com node-cron.
 */
export function startCronJobs() {
  cron.schedule(SCHEDULES.morning, () => runPostingJob('manha'), { timezone: TIMEZONE });
  cron.schedule(SCHEDULES.lunch, () => runPostingJob('almoco'), { timezone: TIMEZONE });
  cron.schedule(SCHEDULES.night, () => runPostingJob('noite'), { timezone: TIMEZONE });

  logger.info(
    {
      morning: SCHEDULES.morning,
      lunch: SCHEDULES.lunch,
      night: SCHEDULES.night,
      timezone: TIMEZONE,
    },
    'Cron jobs de postagem registrados',
  );
}
