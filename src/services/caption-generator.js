import { env } from '#config/env.js';
import { buildPrompt } from '#lib/prompts.js';
import { logger } from '#lib/logger.js';
import { getProvider } from '#services/llm/index.js';

/**
 * Refina a caption de um post usando o LLM configurado (Claude ou GPT).
 * Em DRY_RUN, retorna os dados originais sem chamar a API.
 * @param {object} post - Post da tabela atendevida_social_posts
 * @returns {Promise<{ caption: string, hashtags: string[], copy_curta: string }>}
 */
export async function refineCaption(post) {
  if (env.DRY_RUN) {
    logger.info({ post_id: post.id }, 'DRY_RUN: pulando LLM API');
    return fallback(post);
  }

  const provider = getProvider();
  const prompt = buildPrompt(post);

  logger.info(
    { post_id: post.id, provider: provider.providerName },
    'Chamando LLM para refinar caption',
  );

  try {
    const rawText = await provider.complete(prompt);
    return parseResponse(rawText, post);
  } catch (err) {
    logger.warn(
      { err: err.message, provider: provider.providerName },
      'Falha na chamada do LLM — usando copy original',
    );
    return fallback(post);
  }
}

function fallback(post) {
  return {
    caption: post.copy_principal,
    hashtags: post.hashtags ?? [],
    copy_curta: post.copy_curta ?? post.copy_principal.slice(0, 220),
  };
}

function parseResponse(rawText, post) {
  try {
    // Extrair só o JSON caso venha com markdown ou texto extra
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nenhum JSON encontrado na resposta');

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
      throw new Error('JSON com estrutura inválida');
    }

    return {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      copy_curta: parsed.copy_curta ?? parsed.caption.slice(0, 220),
    };
  } catch (err) {
    logger.warn(
      { err: err.message, raw: rawText.slice(0, 100) },
      'Falha ao parsear resposta do LLM — usando copy original',
    );
    return fallback(post);
  }
}
