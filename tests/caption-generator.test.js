import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do SDK da Anthropic antes do import
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Mock do env para controlar DRY_RUN
vi.mock('../src/config/env.js', () => ({
  env: {
    ANTHROPIC_API_KEY: 'sk-test',
    ANTHROPIC_MODEL: 'claude-test',
    DRY_RUN: false,
  },
}));

import Anthropic from '@anthropic-ai/sdk';
import { refineCaption } from '../src/services/caption-generator.js';

const mockPost = {
  id: 'post-123',
  pilar: 'educacao',
  tema: 'Febre de madrugada',
  copy_principal: 'Febre às 2h da manhã? Não espere até o dia seguinte.',
  copy_curta: 'Febre às 2h? Atenda agora.',
  hashtags: ['#telemedicina', '#saude'],
};

describe('refineCaption', () => {
  let mockCreate;

  beforeEach(() => {
    mockCreate = Anthropic.mock.results[0]?.value.messages.create;
    if (!mockCreate) {
      const instance = new Anthropic();
      mockCreate = instance.messages.create;
    }
    vi.clearAllMocks();
  });

  it('parseia resposta JSON válida da Claude', async () => {
    const anthropicInstance = new (Anthropic)();
    anthropicInstance.messages.create.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            caption: 'Febre às 2h da manhã? Estamos aqui. Atendimento em minutos pelo link da bio.',
            hashtags: ['#telemedicina', '#saude', '#clt'],
            copy_curta: 'Febre às 2h? Atendemos agora.',
          }),
        },
      ],
    });

    // Re-import para pegar a instância mockada
    const { refineCaption: refine } = await import('../src/services/caption-generator.js');
    const result = await refine(mockPost);

    expect(result.caption).toContain('Febre às 2h');
    expect(result.hashtags).toContain('#telemedicina');
    expect(typeof result.copy_curta).toBe('string');
  });

  it('faz fallback para copy original quando JSON é inválido', async () => {
    const { env } = await import('../src/config/env.js');
    env.DRY_RUN = false;

    const anthropicInstance = new (Anthropic)();
    anthropicInstance.messages.create.mockResolvedValue({
      content: [{ text: 'texto sem json aqui' }],
    });

    const { refineCaption: refine } = await import('../src/services/caption-generator.js');
    const result = await refine(mockPost);

    expect(result.caption).toBe(mockPost.copy_principal);
    expect(result.hashtags).toEqual(mockPost.hashtags);
  });

  it('em DRY_RUN retorna copy original sem chamar a API', async () => {
    const { env } = await import('../src/config/env.js');
    env.DRY_RUN = true;

    const { refineCaption: refine } = await import('../src/services/caption-generator.js');
    const result = await refine(mockPost);

    expect(result.caption).toBe(mockPost.copy_principal);
    // Não deve ter chamado a Claude
  });
});
