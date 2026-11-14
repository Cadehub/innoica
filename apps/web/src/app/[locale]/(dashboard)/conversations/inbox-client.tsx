'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  MessageSquare,
  Search,
  Bot,
  User,
  ShieldAlert,
  Send,
  Loader2,
  CheckCheck,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';

export function InboxClient({ initialConversations }: { initialConversations: any[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  // Charger les messages de la conversation sélectionnée
  useEffect(() => {
    if (!selectedConvId) return;

    let isMounted = true;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConvId)
        .order('created_at', { ascending: true });

      if (isMounted) {
        setMessages(data || []);
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Écoute temps réel des nouveaux messages
    const channel = supabase
      .channel(`conv-${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedConvId]);

  // Bascule du mode de contrôle (Human Takeover vs AI Active)
  const handleChangeControlMode = async (newMode: 'ai_active' | 'human_takeover' | 'paused') => {
    if (!selectedConvId) return;

    // Mise à jour optimiste
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConvId ? { ...c, control_mode: newMode } : c))
    );

    await supabase
      .from('conversations')
      .update({ control_mode: newMode, updated_at: new Date().toISOString() })
      .eq('id', selectedConvId);
  };

  // Envoi d'une réponse manuelle humaine
  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    setSendingReply(true);
    const content = replyText.trim();
    setReplyText('');

    try {
      // 1. Passage automatique en mode Human Takeover dès intervention humaine
      if (selectedConversation.control_mode !== 'human_takeover') {
        await handleChangeControlMode('human_takeover');
      }

      // 2. Envoi réel sur WhatsApp via le WhatsApp Worker
      const workerUrl = process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL || 'http://localhost:4001';
      const toPhone = selectedConversation.contacts?.phone_number;

      const res = await fetch(`${workerUrl}/api/sessions/${selectedConversation.agent_id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone,
          text: content,
        }),
      });

      const data = await res.json();
      const waMsgId = data.messageId || null;

      // 3. Enregistrement en base avec sender_type = 'human'
      const { data: newMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConvId,
          wa_message_id: waMsgId,
          sender_type: 'human',
          content,
          delivery_status: 'sent',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      }
    } catch (err) {
      console.error('Erreur envoi réponse manuelle:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const phone = c.contacts?.phone_number || '';
    const name = c.contacts?.display_name || '';
    return (
      phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px]">
      {/* Colonne Gauche : Liste des Conversations */}
      <div className="md:col-span-4 border-r border-slate-200 flex flex-col justify-between bg-slate-50/40">
        <div>
          {/* Recherche */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un numéro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Liste */}
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[550px]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Aucune conversation trouvée.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const contact = conv.contacts;
                const isHumanMode = conv.control_mode === 'human_takeover';

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-600 font-bold text-xs">
                      {contact?.display_name ? contact.display_name[0].toUpperCase() : 'C'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {contact?.display_name || contact?.phone_number || 'Contact WhatsApp'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(conv.last_message_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {contact?.phone_number}
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        {isHumanMode ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Reprise Humaine
                          </span>
                        ) : conv.control_mode === 'paused' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            En Pause
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            IA Active
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Colonne Droite : Fil de Discussion & Contrôles */}
      <div className="md:col-span-8 flex flex-col justify-between bg-white h-full">
        {selectedConversation ? (
          <>
            {/* Header de la discussion avec boutons Human Takeover */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  {selectedConversation.contacts?.display_name
                    ? selectedConversation.contacts.display_name[0].toUpperCase()
                    : 'C'}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {selectedConversation.contacts?.display_name ||
                      selectedConversation.contacts?.phone_number}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {selectedConversation.contacts?.phone_number} • Agent:{' '}
                    <strong>{selectedConversation.agents?.name}</strong>
                  </div>
                </div>
              </div>

              {/* Boutons de contrôle Human Takeover */}
              <div className="flex items-center gap-2">
                {selectedConversation.control_mode === 'human_takeover' ? (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('ai_active')}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    <span>Réactiver l'IA</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('human_takeover')}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Reprendre la main (Couper l'IA)</span>
                  </button>
                )}

                {selectedConversation.control_mode === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('ai_active')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Reprendre"
                  >
                    <PlayCircle className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleChangeControlMode('paused')}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Mettre en pause"
                  >
                    <PauseCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Zone de Messages */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 max-h-[460px] bg-slate-50/50">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-12">
                  Aucun message échangé pour le moment.
                </div>
              ) : (
                messages.map((m) => {
                  const isContact = m.sender_type === 'contact';
                  const isHuman = m.sender_type === 'human';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isContact ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-slate-400 font-medium">
                        {isContact ? (
                          <>
                            <User className="h-3 w-3" />
                            <span>Client</span>
                          </>
                        ) : isHuman ? (
                          <>
                            <ShieldAlert className="h-3 w-3 text-purple-600" />
                            <span className="text-purple-600 font-bold">Opérateur Humain</span>
                          </>
                        ) : (
                          <>
                            <Bot className="h-3 w-3 text-blue-600" />
                            <span className="text-blue-600 font-bold">Agent IA</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                          isContact
                            ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                            : isHuman
                            ? 'bg-purple-600 text-white rounded-tr-none'
                            : 'bg-blue-600 text-white rounded-tr-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Zone de Saisie Manuelle */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {selectedConversation.control_mode === 'human_takeover' && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-purple-700 font-semibold bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Mode Contrôle Humain actif : l'IA ne répondra pas automatiquement.</span>
                </div>
              )}

              <form onSubmit={handleSendManualReply} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tapez un message pour répondre manuellement sur WhatsApp..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Envoyer</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <MessageSquare className="h-10 w-10 text-slate-200 mb-2" />
            <span className="text-xs">Sélectionnez une conversation pour afficher les messages.</span>
          </div>
        )}
      </div>
    </div>
  );
}
