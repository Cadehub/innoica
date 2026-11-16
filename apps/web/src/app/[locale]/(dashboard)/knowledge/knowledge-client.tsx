'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import {
  ExternalLink,
  FileText,
  HelpCircle,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Upload,
  Lock,
} from 'lucide-react';

interface KnowledgeClientProps {
  agents: Array<{ id: string; name: string }>;
  initialSources: any[];
  planSlug: 'free' | 'starter';
  allowedTypes: string[];
  maxDocs: number;
}

export function KnowledgeClient({
  agents,
  initialSources,
  planSlug,
  allowedTypes,
  maxDocs,
}: KnowledgeClientProps) {
  const router = useRouter();
  const [sources, setSources] = useState<any[]>(initialSources);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [activeType, setActiveType] = useState<'faq' | 'txt' | 'url' | 'pdf'>('faq');

  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [txtTitle, setTxtTitle] = useState('');
  const [txtContent, setTxtContent] = useState('');
  const [webTitle, setWebTitle] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedAgentName = agents.find((a) => a.id === selectedAgentId)?.name || 'Agent';
  const isStarterFeatureLocked = !allowedTypes.includes(activeType);
  const reachedMaxDocs = sources.length >= maxDocs;

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || isStarterFeatureLocked) return;
    setLoading(true);
    setFeedback(null);

    try {
      let data: any;

      if (activeType === 'pdf') {
        if (!pdfFile) throw new Error('Veuillez sélectionner un fichier PDF.');
        const fd = new FormData();
        fd.append('agentId', selectedAgentId);
        if (pdfTitle.trim()) fd.append('title', pdfTitle.trim());
        fd.append('file', pdfFile);

        const res = await fetch('/api/knowledge/pdf', { method: 'POST', body: fd });
        data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Erreur lors de l'import PDF");
      } else {
        const endpoint =
          activeType === 'faq'
            ? '/api/knowledge/faq'
            : activeType === 'txt'
            ? '/api/knowledge/txt'
            : '/api/knowledge/url';

        const payload =
          activeType === 'faq'
            ? { agentId: selectedAgentId, question: faqQuestion, answer: faqAnswer }
            : activeType === 'txt'
            ? { agentId: selectedAgentId, title: txtTitle, content: txtContent }
            : { agentId: selectedAgentId, title: webTitle.trim() || undefined, url: webUrl };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur ingestion');
      }

      if (data.source) {
        const enriched = {
          ...data.source,
          agents: { id: selectedAgentId, name: selectedAgentName },
          agent_knowledge_chunks: [{ count: data.chunkCount || 1 }],
        };
        setSources((prev) => [enriched, ...prev]);
      }

      setFaqQuestion('');
      setFaqAnswer('');
      setTxtTitle('');
      setTxtContent('');
      setWebTitle('');
      setWebUrl('');
      setPdfTitle('');
      setPdfFile(null);
      setFeedback({
        type: 'success',
        text: `Source ajoutée et découpée en ${data.chunkCount || 1} fragment(s).`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/knowledge/${sourceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suppression impossible');
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form
          onSubmit={handleAddKnowledge}
          className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Ajouter une source</h2>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {sources.length} / {maxDocs} docs ({planSlug === 'starter' ? 'Starter' : 'Free'})
            </span>
          </div>

          {feedback && (
            <div
              className={`rounded-xl p-3 text-xs flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Agent cible</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs bg-white"
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'faq', label: 'FAQ', icon: HelpCircle },
                { id: 'txt', label: 'TXT', icon: FileText },
                { id: 'pdf', label: 'PDF', icon: Upload },
                { id: 'url', label: 'URL', icon: ExternalLink },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const locked = !allowedTypes.includes(item.id);
              const isSelected = activeType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveType(item.id)}
                  className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {locked && <Lock className="h-3 w-3 opacity-60" />}
                </button>
              );
            })}
          </div>

          {isStarterFeatureLocked ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800 space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-zinc-600" />
                <span>Fonctionnalité Starter</span>
              </div>
              <p className="text-zinc-600">
                L'import {activeType.toUpperCase()} est réservé au plan Starter (5 000 FCFA/mois). Le plan Free autorise jusqu'à {maxDocs} sources FAQ/TXT.
              </p>
              <Link
                href="/subscription"
                className="inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800"
              >
                Découvrir Starter
              </Link>
            </div>
          ) : (
            <>
              {activeType === 'faq' && (
                <>
                  <input
                    type="text"
                    required
                    placeholder="Question fréquente..."
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
                  />
                  <AutoGrowTextarea
                    required
                    minHeight={88}
                    maxHeight={220}
                    placeholder="Réponse détaillée..."
                    value={faqAnswer}
                    onChange={(e) => setFaqAnswer(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                  />
                </>
              )}

              {activeType === 'txt' && (
                <>
                  <input
                    type="text"
                    required
                    placeholder="Titre du document..."
                    value={txtTitle}
                    onChange={(e) => setTxtTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
                  />
                  <AutoGrowTextarea
                    required
                    minHeight={100}
                    maxHeight={240}
                    placeholder="Contenu texte..."
                    value={txtContent}
                    onChange={(e) => setTxtContent(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                  />
                </>
              )}

              {activeType === 'url' && (
                <>
                  <input
                    type="text"
                    placeholder="Titre personnalisé (optionnel)"
                    value={webTitle}
                    onChange={(e) => setWebTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
                  />
                  <input
                    type="url"
                    required
                    placeholder="https://votre-entreprise.com"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
                  />
                </>
              )}

              {activeType === 'pdf' && (
                <>
                  <input
                    type="text"
                    placeholder="Titre personnalisé (optionnel)"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
                  />
                  <input
                    type="file"
                    required
                    accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700"
                  />
                </>
              )}

              <button
                type="submit"
                disabled={loading || !selectedAgentId || reachedMaxDocs}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>Indexer la connaissance</span>
              </button>
            </>
          )}
        </form>

        {/* Sources list */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">
            Documents indexés ({sources.length})
          </h2>

          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
              Aucune connaissance enregistrée pour vos agents.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="py-3.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{src.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700 uppercase">
                        {src.source_type}
                      </span>
                      <span>Agent : {src.agents?.name || '—'}</span>
                      <span>• {src.agent_knowledge_chunks?.[0]?.count ?? 1} fragment(s)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(src.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
