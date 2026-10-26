import { getSupabaseConfig } from './config';
import { DemoApi } from './demoApi';
import type { DataApi } from './types';

/** Supabase when configured (loaded on demand), otherwise the on-device demo. */
export async function createApi(): Promise<DataApi> {
  const config = getSupabaseConfig();
  if (!config) return new DemoApi();
  const { SupabaseApi } = await import('./supabaseApi');
  return new SupabaseApi(config);
}

export * from './types';
