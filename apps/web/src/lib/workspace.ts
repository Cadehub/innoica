import { WorkspaceQuotaSnapshot } from '@innoica/shared';

export interface ActiveWorkspaceContext {
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
    account_status: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    plan_id: string | null;
    status: string;
  };
  quota: WorkspaceQuotaSnapshot | null;
}

export async function getActiveWorkspaceContext(
  supabase: any
): Promise<ActiveWorkspaceContext | null> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return null;
  }

  let { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, slug, owner_id, plan_id, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member || !member.workspaces) {
    await supabase.rpc('bootstrap_user_workspace', {
      p_full_name: user.user_metadata?.full_name || null,
    });

    const retry = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, slug, owner_id, plan_id, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    member = retry.data;
  }

  if (!member || !member.workspaces) {
    return null;
  }

  const [{ data: profile }, { data: quotaData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, is_super_admin, account_status')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('get_workspace_quota_snapshot', {
      p_workspace_id: member.workspace_id,
    }),
  ]);

  const ws = Array.isArray(member.workspaces) ? member.workspaces[0] : member.workspaces;

  return {
    user: {
      id: user.id,
      email: user.email || profile?.email || '',
    },
    profile: profile || {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || null,
      avatar_url: null,
      is_super_admin: false,
      account_status: 'active',
    },
    workspace: ws,
    quota:
      quotaData && !quotaData.error
        ? ({
            ...quotaData,
            capabilities: {
              voice_message_understanding: Boolean(
                quotaData.capabilities?.voice_message_understanding ??
                  (quotaData.planSlug !== 'free')
              ),
              ecommerce_store: Boolean(
                quotaData.capabilities?.ecommerce_store ??
                  (quotaData.planSlug === 'commerce')
              ),
              ...(quotaData.capabilities || {}),
            },
          } as WorkspaceQuotaSnapshot)
        : null,
  };
}
