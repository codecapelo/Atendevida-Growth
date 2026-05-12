import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/supabase-client.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));
vi.mock('../src/services/caption-generator.js', () => ({
  refineCaption: vi.fn(),
}));
vi.mock('../src/services/meta-publisher.js', () => ({
  publish: vi.fn(),
  MetaPublishError: class MetaPublishError extends Error {
    constructor(msg, opts = {}) {
      super(msg);
      this.name = 'MetaPublishError';
      this.statusCode = opts.statusCode;
    }
  },
}));
vi.mock('../src/lib/compliance.js', () => ({
  validateCaption: vi.fn(),
  ComplianceError: class ComplianceError extends Error {
    constructor(violations) {
      super('compliance error');
      this.violations = violations;
    }
  },
}));
vi.mock('../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../src/config/env.js', () => ({
  env: { DRY_RUN: false, TZ: 'America/Fortaleza' },
}));
vi.mock('../src/config/schedule.js', () => ({
  SCHEDULES: { morning: '0 7 * * *', lunch: '0 12 * * *', night: '0 21 * * *' },
  TIMEZONE: 'America/Fortaleza',
}));

import { supabase } from '../src/services/supabase-client.js';
import { refineCaption } from '../src/services/caption-generator.js';
import { publish } from '../src/services/meta-publisher.js';
import { validateCaption } from '../src/lib/compliance.js';
import { runPostingJob } from '../src/jobs/instagram-poster.js';

const mockPost = {
  id: 'post-1',
  janela: 'manha',
  pilar: 'educacao',
  copy_principal: 'Texto de teste',
  hashtags: ['#telemedicina'],
  formato: 'estatico',
};

function mockSupabaseChain(finalResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    update: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
  };
  supabase.from.mockReturnValue(chain);
  return chain;
}

describe('runPostingJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fluxo completo: busca → lock → refine → validate → publish → mark published', async () => {
    // Primeira chamada: fetch post
    // Segunda chamada: lock (update)
    // Terceira chamada: mark published (update)
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
    };
    const lockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
    };
    const publishedChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    supabase.from
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(lockChain)
      .mockReturnValueOnce(publishedChain);

    refineCaption.mockResolvedValue({
      caption: 'Caption refinada',
      hashtags: ['#saude'],
      copy_curta: 'Curta',
    });
    validateCaption.mockReturnValue({ valid: true, violations: [] });
    publish.mockResolvedValue({ igPostId: 'ig-123', permalink: 'https://ig.com/p/123' });

    await runPostingJob('manha');

    expect(refineCaption).toHaveBeenCalledWith(mockPost);
    expect(validateCaption).toHaveBeenCalledWith('Caption refinada');
    expect(publish).toHaveBeenCalled();
  });

  it('bloqueia publicação quando compliance falha', async () => {
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPost, error: null }),
    };
    const lockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
    };
    const failChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    supabase.from
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(lockChain)
      .mockReturnValueOnce(failChain);

    refineCaption.mockResolvedValue({ caption: 'Caption com milagre', hashtags: [], copy_curta: '' });
    validateCaption.mockReturnValue({ valid: false, violations: ['\\bmilagre\\b'] });

    await runPostingJob('manha');

    expect(publish).not.toHaveBeenCalled();
  });

  it('busca o post usando data no fuso de Fortaleza, não em UTC (regressão da janela noite)', async () => {
    // 02:00 UTC = 23:00 BRT do dia anterior. O job da noite (21h BRT)
    // dispara nesse intervalo todo dia — antes do fix, buscava a data UTC
    // e nunca achava o post agendado.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T02:00:00Z'));

    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    };
    supabase.from.mockReturnValue(fetchChain);

    await runPostingJob('noite');

    // A query deve filtrar por data_agendada = '2026-05-12' (dia BRT),
    // NÃO '2026-05-13' (dia UTC).
    expect(fetchChain.eq).toHaveBeenCalledWith('data_agendada', '2026-05-12');
    expect(fetchChain.eq).not.toHaveBeenCalledWith('data_agendada', '2026-05-13');

    vi.useRealTimers();
  });

  it('não faz nada quando não há post agendado', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    };
    supabase.from.mockReturnValue(chain);

    await runPostingJob('manha');

    expect(refineCaption).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
