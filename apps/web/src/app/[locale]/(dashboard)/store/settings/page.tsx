import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { StoreSettingsClient } from './store-settings-client';

interface StoreSettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function StoreSettingsPage({ params }: StoreSettingsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) return null;

  const { data: store } = await supabase
    .from('store_settings')
    .select('store_name, store_slug, description, currency, is_active')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  const initialStore = store || {
    store_name: ctx.workspace.name || 'Ma Boutique',
    store_slug: (ctx.workspace.slug || 'boutique').toLowerCase(),
    description: '',
    currency: 'XAF',
    is_active: true,
  };

  return (
    <StoreSettingsClient
      initialStore={initialStore}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
