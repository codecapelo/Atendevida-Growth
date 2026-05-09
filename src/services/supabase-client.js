import { createClient } from '@supabase/supabase-js';
import { env } from '#config/env.js';

// Singleton — reutilizar em todos os módulos via import
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
