import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),

  META_ACCESS_TOKEN: z.string().min(1),
  META_IG_BUSINESS_ID: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().default('v21.0'),

  TZ: z.string().default('America/Fortaleza'),
  SCHEDULE_MORNING: z.string().default('0 7 * * *'),
  SCHEDULE_LUNCH: z.string().default('0 12 * * *'),
  SCHEDULE_NIGHT: z.string().default('0 21 * * *'),
  SCHEDULE_METRICS: z.string().default('0 3 * * *'),

  ENABLE_AUTOPOST: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_METRICS_COLLECTOR: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  DRY_RUN: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
