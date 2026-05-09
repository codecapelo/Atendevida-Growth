import { describe, it, expect } from 'vitest';
import { validateCaption, ComplianceError } from '../src/lib/compliance.js';

describe('validateCaption', () => {
  it('aprova caption limpa', () => {
    const result = validateCaption('Está com febre às 2h da manhã? Atendemos agora pelo link da bio.');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('detecta violações individuais', () => {
    const cases = [
      ['curado', 'cura'],
      ['curada', 'cura'],
      ['garantido', 'garant'],
      ['garantida', 'garant'],
      ['garantimos', 'garant'],
      ['antes e depois', 'antes e depois'],
      ['milagre', 'milagre'],
      ['100% eficaz', '100%'],
      ['100% seguro', '100%'],
      ['100% efetivo', '100%'],
      ['sem efeitos colaterais', 'sem efeitos colaterais'],
      ['diagnóstico garantido', 'diagnóstico garantido'],
      ['consulta grátis', 'consulta'],
      ['consulta gratuita', 'consulta'],
      ['tratamento definitivo', 'tratamento definitivo'],
    ];

    for (const [term, label] of cases) {
      it(`rejeita "${label}"`, () => {
        const result = validateCaption(`Nossa plataforma oferece ${term} para você.`);
        expect(result.valid).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    }
  });

  it('é case-insensitive', () => {
    expect(validateCaption('Resultado GARANTIDO!').valid).toBe(false);
    expect(validateCaption('Você estará CURADO.').valid).toBe(false);
  });

  it('retorna múltiplas violações quando há mais de uma', () => {
    const result = validateCaption('Curado e garantido, é um milagre!');
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('não gera falso positivo para palavras similares', () => {
    expect(validateCaption('Cuide da sua saúde com carinho.').valid).toBe(true);
    expect(validateCaption('Garantia de atendimento rápido.').valid).toBe(true);
  });
});

describe('ComplianceError', () => {
  it('carrega as violações corretamente', () => {
    const err = new ComplianceError(['\\bcura\\b', '\\bmilagre\\b']);
    expect(err.violations).toHaveLength(2);
    expect(err.name).toBe('ComplianceError');
    expect(err.message).toContain('2 regra(s)');
  });
});
