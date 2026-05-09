import { env } from '#config/env.js';
import * as anthropic from './anthropic.js';
import * as openai from './openai.js';

const providers = {
  anthropic,
  openai,
};

/**
 * Retorna o provider LLM ativo conforme env.LLM_PROVIDER.
 * @returns {{ complete: (prompt: string) => Promise<string>, providerName: string }}
 */
export function getProvider() {
  const provider = providers[env.LLM_PROVIDER];
  if (!provider) {
    throw new Error(`LLM_PROVIDER inválido: ${env.LLM_PROVIDER}`);
  }
  return provider;
}
