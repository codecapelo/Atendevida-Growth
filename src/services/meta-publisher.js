import axios from 'axios';
import { env } from '#config/env.js';
import { logger } from '#lib/logger.js';

const BASE_URL = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;
const POLLING_INTERVAL_MS = 5000;
const POLLING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

export class MetaPublishError extends Error {
  constructor(message, { statusCode, metaCode, requestId } = {}) {
    super(message);
    this.name = 'MetaPublishError';
    this.statusCode = statusCode;
    this.metaCode = metaCode;
    this.requestId = requestId;
  }
}

/**
 * Publica um post no Instagram via Meta Graph API (fluxo de 2 etapas).
 * Em DRY_RUN, não chama a API.
 * @param {object} post
 * @param {string} caption
 * @returns {Promise<{ igPostId: string, permalink: string }>}
 */
export async function publish(post, caption) {
  if (env.DRY_RUN) {
    logger.info({ post_id: post.id }, 'DRY_RUN: pulando Meta Graph API');
    return { igPostId: 'dry-run', permalink: 'https://www.instagram.com/dry-run' };
  }

  const isReel = post.formato === 'reel';
  const creationId = isReel
    ? await createReelContainer(post, caption)
    : await createImageContainer(post, caption);

  const igPostId = await publishContainer(creationId);
  const permalink = await fetchPermalink(igPostId);

  return { igPostId, permalink };
}

async function createImageContainer(post, caption) {
  const res = await apiPost(`/${env.META_IG_BUSINESS_ID}/media`, {
    image_url: post.imagem_url,
    caption,
    access_token: env.META_ACCESS_TOKEN,
  });
  logger.info({ creation_id: res.id }, 'Container de imagem criado');
  return res.id;
}

async function createReelContainer(post, caption) {
  const res = await apiPost(`/${env.META_IG_BUSINESS_ID}/media`, {
    media_type: 'REELS',
    video_url: post.video_url,
    caption,
    access_token: env.META_ACCESS_TOKEN,
  });
  const creationId = res.id;
  logger.info({ creation_id: creationId }, 'Container de reel criado — aguardando processamento');

  await pollUntilReady(creationId);
  return creationId;
}

async function pollUntilReady(creationId) {
  const deadline = Date.now() + POLLING_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLLING_INTERVAL_MS);

    const res = await apiGet(`/${creationId}`, {
      fields: 'status_code',
      access_token: env.META_ACCESS_TOKEN,
    });

    if (res.status_code === 'FINISHED') {
      logger.info({ creation_id: creationId }, 'Reel processado com sucesso');
      return;
    }

    if (res.status_code === 'ERROR') {
      throw new MetaPublishError('Processamento do reel falhou na Meta');
    }

    logger.debug({ creation_id: creationId, status: res.status_code }, 'Aguardando processamento');
  }

  throw new MetaPublishError('Timeout aguardando processamento do reel');
}

async function publishContainer(creationId) {
  const res = await apiPost(`/${env.META_IG_BUSINESS_ID}/media_publish`, {
    creation_id: creationId,
    access_token: env.META_ACCESS_TOKEN,
  });
  logger.info({ ig_post_id: res.id }, 'Post publicado no Instagram');
  return res.id;
}

async function fetchPermalink(igPostId) {
  const res = await apiGet(`/${igPostId}`, {
    fields: 'permalink',
    access_token: env.META_ACCESS_TOKEN,
  });
  return res.permalink;
}

async function apiPost(path, data) {
  try {
    const res = await axios.post(`${BASE_URL}${path}`, data);
    return res.data;
  } catch (err) {
    handleAxiosError(err);
  }
}

async function apiGet(path, params) {
  try {
    const res = await axios.get(`${BASE_URL}${path}`, { params });
    return res.data;
  } catch (err) {
    handleAxiosError(err);
  }
}

function handleAxiosError(err) {
  const status = err.response?.status;
  const metaError = err.response?.data?.error;
  const requestId = err.response?.headers?.['x-fb-trace-id'];

  logger.error(
    {
      status,
      meta_code: metaError?.code,
      meta_message: metaError?.message,
      request_id: requestId,
    },
    'Erro na Meta Graph API',
  );

  throw new MetaPublishError(metaError?.message ?? err.message, {
    statusCode: status,
    metaCode: metaError?.code,
    requestId,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
