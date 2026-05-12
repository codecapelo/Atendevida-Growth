import { supabase } from '#services/supabase-client.js';
import { todayInTz } from '#lib/date-tz.js';
import { env } from '#config/env.js';

const TABLE = 'atendevida_social_posts';

export async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function list({ status, pilar, janela, from, to, limit = 50, offset = 0 } = {}) {
  let q = supabase.from(TABLE).select('*', { count: 'exact' });
  if (status) q = q.eq('status', status);
  if (pilar) q = q.eq('pilar', pilar);
  if (janela) q = q.eq('janela', janela);
  if (from) q = q.gte('data_agendada', from);
  if (to) q = q.lte('data_agendada', to);
  q = q
    .order('data_agendada', { ascending: true })
    .order('horario', { ascending: true })
    .range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function create(values) {
  const { data, error } = await supabase.from(TABLE).insert(values).select('*').single();
  if (error) throw error;
  return data;
}

export async function update(id, values) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(values)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function statsForToday(timezone = env.TZ) {
  const today = todayInTz(timezone);

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, status, janela, horario, tema, pilar, data_agendada')
    .eq('data_agendada', today);

  if (error) throw error;

  const rows = data ?? [];
  const byStatus = (s) => rows.filter((r) => r.status === s).length;

  return {
    today,
    agendados: byStatus('agendado'),
    publicados: byStatus('publicado'),
    falhados: byStatus('falhou'),
    publicando: byStatus('publicando'),
    total: rows.length,
    rows,
  };
}

export async function upcoming({ limit = 10, tz = env.TZ } = {}) {
  const today = todayInTz(tz);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'agendado')
    .gte('data_agendada', today)
    .order('data_agendada', { ascending: true })
    .order('horario', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function topByReach({ days = 30, limit = 10 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'publicado')
    .not('metricas', 'is', null)
    .gte('posted_at', since.toISOString())
    .order('posted_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? [])
    .map((r) => ({ ...r, reach: r.metricas?.reach ?? 0 }))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, limit);

  return rows;
}

export async function calendarRange(days = 7) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days - 1);

  const from = start.toISOString().split('T')[0];
  const to = end.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('data_agendada', from)
    .lte('data_agendada', to)
    .order('data_agendada', { ascending: true })
    .order('horario', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function lastMetricsCollection() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('metrics_collected_at')
    .not('metrics_collected_at', 'is', null)
    .order('metrics_collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.metrics_collected_at ?? null;
}
