import OpenAI from 'openai';
import { env } from '#config/env.js';

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Chama a OpenAI API e retorna o texto bruto da resposta.
 * Usa response_format json_object para forçar JSON válido.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function complete(prompt) {
  const response = await getClient().chat.completions.create({
    model: env.OPENAI_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Você responde sempre com JSON válido, sem texto adicional.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}

export const providerName = 'openai';
