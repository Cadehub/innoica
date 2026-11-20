'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  Bot,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  X,
  ArrowRight,
  Search,
  Plus,
  Layers,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Copy,
  Users,
  Radio,
  FileText,
  HelpCircle,
  Pencil,
} from 'lucide-react';
import {
  ActionType,
  AutomationDomain,
  NaturalInstructionCompileResult,
  TriggerType,
  WorkflowApproval,
  WorkflowDefinition,
  WorkflowExecution,
} from '@innoica/shared';

interface AutomationsClientProps {
  workspaceId: string;
  initialWorkflows: any[];
  initialApprovals: any[];
  initialExecutions: any[];
  agents: any[];
  locale: 'fr' | 'en';
}

const DOMAIN_LABELS: Record<string, { fr: string; en: string }> = {
  all: { fr: 'Tous les domaines', en: 'All domains' },
  general: { fr: 'Général', en: 'General' },
  sales: { fr: 'Vente & Prospection', en: 'Sales & Prospecting' },
  support: { fr: 'Service Client & Réclamations', en: 'Customer Support' },
  suppliers: { fr: 'Gestion Fournisseurs', en: 'Supplier Relations' },
  inventory: { fr: 'Stocks & Inventaire', en: 'Inventory' },
  orders: { fr: 'Commandes & Facturation', en: 'Orders' },
  hr: { fr: 'RH & Absences', en: 'HR & Absences' },
  internal: { fr: 'Gestion Interne & Rapports', en: 'Internal Reports' },
  group_mgmt: { fr: 'Groupes WhatsApp', en: 'WhatsApp Groups' },
  channel_mgmt: { fr: 'Chaînes WhatsApp', en: 'WhatsApp Channels' },
  commerce: { fr: 'E-Commerce Natif', en: 'E-Commerce' },
};

export function AutomationsClient({
  workspaceId,
  initialWorkflows,
  initialApprovals,
  initialExecutions,
  agents,
  locale,
}: AutomationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<'nlp' | 'list' | 'builder' | 'executions' | 'approvals'>('nlp');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(initialWorkflows);
  const [approvals, setApprovals] = useState<WorkflowApproval[]>(initialApprovals);
  const [executions, setExecutions] = useState<WorkflowExecution[]>(initialExecutions);

  // NLP Instruction State
  const [naturalInstruction, setNaturalInstruction] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<NaturalInstructionCompileResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Automation State
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [editName, setEditName] = useState('');
  const [editCompiling, setEditCompiling] = useState(false);
  const [editCompileResult, setEditCompileResult] = useState<NaturalInstructionCompileResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Visual Builder Draft State
  const [builderName, setBuilderName] = useState('');
  const [builderDomain, setBuilderDomain] = useState<AutomationDomain>('general');
  const [builderTrigger, setBuilderTrigger] = useState<TriggerType>('wa_private_message_received');
  const [builderSteps, setBuilderSteps] = useState<
    Array<{ id: string; name: string; action_type: ActionType; payload: Record<string, any> }>
  >([
    {
      id: 'step_1',
      name: 'Répondre au message',
      action_type: 'send_private_message',
      payload: { text: 'Message bien reçu.' },
    },
  ]);

  // Compiler une consigne naturelle
  const handleCompile = async () => {
    if (!naturalInstruction.trim()) return;
    setIsCompiling(true);
    setCompileResult(null);
    setFeedback(null);

    try {
      const res = await fetch('/api/automations/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: naturalInstruction,
          agentId: selectedAgentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de compilation');
      }
      setCompileResult(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur d’analyse de la consigne' });
    } finally {
      setIsCompiling(false);
    }
  };

  // Sauvegarder et activer le workflow compilé
  const handleSaveCompiledWorkflow = async () => {
    if (!compileResult?.workflow) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...compileResult.workflow,
          agent_id: selectedAgentId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur d’enregistrement');
      }

      setWorkflows((prev) => [data.workflow, ...prev]);
      setFeedback({ type: 'success', message: 'Automatisation activée avec succès !' });
      setNaturalInstruction('');
      setCompileResult(null);
      setActiveTab('list');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Échec d’activation' });
    } finally {
      setIsSaving(false);
    }
  };

  // Basculer le statut d'un workflow
  const handleToggleStatus = async (wf: WorkflowDefinition) => {
    const nextStatus = wf.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/automations/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === wf.id ? { ...w, status: nextStatus } : w))
        );
      }
    } catch {
      // Ignorer
    }
  };

  // Supprimer un workflow
  const handleDeleteWorkflow = async (wfId: string) => {
    if (!confirm('Supprimer définitivement cette automatisation ?')) return;
    try {
      const res = await fetch(`/api/automations/${wfId}`, { method: 'DELETE' });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
      }
    } catch {
      // Ignorer
    }
  };

  // Démarrer l'édition d'une automatisation
  const handleStartEdit = (wf: WorkflowDefinition) => {
    setEditingWorkflow(wf);
    setEditInstruction(wf.natural_instruction || wf.name || '');
    setEditName(wf.name || '');
    setEditCompileResult(null);
  };

  // Recompiler la consigne éditée
  const handleEditCompile = async () => {
    if (!editInstruction.trim()) return;
    setEditCompiling(true);
    setEditCompileResult(null);
    try {
      const res = await fetch('/api/automations/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: editInstruction,
          agentId: editingWorkflow?.agent_id || selectedAgentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de compilation de la consigne');
      }
      setEditCompileResult(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur d’analyse de la consigne' });
    } finally {
      setEditCompiling(false);
    }
  };

  // Sauvegarder les modifications apportées à l'automatisation
  const handleSaveEdit = async () => {
    if (!editingWorkflow) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/automations/${editingWorkflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          natural_instruction: editInstruction.trim(),
          recompile: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la mise à jour');
      }
      setWorkflows((prev) =>
        prev.map((w) => (w.id === editingWorkflow.id ? data.workflow : w))
      );
      setFeedback({ type: 'success', message: 'Consigne et automatisation mises à jour avec succès !' });
      setEditingWorkflow(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Échec de la sauvegarde' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Charger dans le compilateur principal
  const handleLoadInCompiler = (wf: WorkflowDefinition) => {
    setNaturalInstruction(wf.natural_instruction || wf.name || '');
    if (wf.agent_id) setSelectedAgentId(wf.agent_id);
    setActiveTab('nlp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFeedback({
      type: 'success',
      message: 'Consigne chargée dans le compilateur. Modifiez-la et compilez pour générer une nouvelle version.',
    });
  };

  // Traiter une approbation humaine
  const handleApprovalDecision = async (approvalId: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/automations/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        setFeedback({
          type: 'success',
          message: decision === 'approved' ? 'Action approuvée et exécutée.' : 'Action refusée et annulée.',
        });
      }
    } catch {
      // Ignorer
    }
  };

  const filteredWorkflows = workflows.filter((w) =>
    selectedDomain === 'all' ? true : w.domain === selectedDomain
  );

  return (
    <div className="space-y-6 antialiased">
      {/* Header Studio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
              {locale === 'en' ? 'Automation Studio' : 'Automation Studio'}
            </h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-medium text-zinc-700">
              Moteur v2.0
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 max-w-2xl">
            {locale === 'en'
              ? 'Program agent behaviors and cross-domain business workflows using plain natural language.'
              : 'Programmez le comportement de vos agents et vos procédures métier complexes avec de simples instructions en langage naturel.'}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-zinc-100 p-1 border border-zinc-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('nlp')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'nlp' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-zinc-800" />
            <span>Instructions Naturelles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'list' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Mes Automatisations ({workflows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'approvals' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Approbations</span>
            {approvals.length > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-1.5 text-[10px] font-mono">
                {approvals.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('executions')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'executions' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Historique ({executions.length})</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-4 text-xs font-medium flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1 : PROGRAMMATION PAR INSTRUCTIONS NATURELLES */}
      {/* ============================================================== */}
      {activeTab === 'nlp' && (
        <div className="space-y-6">
          {/* Saisie Naturelle */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-zinc-950 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-zinc-900" />
                  Programmer votre agent en langage naturel
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Écrivez votre consigne comme vous l'expliqueriez à un collaborateur humain. Le compilateur INNOICA décompose l'instruction en déclencheurs, conditions et étapes d'action autorisées.
                </p>
              </div>

              {agents.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-zinc-500">Agent cible :</span>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <textarea
                value={naturalInstruction}
                onChange={(e) => setNaturalInstruction(e.target.value)}
                placeholder="Exemple : Si un client demande un produit et que tu ne trouves pas sa disponibilité, contacte le fournisseur autorisé, demande l’information, attends sa réponse puis réponds au client..."
                rows={4}
                className="w-full rounded-xl border border-zinc-300 p-3.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-400">
                Supporte : Vente, Service Client, Fournisseurs, RH/Absences, Rapports quotidiens, Groupes WhatsApp.
              </span>
              <button
                type="button"
                onClick={handleCompile}
                disabled={isCompiling || naturalInstruction.trim().length < 5}
                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-2xs"
              >
                {isCompiling ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyse et compilation en cours...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Compiler & Simuler le scénario</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Résultat de la Compilation & Simulation */}
          {compileResult && compileResult.success && compileResult.workflow && (
            <div className="rounded-2xl border-2 border-zinc-900 bg-white p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-zinc-900 text-white text-[10px] font-mono font-medium px-2 py-0.5 uppercase tracking-wider">
                      {compileResult.detectedDomain}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-950">
                      {compileResult.workflow.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {compileResult.humanExplanation}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCompiledWorkflow}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isSaving ? 'Activation...' : 'Approuver & Activer cette règle'}</span>
                  </button>
                </div>
              </div>

              {/* Séquence Déterministe d'Exécution */}
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                  Séquence d'exécution validée (Déclencheur ➔ Conditions ➔ Actions) :
                </span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Déclencheur */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">1. Déclencheur</span>
                    <div className="text-xs font-medium text-zinc-900">
                      {compileResult.workflow.trigger_type}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">2. Filtrage ({compileResult.workflow.conditions?.length || 0})</span>
                    <div className="text-xs text-zinc-700">
                      {compileResult.workflow.conditions?.length ? (
                        compileResult.workflow.conditions.map((c: any, i: number) => (
                          <div key={i} className="truncate">{c.field} {c.operator} {c.value}</div>
                        ))
                      ) : (
                        <span className="text-zinc-400 italic">Sans filtre préalable</span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Attente */}
                  <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">3. Actions & Attentes ({compileResult.workflow.steps?.length || 0})</span>
                    <div className="space-y-1">
                      {compileResult.workflow.steps?.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-800">
                          <span className="font-mono text-zinc-400 text-[10px]">#{idx + 1}</span>
                          <span className="font-semibold">{step.name}</span>
                          <span className="text-zinc-400 text-[10px]">({step.action_type})</span>
                          {step.action_type === 'wait_for_message' && (
                            <span className="rounded bg-amber-100 text-amber-800 px-1 text-[9px] font-mono">
                              Attente asynchrone
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphe Déterministe DAG */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px]">
                    Topologie d'Exécution DAG (Graphe Déterministe)
                  </span>
                  <span className="text-zinc-500 text-[10px]">
                    {compileResult.workflow.steps?.length || 0} étape(s)
                  </span>
                </div>

                <div className="flex flex-col space-y-2">
                  {/* Nœud Déclencheur */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-xs font-mono shrink-0 shadow-2xs">
                      <Play className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 rounded-xl border border-zinc-300 bg-white p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900">Événement Déclencheur</span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-700">
                          {compileResult.workflow.trigger_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connecteur */}
                  <div className="ml-4 w-0.5 h-3 bg-zinc-300" />

                  {/* Nœud Conditions */}
                  {compileResult.workflow.conditions && compileResult.workflow.conditions.length > 0 && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-mono shrink-0 shadow-2xs">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-2xs">
                          <span className="text-[10px] font-mono text-amber-800 uppercase font-semibold block mb-1">
                            Filtres d'admissibilité ({compileResult.workflow.conditions.length})
                          </span>
                          <div className="text-xs text-zinc-800 font-mono space-y-0.5">
                            {compileResult.workflow.conditions.map((c: any, i: number) => (
                              <div key={i}>
                                • {c.field} <span className="text-amber-700">{c.operator}</span> {String(c.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 w-0.5 h-3 bg-zinc-300" />
                    </>
                  )}

                  {/* Nœuds d'Actions DAG */}
                  {compileResult.workflow.steps?.map((step: any, idx: number) => {
                    const isWait = step.action_type === 'wait_for_message' || step.action_type === 'wait_delay';
                    const isApproval = step.require_approval;
                    const isLast = idx === (compileResult.workflow?.steps?.length ?? 1) - 1;

                    return (
                      <div key={step.id || idx}>
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 shadow-2xs ${
                              isWait
                                ? 'bg-amber-600 text-white'
                                : isApproval
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-800 text-white'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-900">{step.name}</span>
                                <span className="rounded bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono text-zinc-700">
                                  {step.action_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isWait && (
                                  <span className="rounded bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[9px] font-mono font-medium">
                                    Attente asynchrone
                                  </span>
                                )}
                                {isApproval && (
                                  <span className="rounded bg-purple-100 text-purple-900 px-1.5 py-0.5 text-[9px] font-mono font-medium">
                                    Approbation requise
                                  </span>
                                )}
                              </div>
                            </div>

                            {step.next_step_id && (
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-100">
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                                <span>Cible suivante : {step.next_step_id}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isLast && <div className="ml-4 w-0.5 h-3 bg-zinc-300" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Simulation Dry-Run */}
              {compileResult.simulatedDryRun && (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-900 text-zinc-100 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Simulation d'exécution (Dry-Run virtuel)</span>
                    <span className="text-emerald-400">Prêt pour exécution</span>
                  </div>
                  <div className="space-y-1.5 pt-1 text-xs font-mono">
                    {compileResult.simulatedDryRun.stepsSimulated.map((s, idx) => (
                      <div key={idx} className="flex items-baseline gap-2">
                        <span className="text-zinc-500">[{idx + 1}]</span>
                        <span className="text-zinc-200">{s.stepName} :</span>
                        <span className="text-zinc-400">{s.outputPreview}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informations manquantes détectées */}
              {compileResult.missingInformation.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Détails complémentaires recommandés :</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                    {compileResult.missingInformation.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Directives Architecturales & Capacités du Studio */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 font-mono">
                Directives de programmation universelle
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Compilateur Déterministe Zod v2.0</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Formulez librement vos règles d'entreprise en langage naturel. Le moteur analyse l'intention métier, résout les dépendances, extrait les numéros cibles ou les délais, et structure l'exécution DAG en toute sécurité.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                <div className="font-semibold text-zinc-900">Événements Déclencheurs</div>
                <p className="text-zinc-600 text-[11px]">Messages WhatsApp entrants, audios vocaux, images, mentions de groupe, réclamations ou planifications cron.</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                <div className="font-semibold text-zinc-900">Corrélation Asynchrone</div>
                <p className="text-zinc-600 text-[11px]">Mise en pause sécurisée (attente réponse tiers), isolation des conversations et reprise sans boucle.</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-1">
                <div className="font-semibold text-zinc-900">Garde-Fou & Approbations</div>
                <p className="text-zinc-600 text-[11px]">Approbation humaine obligatoire pour toute action administrative impactante sur les groupes ou les contacts.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2 : LISTE DES AUTOMATISATIONS ACTIVES */}
      {/* ============================================================== */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filtres par domaine */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {Object.keys(DOMAIN_LABELS).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDomain(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 transition-colors ${
                  selectedDomain === d
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {DOMAIN_LABELS[d][locale]}
              </button>
            ))}
          </div>

          {filteredWorkflows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-3">
              <Layers className="h-8 w-8 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-900">Aucune automatisation dans cette catégorie</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Créez votre première règle en langage naturel dans l'onglet "Instructions Naturelles" ci-dessus.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-zinc-300 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-950 truncate">{wf.name}</span>
                      <span className="rounded bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-mono px-1.5 py-0.5">
                        {wf.domain}
                      </span>
                      {wf.status === 'active' ? (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                          Actif
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold px-2 py-0.5">
                          En pause
                        </span>
                      )}
                    </div>

                    {wf.natural_instruction && (
                      <p className="text-xs text-zinc-500 italic line-clamp-1">
                        "{wf.natural_instruction}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                      <span>Déclencheur : {wf.trigger_type}</span>
                      <span>•</span>
                      <span>{wf.steps?.length || 0} étape(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(wf)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors shadow-2xs"
                      title="Modifier la consigne et le comportement"
                    >
                      <Pencil className="h-3.5 w-3.5 text-zinc-600" />
                      <span>Modifier</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(wf)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        wf.status === 'active'
                          ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {wf.status === 'active' ? 'Suspendre' : 'Activer'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal d'édition d'une automatisation */}
      {editingWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-950">
                    Modifier l'automatisation
                  </h3>
                  <span className="rounded bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono text-zinc-700">
                    {editingWorkflow.domain}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ajustez l'instruction en langage naturel ci-dessous. Le compilateur recalculera les étapes et les actions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkflow(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nom du scénario
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="Nom descriptif..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Consigne en langage naturel
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Précisez les conditions, le numéro de téléphone ou l'action attendue
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 font-sans"
                  placeholder="Écrivez votre consigne modifiée..."
                />
              </div>

              {/* Prévisualisation recompilée si disponible */}
              {editCompileResult?.workflow && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900">Aperçu du scénario recalculé</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {editCompileResult.workflow.steps?.length || 0} étape(s)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {editCompileResult.workflow.steps?.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-zinc-700 font-mono text-[11px]">
                        <span className="text-zinc-400">#{idx + 1}</span>
                        <span className="font-medium text-zinc-900">{step.name}</span>
                        <span className="text-zinc-400">({step.action_type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => handleLoadInCompiler(editingWorkflow)}
                className="text-xs text-zinc-600 hover:text-zinc-900 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Ouvrir dans le studio complet</span>
                <ArrowRight className="h-3 w-3" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEditCompile}
                  disabled={editCompiling || !editInstruction.trim()}
                  className="rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors disabled:opacity-50"
                >
                  {editCompiling ? 'Analyse...' : 'Tester la consigne'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isUpdating || !editInstruction.trim()}
                  className="rounded-xl bg-zinc-900 hover:bg-zinc-800 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3 : APPROBATIONS HUMAINES EN ATTENTE */}
      {/* ============================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600">
            <strong>Garde-fou humain inviolable :</strong> Les actions administratives sensibles (comme l'exclusion d'un membre d'un groupe, la modification des droits ou les envois de masse) ne sont jamais exécutées par l'agent sans votre feu vert explicite ci-dessous.
          </div>

          {approvals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-900">Aucune approbation en attente</h3>
              <p className="text-xs text-zinc-500">Toutes les actions requérant votre validation ont été traitées.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border-2 border-amber-300 bg-amber-50/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-950">{app.title}</span>
                      <span className="rounded bg-amber-100 text-amber-900 text-[10px] font-mono px-1.5 py-0.5">
                        {app.action_type}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">{app.description}</p>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Demandé le : {new Date(app.requested_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApprovalDecision(app.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors"
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovalDecision(app.id, 'approved')}
                      className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white transition-colors shadow-2xs"
                    >
                      Approuver l'action
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4 : HISTORIQUE & JOURNAL DES EXÉCUTIONS */}
      {/* ============================================================== */}
      {activeTab === 'executions' && (
        <div className="space-y-3">
          {executions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-2">
              <Clock className="h-8 w-8 text-zinc-400 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-900">Aucune exécution enregistrée</h3>
              <p className="text-xs text-zinc-500">L'historique des déclenchements et reprises s'affichera ici.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Workflow</th>
                    <th className="py-2.5 px-4">Événement</th>
                    <th className="py-2.5 px-4">Statut</th>
                    <th className="py-2.5 px-4">Étape</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-800">
                  {executions.map((ex) => (
                    <tr key={ex.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-semibold">{(ex as any).workflow?.name || 'Workflow inconnu'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600">{ex.trigger_event}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase font-semibold ${
                            ex.status === 'succeeded'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ex.status === 'waiting'
                              ? 'bg-amber-100 text-amber-800'
                              : ex.status === 'failed'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {ex.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">Étape {ex.current_step_index}</td>
                      <td className="py-3 px-4 text-zinc-400">{new Date(ex.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
