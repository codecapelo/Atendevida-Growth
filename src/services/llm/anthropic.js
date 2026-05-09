import Anthropic from '@anthropic-ai/sdk';
import { env } from '#config/env.js';

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Chama a Claude API e retorna o texto bruto da resposta.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function complete(prompt) {
  const response = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text ?? '';
}

export const providerName = 'anthropic';
