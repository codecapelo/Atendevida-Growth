// Validador de conformidade CFM — Resoluções 2.314/2022 e 2.336/2023
const TERMOS_PROIBIDOS = [
  /\bcura(do|da)?\b/i,
  /\bgarant(ido|ida|imos)\b/i,
  /\bantes e depois\b/i,
  /\bmilagre/i,
  /\b100% (eficaz|seguro|efetivo)\b/i,
  /\bsem efeitos colaterais\b/i,
  /\bdiagnóstico garantido\b/i,
  /\bconsulta (grátis|gratuita)\b/i,
  /\btratamento definitivo\b/i,
  /\belimina (para sempre|definitivamente)\b/i,
];

/**
 * Valida se a caption não viola as regras do CFM.
 * @param {string} caption
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateCaption(caption) {
  const violations = TERMOS_PROIBIDOS.filter((rx) => rx.test(caption)).map(
    (rx) => rx.source,
  );
  return { valid: violations.length === 0, violations };
}

export class ComplianceError extends Error {
  constructor(violations) {
    super(`Caption viola ${violations.length} regra(s) do CFM`);
    this.name = 'ComplianceError';
    this.violations = violations;
  }
}
