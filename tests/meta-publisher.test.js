import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../src/config/env.js', () => ({
  env: {
    META_ACCESS_TOKEN: 'EAABtest',
    META_IG_BUSINESS_ID: '123456',
    META_GRAPH_API_VERSION: 'v21.0',
    DRY_RUN: false,
  },
}));
vi.mock('../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import axios from 'axios';
import { publish, MetaPublishError } from '../src/services/meta-publisher.js';

const mockPost = {
  id: 'post-abc',
  formato: 'estatico',
  imagem_url: 'https://example.com/img.jpg',
};

describe('publish (imagem estática)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fluxo happy path: cria container → publica → busca permalink', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { id: 'container-1' } }) // criar container
      .mockResolvedValueOnce({ data: { id: 'ig-post-1' } }); // publicar

    axios.get.mockResolvedValueOnce({
      data: { permalink: 'https://www.instagram.com/p/abc123' },
    });

    const result = await publish(mockPost, 'Legenda de teste');

    expect(result.igPostId).toBe('ig-post-1');
    expect(result.permalink).toBe('https://www.instagram.com/p/abc123');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('em DRY_RUN não chama a API', async () => {
    const { env } = await import('../src/config/env.js');
    env.DRY_RUN = true;

    const result = await publish(mockPost, 'Legenda');

    expect(result.igPostId).toBe('dry-run');
    expect(axios.post).not.toHaveBeenCalled();

    env.DRY_RUN = false;
  });

  it('lança MetaPublishError em erro 4xx sem retry', async () => {
    const error = new Error('Invalid token');
    error.response = {
      status: 400,
      data: { error: { code: 190, message: 'Invalid OAuth access token.' } },
      headers: {},
    };
    axios.post.mockRejectedValueOnce(error);

    await expect(publish(mockPost, 'Legenda')).rejects.toThrow(MetaPublishError);
  });

  it('propaga erro de rede como MetaPublishError', async () => {
    const error = new Error('Network Error');
    error.request = {};
    axios.post.mockRejectedValueOnce(error);

    await expect(publish(mockPost, 'Legenda')).rejects.toThrow(MetaPublishError);
  });
});
