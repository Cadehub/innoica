'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { CheckCircle2, Globe, Loader2, Save } from 'lucide-react';

export function SettingsClient({
  initialFullName,
  userEmail,
  initialWorkspaceName,
  workspaceSlug,
  locale,
}: {
  initialFullName: string;
  userEmail: string;
  initialWorkspaceName: string;
  workspaceSlug: string;
  locale: 'fr' | 'en';
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [fullName, setFullName] = useState(initialFullName);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [enterToSend, setEnterToSend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('innoica_inbox_enter_to_send');
    if (stored === 'false') setEnterToSend(false);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      window.localStorage.setItem('innoica_inbox_enter_to_send', enterToSend ? 'true' : 'false');
      await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, workspaceName, inboxEnterToSend: enterToSend }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">Compte & Workspace</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Email</label>
            <input
              type="email"
              disabled
              value={userEmail}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Nom du Workspace</label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Identifiant</label>
            <input
              type="text"
              disabled
              value={workspaceSlug}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">Langue & Préférences Inbox</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-zinc-100">
          <div>
            <div className="text-xs font-semibold text-zinc-900">Langue de l'interface</div>
            <div className="text-[11px] text-zinc-500">Français (défaut Cameroun) ou Anglais</div>
          </div>
          <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50">
            {(['fr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => router.replace(pathname, { locale: l })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase cursor-pointer transition-colors ${
                  locale === l ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                {l}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
          <div>
            <div className="text-xs font-semibold text-zinc-900">
              Entrée (Enter) envoie le message dans l'Inbox
            </div>
            <div className="text-[11px] text-zinc-500">
              Utilisez Maj + Entrée (Shift+Enter) pour aller à la ligne, comme WhatsApp Web.
            </div>
          </div>
          <input
            type="checkbox"
            checked={enterToSend}
            onChange={(e) => setEnterToSend(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 text-zinc-900"
          />
        </label>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Paramètres enregistrés avec succès.</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Enregistrer</span>
        </button>
      </div>
    </form>
  );
}
