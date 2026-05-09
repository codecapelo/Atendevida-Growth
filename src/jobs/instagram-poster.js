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
 * Orquestra a publicação de um post para a janela especificada.
 * @param {'manha' | 'almoco' | 'noite'} janela
 */
export async function runPostingJob(janela) {
  logger.info({ janela }, 'Iniciando job de postagem');

  const post = await fetchScheduledPost(janela);
  if (!post) {
    logger.info({ janela }, 'Nenhum post agendado para esta janela');
    return;
  }

  // Lock otimista: marca como publicando para evitar execução dupla
  const locked = await lockPost(post.id);
  if (!locked) {
    logger.warn({ post_id: post.id }, 'Post já está sendo publicado por outra instância');
    return;
  }

  try {
    const { caption, hashtags, copy_curta } = await refineCaption(post);

    const { valid, violations } = validateCaption(caption);
    if (!valid) {
      const error = new ComplianceError(violations);
      logger.error({ post_id: post.id, violations }, 'Violação CFM detectada — post não publicado');
      await failPost(post.id, error.message);
      return;
    }

    const fullCaption = formatCaption(caption, hashtags);

    const { igPostId, permalink } = await publishWithRetry(post, fullCaption);

    await markPublished(post.id, {
      instagram_post_id: igPostId,
      instagram_permalink: permalink,
      copy_curta,
      hashtags,
    });

    logger.info({ post_id: post.id, ig_post_id: igPostId }, 'Post publicado com sucesso');
  } catch (err) {
    logger.error({ post_id: post.id, err: err.message }, 'Falha ao publicar post');
    await failPost(post.id, err.message);
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

  if (error?.code === 'PGRST116') return null; // nenhum resultado
  if (error) throw error;
  return data;
}

async function lockPost(postId) {
  const { data, error } = await supabase
    .from('atendevida_social_posts')
    .update({ status: 'publicando' })
    .eq('id', postId)
    .eq('status', 'agendado') // condicional: só atualiza se ainda for 'agendado'
    .select('id')
    .single();

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

      // Não retentar erros 4xx (cliente) — apenas erros de rede
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
  const tags = hashtags.join(' ');
  return `${caption}\n\n${tags}`;
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
