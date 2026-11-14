import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect({ href: '/dashboard', locale: 'fr' });
  } else {
    redirect({ href: '/login', locale: 'fr' });
  }
}
