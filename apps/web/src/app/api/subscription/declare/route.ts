import { NextResponse } from 'next/server';
import { paymentDeclarationSchema } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export async function GET() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('payment_declarations')
    .select('*, plans(slug, name_fr, name_en)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, declarations: data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = paymentDeclarationSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Données de paiement invalides', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { planSlug, billingCycle, paymentMethod, reference, paidAt, proofNote } = parseRes.data;
    const targetSlug = planSlug || 'agent';

    const { data: selectedPlan, error: planErr } = await supabase
      .from('plans')
      .select('id, slug, name_fr, price_monthly_xaf, price_yearly_xaf, is_active')
      .eq('slug', targetSlug)
      .single();

    if (planErr || !selectedPlan) {
      return NextResponse.json(
        { success: false, error: `Plan « ${targetSlug} » introuvable en base de données.` },
        { status: 404 }
      );
    }

    // New subscriptions only allowed on active plans; starter allowed only for grandfathered renewals
    if (!selectedPlan.is_active && targetSlug !== 'starter') {
      return NextResponse.json(
        { success: false, error: `Le plan ${selectedPlan.name_fr} n'est plus ouvert aux nouvelles souscriptions.` },
        { status: 400 }
      );
    }

    const authoritativeAmount =
      billingCycle === 'yearly'
        ? Number(selectedPlan.price_yearly_xaf)
        : Number(selectedPlan.price_monthly_xaf);

    const { data: declaration, error: insertErr } = await supabase
      .from('payment_declarations')
      .insert({
        workspace_id: ctx.workspace.id,
        submitted_by: ctx.user.id,
        plan_id: selectedPlan.id,
        billing_cycle: billingCycle,
        amount_xaf: authoritativeAmount,
        payment_method: paymentMethod,
        reference,
        paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        proof_note: proofNote || null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertErr || !declaration) {
      return NextResponse.json(
        { success: false, error: insertErr?.message || 'Impossible de soumettre la déclaration.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, declaration }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
