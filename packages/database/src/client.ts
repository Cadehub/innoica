// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Supabase Client Factory
// ====================================================================

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return 'https://test-supabase-url.supabase.co';
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return 'dummy-test-anon-key';
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Client Supabase standard pour requêtes authentifiées avec RLS
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/**
 * Client Supabase privilégié pour les workers de background (WhatsApp Worker, AI Runtime)
 */
export function createWorkerSupabaseClient(): SupabaseClient {
  const serviceKey = getSupabaseServiceRoleKey();
  if (serviceKey) {
    return createSupabaseClient(getSupabaseUrl(), serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  // En l'absence de service role key, fallback sur anon key
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey());
}
