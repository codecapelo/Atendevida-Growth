import { describe, it, expect } from 'vitest';
import { todayInTz, dateInTz, nextDaysInTz } from '../src/lib/date-tz.js';

describe('dateInTz', () => {
  it('projeta corretamente para America/Fortaleza (UTC-3, sem DST)', () => {
    // 2026-05-13T02:00:00Z = 2026-05-12T23:00:00 BRT → dia 12 em Fortaleza
    const d = new Date('2026-05-13T02:00:00Z');
    expect(dateInTz(d, 'America/Fortaleza')).toBe('2026-05-12');
  });

  it('UTC vs Fortaleza divergem na virada de meia-noite', () => {
    // 21h Fortaleza = 00h UTC do dia seguinte
    const d = new Date('2026-05-13T00:30:00Z');
    expect(dateInTz(d, 'UTC')).toBe('2026-05-13');
    expect(dateInTz(d, 'America/Fortaleza')).toBe('2026-05-12');
  });

  it('formato YYYY-MM-DD zero-padded', () => {
    const d = new Date('2026-01-05T15:00:00Z');
    expect(dateInTz(d, 'America/Fortaleza')).toBe('2026-01-05');
  });
});

describe('todayInTz', () => {
  it('retorna string no formato YYYY-MM-DD', () => {
    const result = todayInTz('America/Fortaleza');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('respeita fusos diferentes', () => {
    const utc = todayInTz('UTC');
    const tokyo = todayInTz('Asia/Tokyo');
    // Ambos válidos, podem ou não diferir dependendo da hora do dia.
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tokyo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('nextDaysInTz', () => {
  it('retorna N datas sequenciais começando em hoje', () => {
    const days = nextDaysInTz(7, 'America/Fortaleza');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(todayInTz('America/Fortaleza'));

    // Cada dia subsequente avança em 1
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T12:00:00Z`);
      const curr = new Date(`${days[i]}T12:00:00Z`);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(1);
    }
  });

  it('retorna array vazio para 0 dias', () => {
    expect(nextDaysInTz(0, 'America/Fortaleza')).toEqual([]);
  });
});
