import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('../src/config/env.js', () => ({
  env: { TZ: 'America/Fortaleza' },
}));

import { supabase } from '../src/services/supabase-client.js';
import {
  findById,
  list,
  create,
  update,
  remove,
  statsForToday,
  upcoming,
  calendarRange,
} from '../src/services/post-repo.js';

// Constrói um mock chainable do query builder do Supabase.
// Todos os métodos retornam o próprio chain; o chain é "thenable" (resolve
// para `finalResult` quando awaited). `.single()` e `.maybeSingle()` também
// resolvem para `finalResult` — basta passar o objeto certo (`{ data, error }`
// para single, `{ data, error, count }` para queries com count).
function chainMock(finalResult) {
  const chain = {};
  const methods = [
    'select', 'eq', 'order', 'limit', 'range', 'gte', 'lte',
    'not', 'insert', 'update', 'delete',
  ];
  for (const m of methods) chain[m] = vi.fn().mockReturnThis();
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  // Permite `await chain` direto (para queries que não terminam em .single()).
  chain.then = (resolve) => resolve(finalResult);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findById', () => {
  it('retorna a linha quando existe', async () => {
    const chain = chainMock({ data: { id: 'abc', tema: 'teste' }, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await findById('abc');
    expect(result).toEqual({ id: 'abc', tema: 'teste' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'abc');
  });

  it('retorna null quando PGRST116 (não encontrado)', async () => {
    const chain = chainMock({ data: null, error: { code: 'PGRST116' } });
    supabase.from.mockReturnValue(chain);

    expect(await findById('xxx')).toBeNull();
  });

  it('relança outros erros', async () => {
    const chain = chainMock({ data: null, error: { code: 'BOOM', message: 'fail' } });
    supabase.from.mockReturnValue(chain);

    await expect(findById('x')).rejects.toMatchObject({ code: 'BOOM' });
  });
});

describe('list', () => {
  it('aplica filtros e paginação', async () => {
    const chain = chainMock({ data: [{ id: '1' }], error: null, count: 1 });
    supabase.from.mockReturnValue(chain);

    const result = await list({ status: 'agendado', pilar: 'educacao', limit: 10, offset: 0 });

    expect(chain.eq).toHaveBeenCalledWith('status', 'agendado');
    expect(chain.eq).toHaveBeenCalledWith('pilar', 'educacao');
    expect(chain.range).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual({ rows: [{ id: '1' }], count: 1 });
  });

  it('default vazio quando sem filtros', async () => {
    const chain = chainMock({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    const result = await list();
    expect(result).toEqual({ rows: [], count: 0 });
  });
});

describe('create', () => {
  it('insere e retorna a linha criada', async () => {
    const chain = chainMock({ data: { id: 'new', tema: 'x' }, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await create({ tema: 'x' });
    expect(chain.insert).toHaveBeenCalledWith({ tema: 'x' });
    expect(result).toEqual({ id: 'new', tema: 'x' });
  });

  it('relança erro do Supabase', async () => {
    const chain = chainMock({ data: null, error: { message: 'unique violation' } });
    supabase.from.mockReturnValue(chain);

    await expect(create({})).rejects.toMatchObject({ message: 'unique violation' });
  });
});

describe('update', () => {
  it('atualiza e retorna a linha', async () => {
    const chain = chainMock({ data: { id: 'x', status: 'cancelado' }, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await update('x', { status: 'cancelado' });
    expect(chain.update).toHaveBeenCalledWith({ status: 'cancelado' });
    expect(result.status).toBe('cancelado');
  });

  it('retorna null em PGRST116', async () => {
    const chain = chainMock({ data: null, error: { code: 'PGRST116' } });
    supabase.from.mockReturnValue(chain);

    expect(await update('missing', {})).toBeNull();
  });
});

describe('remove', () => {
  it('retorna true quando deletou', async () => {
    const chain = chainMock({ data: [{ id: 'x' }], error: null });
    supabase.from.mockReturnValue(chain);

    expect(await remove('x')).toBe(true);
  });

  it('retorna false quando linha não existia', async () => {
    const chain = chainMock({ data: [], error: null });
    supabase.from.mockReturnValue(chain);

    expect(await remove('x')).toBe(false);
  });
});

describe('statsForToday', () => {
  it('agrega contagem por status', async () => {
    const today = '2026-05-12';
    const chain = chainMock({
      data: [
        { id: '1', status: 'agendado', janela: 'manha' },
        { id: '2', status: 'agendado', janela: 'almoco' },
        { id: '3', status: 'publicado', janela: 'noite' },
        { id: '4', status: 'falhou', janela: 'manha' },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(chain);

    const stats = await statsForToday('UTC');
    expect(stats.total).toBe(4);
    expect(stats.agendados).toBe(2);
    expect(stats.publicados).toBe(1);
    expect(stats.falhados).toBe(1);
    expect(stats.publicando).toBe(0);
    // 'today' deve ser uma string YYYY-MM-DD válida
    expect(stats.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('upcoming', () => {
  it('busca posts agendados a partir de hoje', async () => {
    const chain = chainMock({ data: [{ id: '1' }], error: null });
    supabase.from.mockReturnValue(chain);

    const result = await upcoming({ limit: 5, tz: 'America/Fortaleza' });
    expect(chain.eq).toHaveBeenCalledWith('status', 'agendado');
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ id: '1' }]);
  });
});

describe('calendarRange', () => {
  it('usa from/to quando fornecido (TZ-aware)', async () => {
    const chain = chainMock({ data: [{ id: 'a' }], error: null });
    supabase.from.mockReturnValue(chain);

    const result = await calendarRange({ from: '2026-05-12', to: '2026-05-18' });
    expect(chain.gte).toHaveBeenCalledWith('data_agendada', '2026-05-12');
    expect(chain.lte).toHaveBeenCalledWith('data_agendada', '2026-05-18');
    expect(result).toEqual([{ id: 'a' }]);
  });

  it('aceita número (legado) e deriva intervalo', async () => {
    const chain = chainMock({ data: [], error: null });
    supabase.from.mockReturnValue(chain);

    await calendarRange(7);
    expect(chain.gte).toHaveBeenCalled();
    expect(chain.lte).toHaveBeenCalled();
  });
});
