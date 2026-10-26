import { supabaseConfigSchema } from '../validation';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY = 'fos-supabase-config';

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Supabase connection: build-time env vars first (set as GitHub repository
 * variables), otherwise a connection saved on this device from Innstillinger.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const fromEnv = supabaseConfigSchema.safeParse({ url: envUrl ?? '', anonKey: envKey ?? '' });
  if (fromEnv.success) return fromEnv.data;

  const raw = safeStorage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const saved = supabaseConfigSchema.safeParse(JSON.parse(raw));
    return saved.success ? saved.data : null;
  } catch {
    return null;
  }
}

export function isEnvConfigured(): boolean {
  return supabaseConfigSchema.safeParse({
    url: import.meta.env.VITE_SUPABASE_URL ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  }).success;
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  const storage = safeStorage();
  if (!storage) return;
  if (config) storage.setItem(STORAGE_KEY, JSON.stringify(config));
  else storage.removeItem(STORAGE_KEY);
}
