// ====================================================================
// INNOICA WhatsApp Agents — Server-Side Feature Gating
// Gating helper for commercial capabilities (e-commerce, store builder)
// ====================================================================

import { ActiveWorkspaceContext } from '@/lib/workspace';
import { NextResponse } from 'next/server';

export class FeatureGateError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string = 'Cette fonctionnalité nécessite le forfait INNOICA Commerce (6 500 FCFA/mois).',
    statusCode: number = 403,
    code: string = 'COMMERCE_PLAN_REQUIRED'
  ) {
    super(message);
    this.name = 'FeatureGateError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Returns true if the active workspace has the 'ecommerce_store' capability.
 */
export function hasCommerceCapability(ctx: ActiveWorkspaceContext | null | undefined): boolean {
  if (!ctx || !ctx.quota) {
    return false;
  }

  // Check explicit capability in quota
  if (ctx.quota.capabilities && typeof ctx.quota.capabilities.ecommerce_store === 'boolean') {
    return ctx.quota.capabilities.ecommerce_store;
  }

  // Fallback to plan slug if capabilities not explicitly hydrated
  const planSlug = ctx.quota.planSlug;
  const status = ctx.quota.subscriptionStatus;
  const isActive = !status || status === 'active';

  return planSlug === 'commerce' && isActive;
}

/**
 * Asserts that the active workspace has the 'ecommerce_store' capability.
 * Throws FeatureGateError (HTTP 403) if not allowed.
 */
export function requireCommerceCapability(ctx: ActiveWorkspaceContext | null | undefined): boolean {
  if (!hasCommerceCapability(ctx)) {
    throw new FeatureGateError(
      'Accès refusé : la boutique en ligne et les fonctionnalités e-commerce requièrent l’offre INNOICA Commerce (6 500 FCFA/mois).',
      403,
      'COMMERCE_PLAN_REQUIRED'
    );
  }
  return true;
}

/**
 * API route helper: returns a 403 Response if commerce capability is missing, or null if allowed.
 */
export function assertCommerceApiAccess(ctx: ActiveWorkspaceContext | null | undefined): NextResponse | null {
  if (!hasCommerceCapability(ctx)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Cette ressource requiert le forfait INNOICA Commerce (6 500 FCFA/mois).',
        code: 'COMMERCE_PLAN_REQUIRED',
        upgradeUrl: '/subscription',
      },
      { status: 403 }
    );
  }
  return null;
}
