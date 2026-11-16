'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import {
  MessageSquare,
  Search,
  Bot,
  User,
  Send,
  Loader2,
  CheckCheck,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  ArrowLeft,
  PanelRight,
  Brain,
  Plus,
  Trash2,
  Save,
  X,
  Phone,
  CornerDownLeft,
  ChevronUp,
  Mic,
} from 'lucide-react';

interface InboxClientProps {
  initialConversations: any[];
  initialReplyCounts: Record<string, number>;
  planSlug: 'free' | 'starter';
  maxRepliesPerConv: number | null;
  maxNewConvs: number | null;
  usedNewConvs: number;
}

const PAGE_SIZE = 60;

export function InboxClient({
  initialConversations,
  initialReplyCounts,
  planSlug,
  maxRepliesPerConv,
  maxNewConvs,
  usedNewConvs,
}: InboxClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [conversations, setConversations] = useState<any[]>(initialConversations);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>(initialReplyCounts);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const selectedConvIdRef = useRef<string | null>(selectedConvId);
  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
  }, [selectedConvId]);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'ai_active' | 'human_takeover' | 'paused'>(
    'all'
  );

  // Thread Messages & Pagination
  const [messages, setMessages] = useState<any[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Composer
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [enterToSend, setEnterToSend] = useState(true);

  // Inspector: Memories & Internal Notes
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [contactMemories, setContactMemories] = useState<any[]>([]);
  const [conversationMemories, setConversationMemories] = useState<any[]>([]);
  const [newMemScope, setNewMemScope] = useState<'contact' | 'conversation'>('contact');
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemValue, setNewMemValue] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId) || null;

  useEffect(() => {
    const stored = window.localStorage.getItem('innoica_inbox_enter_to_send');
    if (stored === 'false') setEnterToSend(false);
  }, []);

  const toggleEnterToSend = () => {
    setEnterToSend((prev) => {
      const next = !prev;
      window.localStorage.setItem('innoica_inbox_enter_to_send', next ? 'true' : 'false');
      return next;
    });
  };

  // Load selected conversation messages + mark read + load memories
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    const activeConv = conversations.find((c) => c.id === selectedConvId);
    setInternalNotes(activeConv?.internal_notes || '');
    setSendError(null);

    let active = true;

    const loadInitial = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConvId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (!active) return;
      const rows = data || [];
      setHasOlderMessages(rows.length > PAGE_SIZE);
      const ordered = rows.slice(0, PAGE_SIZE).reverse();
      setMessages(ordered);
      setLoadingMessages(false);

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });

      if (activeConv?.unread_count > 0) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConvId ? { ...c, unread_count: 0 } : c))
        );
        fetch('/api/conversations/mode', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: selectedConvId, markRead: true }),
        }).catch(() => null);
      }

      if (activeConv?.contact_id) {
        fetch(
          `/api/memories?contactId=${encodeURIComponent(
            activeConv.contact_id
          )}&conversationId=${encodeURIComponent(selectedConvId)}`
        )
          .then((r) => r.json())
          .then((mem) => {
            if (!active || !mem.success) return;
            setContactMemories(mem.contactMemories || []);
            setConversationMemories(mem.conversationMemories || []);
          })
          .catch(() => null);
      }
    };

    loadInitial();

    const msgChannel = supabase
      .channel(`inbox-msg-${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row?.id) return;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === row.id);
            if (exists) {
              return prev.map((m) => (m.id === row.id ? { ...m, ...row } : m));
            }
            return [...prev, row];
          });
          if (payload.eventType === 'INSERT' && (row.sender_type === 'agent' || row.sender_type === 'ai')) {
            setReplyCounts((prev) => ({
              ...prev,
              [selectedConvId]: (prev[selectedConvId] || 0) + 1,
            }));
          }
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConvId, supabase]);

  // Global conversation and real-time inbound message subscriptions
  useEffect(() => {
    const convChannel = supabase
      .channel('inbox-conversations-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async (payload: any) => {
          const updated = payload.new;
          if (!updated?.id) return;

          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) return prev;
            return prev
              .map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
              .sort(
                (a, b) =>
                  new Date(b.last_message_at || b.updated_at).getTime() -
                  new Date(a.last_message_at || a.updated_at).getTime()
              );
          });

          if (payload.eventType === 'INSERT') {
            const { data: fullConv } = await supabase
              .from('conversations')
              .select('*, contacts(*), agents(id, name, workspace_id, status)')
              .eq('id', updated.id)
              .maybeSingle();

            if (fullConv) {
              setConversations((prev) => {
                const filtered = prev.filter((c) => c.id !== fullConv.id);
                return [fullConv, ...filtered].sort(
                  (a, b) =>
                    new Date(b.last_message_at || b.updated_at).getTime() -
                    new Date(a.last_message_at || a.updated_at).getTime()
                );
              });
            }
          }
        }
      )
      .subscribe();

    const globalMsgChannel = supabase
      .channel('inbox-global-messages-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg?.conversation_id) return;

          const isCurrentActive = newMsg.conversation_id === selectedConvIdRef.current;
          const isContactMsg =
            newMsg.sender_type === 'contact' || newMsg.direction === 'inbound';

          setConversations((prev) => {
            const target = prev.find((c) => c.id === newMsg.conversation_id);
            if (!target) {
              // Hydrate new conversation asynchronously
              supabase
                .from('conversations')
                .select('*, contacts(*), agents(id, name, workspace_id, status)')
                .eq('id', newMsg.conversation_id)
                .maybeSingle()
                .then(({ data: fullConv }) => {
                  if (fullConv) {
                    setConversations((current) => {
                      if (current.some((c) => c.id === fullConv.id)) return current;
                      return [
                        {
                          ...fullConv,
                          unread_count: isCurrentActive ? 0 : isContactMsg ? 1 : 0,
                          last_message_at: newMsg.created_at,
                        },
                        ...current,
                      ];
                    });
                  }
                });
              return prev;
            }

            const updatedConv = {
              ...target,
              last_message_at: newMsg.created_at,
              unread_count: isCurrentActive
                ? 0
                : (target.unread_count || 0) + (isContactMsg ? 1 : 0),
            };

            return [updatedConv, ...prev.filter((c) => c.id !== target.id)];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(globalMsgChannel);
    };
  }, [supabase]);

  const handleLoadOlderMessages = async () => {
    if (!selectedConvId || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].created_at;
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConvId)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);

      const rows = data || [];
      setHasOlderMessages(rows.length > PAGE_SIZE);
      const olderOrdered = rows.slice(0, PAGE_SIZE).reverse();
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const uniqueOlder = olderOrdered.filter((m: any) => !seen.has(m.id));
        return [...uniqueOlder, ...prev];
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleChangeControlMode = async (newMode: 'ai_active' | 'human_takeover' | 'paused') => {
    if (!selectedConvId) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConvId ? { ...c, control_mode: newMode } : c))
    );
    await fetch('/api/conversations/mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selectedConvId, controlMode: newMode }),
    });
  };

  const handleSaveNotes = async () => {
    if (!selectedConvId) return;
    setSavingNotes(true);
    try {
      const res = await fetch('/api/conversations/mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, internalNotes }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConvId ? { ...c, internal_notes: internalNotes } : c))
        );
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !newMemKey.trim() || !newMemValue.trim()) return;
    const targetId =
      newMemScope === 'contact' ? selectedConversation.contact_id : selectedConversation.id;
    if (!targetId) return;

    setSavingMemory(true);
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: newMemScope,
          targetId,
          key: newMemKey.trim(),
          value: newMemValue.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.memory) {
        if (newMemScope === 'contact') {
          setContactMemories((prev) => [
            data.memory,
            ...prev.filter((m) => m.id !== data.memory.id),
          ]);
        } else {
          setConversationMemories((prev) => [
            data.memory,
            ...prev.filter((m) => m.id !== data.memory.id),
          ]);
        }
        setNewMemKey('');
        setNewMemValue('');
      }
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (scope: 'contact' | 'conversation', id: string) => {
    const res = await fetch('/api/memories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, id }),
    });
    if (res.ok) {
      if (scope === 'contact') {
        setContactMemories((prev) => prev.filter((m) => m.id !== id));
      } else {
        setConversationMemories((prev) => prev.filter((m) => m.id !== id));
      }
    }
  };

  const handleSendManualReply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = replyText.trim();
    if (!content || !selectedConversation || sendingReply) return;

    const draft = content;
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_type: 'operator',
      direction: 'outbound',
      content: draft,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setReplyText('');
    setSendingReply(true);
    setSendError(null);
    setMessages((prev) => [...prev, optimisticMessage]);
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    try {
      const res = await fetch('/api/conversations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: draft,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'envoi du message");
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                control_mode: 'human_takeover',
                last_message_at: new Date().toISOString(),
              }
            : c
        )
      );

      if (data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      }

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (err: any) {
      setSendError(err.message);
      // Remove optimistic message and restore draft text
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setReplyText(draft);
    } finally {
      setSendingReply(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesMode = modeFilter === 'all' || conv.control_mode === modeFilter;
    if (!matchesMode) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const contactName = (conv.contacts?.display_name || conv.contacts?.push_name || '').toLowerCase();
    const phone = (conv.contacts?.phone_number || '').toLowerCase();
    const agentName = (conv.agents?.name || '').toLowerCase();
    return contactName.includes(q) || phone.includes(q) || agentName.includes(q);
  });

  const formatDoualaTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Douala',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (conv: any) => {
    const label = conv.contacts?.display_name || conv.contacts?.push_name || conv.contacts?.phone_number || 'C';
    return String(label).trim().slice(0, 2).toUpperCase();
  };

  const inspectorPanel = selectedConversation && (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Détails & Mémoire
        </span>
        <button
          type="button"
          onClick={() => {
            setShowInspector(false);
            setMobileInspectorOpen(false);
          }}
          className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5 text-xs">
        {/* Contact Identity */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
              {getInitials(selectedConversation)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 truncate">
                {selectedConversation.contacts?.display_name ||
                  selectedConversation.contacts?.push_name ||
                  'Contact WhatsApp'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {selectedConversation.contacts?.phone_number}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Agent assigné :</span>
            <span className="font-semibold text-slate-800">{selectedConversation.agents?.name}</span>
          </div>
          {planSlug === 'free' && maxRepliesPerConv !== null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Réponses IA aujourd'hui :</span>
              <span
                className={`font-bold ${
                  (replyCounts[selectedConversation.id] || 0) >= maxRepliesPerConv
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}
              >
                {replyCounts[selectedConversation.id] || 0} / {maxRepliesPerConv}
              </span>
            </div>
          )}
          {selectedConversation.preferred_language && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Langue détectée :</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold uppercase text-blue-700">
                {selectedConversation.preferred_language}
              </span>
            </div>
          )}
        </div>

        {/* Clarification Context */}
        {selectedConversation.clarification_state && (
          <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 space-y-2 text-[11px]">
            <div className="font-bold text-amber-900 flex items-center justify-between">
              <span>Contexte & Clarifications</span>
              {selectedConversation.clarification_state.awaitingConfirmation && (
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  Confirmation attendue
                </span>
              )}
            </div>
            {Array.isArray(selectedConversation.clarification_state.validatedFacts) &&
              selectedConversation.clarification_state.validatedFacts.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-600 mb-1">Éléments validés :</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedConversation.clarification_state.validatedFacts.map((f: string) => (
                      <span
                        key={f}
                        className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 text-slate-700"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {Array.isArray(selectedConversation.clarification_state.ambiguousPoints) &&
              selectedConversation.clarification_state.ambiguousPoints.length > 0 && (
                <div className="text-amber-800">
                  <span className="font-semibold">À préciser : </span>
                  {selectedConversation.clarification_state.ambiguousPoints.join(', ')}
                </div>
              )}
          </div>
        )}

        {/* Internal Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800">Notes internes équipe</label>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              <span>Sauver</span>
            </button>
          </div>
          <AutoGrowTextarea
            minHeight={64}
            maxHeight={160}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Notes privées (jamais envoyées au client WhatsApp)..."
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-amber-50/40"
          />
        </div>

        {/* Add Memory */}
        <form onSubmit={handleAddMemory} className="space-y-2 pt-2 border-t border-slate-100">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-600" />
            <span>Ajouter une mémoire</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setNewMemScope('contact')}
              className={`rounded-lg py-1 text-[11px] font-semibold border cursor-pointer ${
                newMemScope === 'contact'
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              Contact durable
            </button>
            <button
              type="button"
              onClick={() => setNewMemScope('conversation')}
              className={`rounded-lg py-1 text-[11px] font-semibold border cursor-pointer ${
                newMemScope === 'conversation'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              Conversation
            </button>
          </div>
          <input
            type="text"
            placeholder="Clé (ex: ville, budget)"
            value={newMemKey}
            onChange={(e) => setNewMemKey(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
          />
          <input
            type="text"
            placeholder="Valeur (ex: Douala)"
            value={newMemValue}
            onChange={(e) => setNewMemValue(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={savingMemory || !newMemKey.trim() || !newMemValue.trim()}
            className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Enregistrer
          </button>
        </form>

        {/* Contact Memories */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Mémoire durable contact ({contactMemories.length})
          </div>
          {contactMemories.length === 0 ? (
            <p className="text-[11px] text-slate-400">Aucune information mémorisée.</p>
          ) : (
            contactMemories.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200/70 p-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{m.key}</div>
                  <div className="text-slate-600 break-words">{m.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory('contact', m.id)}
                  className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Conversation Memories */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Contexte conversation ({conversationMemories.length})
          </div>
          {conversationMemories.length === 0 ? (
            <p className="text-[11px] text-slate-400">Aucun élément de fil enregistré.</p>
          ) : (
            conversationMemories.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-blue-50/60 border border-blue-100 p-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-blue-900 truncate">{m.key}</div>
                  <div className="text-blue-800 break-words">{m.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory('conversation', m.id)}
                  className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex overflow-hidden bg-white">
      {/* LEFT PANE: Conversations List */}
      <section
        className={`${
          showMobileThread ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-80 shrink-0 flex-col border-r border-slate-200 bg-white min-h-0`}
      >
        <div className="p-3.5 border-b border-slate-100 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-slate-900">Inbox WhatsApp</h1>
            {planSlug === 'free' && maxNewConvs !== null && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {usedNewConvs}/{maxNewConvs} conv/j
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher contact ou numéro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto studio-scroll py-0.5 shrink-0">
            {(
              [
                { id: 'all', label: 'Toutes' },
                { id: 'ai_active', label: 'IA' },
                { id: 'human_takeover', label: 'Humain' },
                { id: 'paused', label: 'Pause' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setModeFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer shrink-0 whitespace-nowrap min-w-max transition-colors ${
                  modeFilter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Aucune conversation ne correspond à vos filtres.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const todayReplies = replyCounts[conv.id] || 0;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    setShowMobileThread(true);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-zinc-100 border-l-2 border-l-zinc-900' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-700 font-medium text-xs flex items-center justify-center shrink-0">
                    {getInitials(conv)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-900 truncate">
                        {conv.contacts?.display_name ||
                          conv.contacts?.push_name ||
                          conv.contacts?.phone_number ||
                          'Inconnu'}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-zinc-400 shrink-0">
                        {formatDoualaTime(conv.last_message_at || conv.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-500 truncate">
                        {conv.agents?.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {conv.unread_count > 0 && (
                          <span className="rounded bg-zinc-900 px-1.5 py-0.2 text-[10px] font-mono tabular-nums text-white">
                            {conv.unread_count}
                          </span>
                        )}
                        {planSlug === 'free' && maxRepliesPerConv !== null && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-mono tabular-nums text-zinc-600">
                            {todayReplies}/{maxRepliesPerConv}
                          </span>
                        )}
                        <span
                          className={`h-2 w-2 rounded-full ${
                            conv.control_mode === 'human_takeover'
                              ? 'bg-amber-500'
                              : conv.control_mode === 'paused'
                              ? 'bg-zinc-400'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* CENTER PANE: Active Thread */}
      <section
        className={`${
          showMobileThread ? 'flex' : 'hidden md:flex'
        } flex-1 min-w-0 min-h-0 flex-col bg-[#efeae2]/35`}
      >
        {selectedConversation ? (
          <>
            {/* Fixed Thread Header */}
            <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMobileThread(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                  aria-label="Retour aux conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="h-9 w-9 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {getInitials(selectedConversation)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {selectedConversation.contacts?.display_name ||
                      selectedConversation.contacts?.push_name ||
                      selectedConversation.contacts?.phone_number}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {selectedConversation.contacts?.phone_number} • {selectedConversation.agents?.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedConversation.control_mode === 'ai_active' ? (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('human_takeover')}
                    title="Reprendre la main (Human Takeover)"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 sm:px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer shrink-0 transition-colors"
                  >
                    <PauseCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xl:inline whitespace-nowrap">Reprendre la main</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('ai_active')}
                    title="Réactiver l’IA"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 sm:px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer shrink-0 transition-colors"
                  >
                    <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xl:inline whitespace-nowrap">Réactiver l’IA</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setMobileInspectorOpen(true);
                    } else {
                      setShowInspector((v) => !v);
                    }
                  }}
                  title={
                    showInspector
                      ? 'Masquer le volet Détails & Mémoire'
                      : 'Afficher le volet Détails & Mémoire'
                  }
                  className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                    showInspector
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <PanelRight className="h-4 w-4 shrink-0" />
                </button>
              </div>
            </header>

            {/* Independent Scrollable Message History */}
            <div className="flex-1 min-h-0 overflow-y-auto studio-scroll px-4 py-4 space-y-3">
              {hasOlderMessages && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlder}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    {loadingOlder ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                    <span>Charger les messages précédents</span>
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-xs text-slate-400">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <span>Aucun message enregistré sur cette conversation.</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isClient = msg.sender_type === 'contact';
                  const isAi = msg.sender_type === 'agent' || msg.sender_type === 'ai';
                  const isHuman = msg.sender_type === 'human';
                  const isAudio = msg.message_type === 'audio' || Boolean(msg.voice_metadata);
                  const vm = msg.voice_metadata || null;

                  const comprehensionBadge =
                    vm?.blockedReason === 'free_plan'
                      ? { label: 'Plan Free • Vocal non transcrit', cls: 'bg-slate-100 text-slate-600' }
                      : vm?.comprehensionStatus === 'sufficient'
                      ? { label: 'Compréhension claire', cls: 'bg-emerald-50 text-emerald-700' }
                      : vm?.comprehensionStatus === 'partial'
                      ? { label: 'Clarification demandée', cls: 'bg-amber-50 text-amber-800' }
                      : vm?.comprehensionStatus === 'insufficient'
                      ? { label: 'Audio à préciser', cls: 'bg-red-50 text-red-700' }
                      : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[72%] rounded-xl px-3 py-2 text-xs shadow-2xs ${
                          isClient
                            ? 'bg-white text-zinc-900 border border-zinc-200/80 rounded-tl-xs'
                            : isAi
                            ? 'bg-[#d9fdd3] text-zinc-900 border border-emerald-200/60 rounded-tr-xs'
                            : 'bg-zinc-900 text-white rounded-tr-xs'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 text-[10px] font-medium mb-1 ${
                            isClient ? 'text-zinc-500' : isAi ? 'text-emerald-800' : 'text-zinc-400'
                          }`}
                        >
                          {isAi && <Bot className="h-3 w-3" />}
                          {isHuman && <User className="h-3 w-3" />}
                          {isAudio && <Mic className="h-3 w-3 text-emerald-600" />}
                          <span>
                            {isClient
                              ? isAudio
                                ? 'Client WhatsApp • Message vocal'
                                : 'Client WhatsApp'
                              : isAi
                              ? 'Agent IA'
                              : 'Opérateur Humain'}
                          </span>
                          {isAudio && vm?.durationSeconds ? (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[9px] font-mono tabular-nums text-zinc-600">
                              {Math.round(Number(vm.durationSeconds))}s
                            </span>
                          ) : null}
                          {isAudio && vm?.detectedLanguage && vm.detectedLanguage !== 'unknown' ? (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[9px] font-mono uppercase text-zinc-700">
                              {vm.detectedLanguage}
                            </span>
                          ) : null}
                        </div>

                        {isAudio && comprehensionBadge && (
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${comprehensionBadge.cls}`}
                            >
                              {comprehensionBadge.label}
                            </span>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>

                        {isAudio && Array.isArray(vm?.extractedFacts) && vm.extractedFacts.length > 0 && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                            {vm.extractedFacts.map((fact: string) => (
                              <span
                                key={fact}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                              >
                                {fact}
                              </span>
                            ))}
                          </div>
                        )}

                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            isClient ? 'text-slate-400' : 'text-white/70'
                          }`}
                        >
                          <span>{formatDoualaTime(msg.created_at)}</span>
                          {!isClient && <CheckCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed Bottom Composer */}
            <form
              onSubmit={handleSendManualReply}
              className="shrink-0 bg-white border-t border-slate-200 p-3 space-y-2"
            >
              {sendError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{sendError}</span>
                </div>
              )}

              <div className="flex items-end gap-2">
                <AutoGrowTextarea
                  minHeight={42}
                  maxHeight={160}
                  submitOnEnter={enterToSend}
                  onEnterSubmit={() => handleSendManualReply()}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Écrire une réponse manuelle..."
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  title="Envoyer"
                >
                  {sendingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-[10px] text-slate-500 px-1">
                <span className="truncate min-w-0">
                  Répondre coupe l’IA automatiquement sur ce fil (Human Takeover).
                </span>
                <button
                  type="button"
                  onClick={toggleEnterToSend}
                  title={
                    enterToSend
                      ? 'Touche Entrée = Envoyer • Shift+Entrée = Saut de ligne'
                      : 'Bouton = Envoyer • Entrée = Saut de ligne'
                  }
                  className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-blue-600 cursor-pointer shrink-0 min-w-max ml-auto text-[10px]"
                >
                  <CornerDownLeft className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">
                    {enterToSend
                      ? 'Entrée = Envoyer • Shift+Entrée = Ligne'
                      : 'Bouton = Envoyer • Entrée = Ligne'}
                  </span>
                  <span className="sm:hidden">
                    {enterToSend ? 'Entrée = Envoyer' : 'Bouton = Envoyer'}
                  </span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <MessageSquare className="h-12 w-12 opacity-20 mb-3" />
            <div className="text-sm font-semibold text-slate-600">
              Sélectionnez une conversation WhatsApp
            </div>
            <p className="text-xs mt-1">
              Suivez vos échanges en direct et reprenez la main à tout moment.
            </p>
          </div>
        )}
      </section>

      {/* RIGHT PANE: Collapsible Inspector */}
      {showInspector && selectedConversation && (
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-l border-slate-200 min-h-0 bg-white transition-all duration-200 ease-in-out overflow-hidden">
          {inspectorPanel}
        </aside>
      )}

      {mobileInspectorOpen && selectedConversation && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-80 max-w-full h-full bg-white shadow-xl animate-fade-in-up">{inspectorPanel}</div>
        </div>
      )}
    </div>
  );
}
