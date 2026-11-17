import React from 'react';
import Link from 'next/link';
import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { hasCommerceCapability } from '@/lib/feature-gating';
import { isStoreModuleEnabled } from '@/lib/feature-flags';
import { CommercePlanRequiredGate } from '@/components/store/commerce-plan-required-gate';
import { StoreTabsNav } from './store-tabs-nav';

interface StoreDashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function StoreDashboardLayout({
  children,
  params,
}: StoreDashboardLayoutProps) {
  const { locale } = await params;

  // Feature gate: if store module is not enabled in current environment, redirect to dashboard
  if (!isStoreModuleEnabled) {
    redirect({ href: '/dashboard', locale });
  }
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  // Triple-lock feature gating: if workspace does not have ecommerce capability, render upsell gate
  if (!ctx || !hasCommerceCapability(ctx)) {
    return (
      <CommercePlanRequiredGate
        currentPlan={ctx?.quota?.planSlug || 'free'}
        locale={locale === 'en' ? 'en' : 'fr'}
      />
    );
  }

  // Fetch or retrieve store slug for quick preview button
  const { data: store } = await supabase
    .from('store_settings')
    .select('store_slug, store_name, is_active')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  return (
    <div className="space-y-6 antialiased">
      {/* Top Navigation Tabs Header */}
      <StoreTabsNav
        storeSlug={store?.store_slug || ''}
        storeName={store?.store_name || ctx.workspace.name}
        isActive={store?.is_active ?? true}
        locale={locale === 'en' ? 'en' : 'fr'}
      />

      <div>{children}</div>
    </div>
  );
}
