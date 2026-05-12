// Helpers de data conscientes de timezone.
// Centralizados para evitar o bug "toISOString().split('T')[0]" que devolve
// o dia em UTC, derrapando próximo da meia-noite no fuso de negócio (BRT).

/**
 * Retorna o ISO date (YYYY-MM-DD) "hoje" no timezone informado.
 * @param {string} tz - IANA timezone name (ex: 'America/Fortaleza')
 */
export function todayInTz(tz) {
  return dateInTz(new Date(), tz);
}

/**
 * Retorna o ISO date (YYYY-MM-DD) do Date informado, projetado no timezone.
 */
export function dateInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

/**
 * Retorna os próximos `days` ISO dates a partir de hoje no timezone.
 * Usado no calendário (7 dias × janelas).
 */
export function nextDaysInTz(days, tz) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    out.push(dateInTz(d, tz));
  }
  return out;
}
