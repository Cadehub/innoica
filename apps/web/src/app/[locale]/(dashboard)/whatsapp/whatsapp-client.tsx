'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  Smartphone,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Bot,
  ArrowRight,
} from 'lucide-react';

export function WhatsAppPageClient({ agents }: { agents: any[] }) {
  const router = useRouter();

  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [phoneNumber, setPhoneNumber] = useState('+237');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const currentWa = selectedAgent?.whatsapp_connections;

  const handleGenerateCode = async () => {
    if (!selectedAgentId || !phoneNumber) return;
    setLoading(true);
    setError(null);

    try {
      if (!phoneNumber.startsWith('+') || phoneNumber.length < 8) {
        throw new Error('Le numéro doit comporter l\'indicatif international (ex: +237691234567)');
      }

      const workerUrl = process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL || 'http://localhost:4001';
      const res = await fetch(`${workerUrl}/api/sessions/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          phoneNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la génération du Pairing Code');
      }

      setPairingCode(data.pairingCode);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (agentId: string) => {
    setLoading(true);
    try {
      const workerUrl = process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL || 'http://localhost:4001';
      await fetch(`${workerUrl}/api/sessions/${agentId}/disconnect`, {
        method: 'POST',
      });
      setPairingCode(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Liste des connexions existantes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Comptes WhatsApp Associés par Agent (1 Numéro = 1 Agent)
        </h2>

        {agents.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">
            Aucun agent n'a encore été créé. Veuillez d'abord créer un agent.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {agents.map((ag) => {
              const wa = ag.whatsapp_connections;
              const isConnected = wa?.status === 'connected';

              return (
                <div key={ag.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{ag.name}</div>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                        {wa?.phone_number || 'Non associé'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Connecté
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                        {wa?.status === 'pairing' ? 'En cours d\'association' : 'Déconnecté'}
                      </span>
                    )}

                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnect(ag.id)}
                        disabled={loading}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        Déconnecter
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(ag.id);
                          if (wa?.phone_number) setPhoneNumber(wa.phone_number);
                        }}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Associer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulaire d'appairage Pairing Code */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Associer un Compte WhatsApp par Pairing Code
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sélectionnez l'agent et saisissez votre numéro de téléphone avec l'indicatif international (+237...).
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Agent à associer</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 bg-white"
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Numéro WhatsApp (Format international)</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+237691234567"
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={loading || !selectedAgentId}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>Générer le Pairing Code</span>
            </button>
          </div>
        </div>

        {/* Pairing Code Display & Step-by-Step Instructions */}
        {pairingCode && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-6 text-center space-y-4">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
              Code de Jumelage (Valide 10 minutes)
            </span>

            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-extrabold tracking-widest text-slate-900 font-mono bg-white px-6 py-3 rounded-2xl border border-blue-200 shadow-sm">
                {pairingCode}
              </span>

              <button
                type="button"
                onClick={handleCopy}
                title="Copier le code"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>

            <div className="max-w-md mx-auto text-left bg-white p-4 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 mb-1">
                Instructions WhatsApp :
              </div>
              <div>1. Ouvrez WhatsApp &gt; Réglages &gt; Appareils connectés.</div>
              <div>2. Touchez <strong>Associer un appareil</strong>.</div>
              <div>3. Touchez en bas <strong>« Associer avec un numéro de téléphone »</strong>.</div>
              <div>4. Entrez le code à 8 chiffres affiché ci-dessus.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
