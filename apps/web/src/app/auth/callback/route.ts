import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    try {
      await supabase.rpc('bootstrap_user_workspace', { p_full_name: null });
    } catch {
      // Best effort fallback bootstrap
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
