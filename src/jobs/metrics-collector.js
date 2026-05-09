import axios from 'axios';
import cron from 'node-cron';
import { supabase } from '#services/supabase-client.js';
import { logger } from '#lib/logger.js';
import { env } from '#config/env.js';
import { SCHEDULES, TIMEZONE } from '#config/schedule.js';

const BASE_URL = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;
const MAX_POSTS_PER_RUN = 50;
const RATE_LIMIT_DELAY_MS = 1000;

/**
 * Coleta métricas dos posts publicados nos últimos 7 dias.
 */
export async function runMetricsCollection() {
  logger.info('Iniciando coleta de métricas');

  const posts = await fetchRecentPublishedPosts();
  if (!posts.length) {
    logger.info('Nenhum post para coletar métricas');
    return;
  }

  logger.info({ count: posts.length }, 'Posts encontrados para coleta');

  const results = [];
  for (const post of posts.slice(0, MAX_POSTS_PER_RUN)) {
    try {
      const metricas = await fetchInsights(post.instagram_post_id);
      await updateMetrics(post.id, metricas);
      results.push({ id: post.id, metricas });
      await sleep(RATE_LIMIT_DELAY_MS);
    } catch (err) {
      logger.warn({ post_id: post.id, err: err.message }, 'Falha ao coletar métricas');
    }
  }

  logTopPosts(results);
  logger.info({ processed: results.length }, 'Coleta de métricas concluída');
}

async function fetchRecentPublishedPosts() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('atendevida_social_posts')
    .select('id, instagram_post_id, tema')
    .eq('status', 'publicado')
    .not('instagram_post_id', 'is', null)
    .gte('posted_at', sevenDaysAgo.toISOString())
    .order('posted_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchInsights(igPostId) {
  const res = await axios.get(`${BASE_URL}/${igPostId}/insights`, {
    params: {
      metric: 'impressions,reach,likes,saved,comments,shares',
      access_token: env.META_ACCESS_TOKEN,
    },
  });

  return res.data.data.reduce((acc, item) => {
    acc[item.name] = item.values?.[0]?.value ?? 0;
    return acc;
  }, {});
}

async function updateMetrics(postId, metricas) {
  await supabase
    .from('atendevida_social_posts')
    .update({ metricas, metrics_collected_at: new Date().toISOString() })
    .eq('id', postId);
}

function logTopPosts(results) {
  const top3 = [...results]
    .sort((a, b) => (b.metricas.reach ?? 0) - (a.metricas.reach ?? 0))
    .slice(0, 3);

  logger.info({ top3: top3.map((r) => ({ id: r.id, reach: r.metricas.reach })) }, 'Top 3 posts da semana por alcance');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registra o cron de coleta de métricas (03:00 BRT).
 */
export function startMetricsCollector() {
  cron.schedule(SCHEDULES.metrics, runMetricsCollection, { timezone: TIMEZONE });
  logger.info({ schedule: SCHEDULES.metrics, timezone: TIMEZONE }, 'Cron de métricas registrado');
}
