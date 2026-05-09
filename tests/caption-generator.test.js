import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockComplete = vi.fn();

vi.mock('../src/services/llm/index.js', () => ({
  getProvider: () => ({
    complete: mockComplete,
    providerName: 'mock',
  }),
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    DRY_RUN: false,
  },
}));

vi.mock('../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { refineCaption } from '../src/services/caption-generator.js';
import { env } from '../src/config/env.js';

const mockPost = {
  id: 'post-123',
  pilar: 'educacao',
  tema: 'Febre de madrugada',
  copy_principal: 'Febre às 2h da manhã? Não espere até o dia seguinte.',
  copy_curta: 'Febre às 2h? Atenda agora.',
  hashtags: ['#telemedicina', '#saude'],
};

describe('refineCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.DRY_RUN = false;
  });

  it('parseia resposta JSON válida do LLM', async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        caption: 'Febre às 2h da manhã? Estamos aqui.',
        hashtags: ['#telemedicina', '#saude', '#clt'],
        copy_curta: 'Febre às 2h? Atendemos agora.',
      }),
    );

    const result = await refineCaption(mockPost);

    expect(result.caption).toContain('Febre às 2h');
    expect(result.hashtags).toContain('#telemedicina');
    expect(typeof result.copy_curta).toBe('string');
  });

  it('aceita JSON dentro de markdown code block', async () => {
    mockComplete.mockResolvedValue(
      '```json\n' +
        JSON.stringify({
          caption: 'Caption completa',
          hashtags: ['#tag1'],
          copy_curta: 'Curta',
        }) +
        '\n```',
    );

    const result = await refineCaption(mockPost);
    expect(result.caption).toBe('Caption completa');
  });

  it('faz fallback para copy original quando JSON é inválido', async () => {
    mockComplete.mockResolvedValue('texto sem json aqui');

    const result = await refineCaption(mockPost);

    expect(result.caption).toBe(mockPost.copy_principal);
    expect(result.hashtags).toEqual(mockPost.hashtags);
  });

  it('faz fallback quando LLM lança erro', async () => {
    mockComplete.mockRejectedValue(new Error('API down'));

    const result = await refineCaption(mockPost);

    expect(result.caption).toBe(mockPost.copy_principal);
  });

  it('em DRY_RUN retorna copy original sem chamar a API', async () => {
    env.DRY_RUN = true;

    const result = await refineCaption(mockPost);

    expect(result.caption).toBe(mockPost.copy_principal);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
