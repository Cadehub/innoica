import { createClient } from '@/lib/supabase/server';
import { LandingClient } from '@/components/landing-client';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LandingClient
      locale={locale === 'en' ? 'en' : 'fr'}
      isAuthenticated={Boolean(user)}
    />
  );
}
