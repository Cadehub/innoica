'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { Link } from '@/i18n/routing';
import { Bot, Mail, Lock, User, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create user profile in profiles table
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        is_super_admin: false,
      });

      // Create default workspace for new user
      const slug = `workspace-${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const { data: ws } = await supabase
        .from('workspaces')
        .insert({
          name: `Workspace de ${fullName || email.split('@')[0]}`,
          slug,
          owner_id: data.user.id,
        })
        .select('id')
        .single();

      if (ws) {
        await supabase.from('workspace_members').insert({
          workspace_id: ws.id,
          user_id: data.user.id,
          role: 'owner',
        });
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <Bot className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Créer votre compte
          </h2>
          <p className="mt-1 text-sm font-medium text-blue-600">
            INNOICA WhatsApp Agents
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Compte créé avec succès ! Redirection vers votre dashboard...</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Nom complet ou Entreprise</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Jean Dupont ou Boutique Mode"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Adresse Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@entreprise.com"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mot de passe</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Commencer</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
