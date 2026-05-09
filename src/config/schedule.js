import { env } from '#config/env.js';

export const SCHEDULES = {
  morning: env.SCHEDULE_MORNING,
  lunch: env.SCHEDULE_LUNCH,
  night: env.SCHEDULE_NIGHT,
  metrics: env.SCHEDULE_METRICS,
};

export const TIMEZONE = env.TZ;

// Mapeia janelas para horários de referência (para logs)
export const WINDOW_LABELS = {
  morning: 'manha',
  lunch: 'almoco',
  night: 'noite',
};
