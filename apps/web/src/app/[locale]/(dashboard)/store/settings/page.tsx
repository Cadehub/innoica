import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { isReservedStoreSlug } from '@innoica/shared';
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
    .select('store_name, store_slug, description, logo_url, banner_url, currency, is_active, notification_phone, notify_on_new_order')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  const rawSlug = (ctx.workspace.slug || 'boutique')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeDefaultSlug =
    !rawSlug || rawSlug.length < 2 || isReservedStoreSlug(rawSlug)
      ? `boutique-${ctx.workspace.id.slice(0, 8)}`
      : rawSlug;

  const initialStore = store || {
    store_name: ctx.workspace.name || 'Ma Boutique',
    store_slug: safeDefaultSlug,
    description: '',
    logo_url: null,
    banner_url: null,
    currency: 'XAF',
    is_active: true,
    notification_phone: null,
    notify_on_new_order: true,
  };

  return (
    <StoreSettingsClient
      initialStore={initialStore}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
