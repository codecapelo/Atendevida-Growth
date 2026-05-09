import Anthropic from '@anthropic-ai/sdk';
import { env } from '#config/env.js';
import { buildPrompt } from '#lib/prompts.js';
import { logger } from '#lib/logger.js';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Refina a caption de um post usando a Claude API.
 * Em DRY_RUN, retorna os dados originais sem chamar a API.
 * @param {object} post - Post da tabela atendevida_social_posts
 * @returns {Promise<{ caption: string, hashtags: string[], copy_curta: string }>}
 */
export async function refineCaption(post) {
  if (env.DRY_RUN) {
    logger.info({ post_id: post.id }, 'DRY_RUN: pulando Claude API');
    return {
      caption: post.copy_principal,
      hashtags: post.hashtags ?? [],
      copy_curta: post.copy_curta ?? post.copy_principal.slice(0, 220),
    };
  }

  const prompt = buildPrompt(post);

  logger.info({ post_id: post.id, model: env.ANTHROPIC_MODEL }, 'Chamando Claude API');

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0]?.text ?? '';

  return parseResponse(rawText, post);
}

function parseResponse(rawText, post) {
  try {
    // Claude pode retornar markdown code block — extrair só o JSON
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
      'Falha ao parsear resposta da Claude — usando copy original',
    );
    return {
      caption: post.copy_principal,
      hashtags: post.hashtags ?? [],
      copy_curta: post.copy_curta ?? post.copy_principal.slice(0, 220),
    };
  }
}
