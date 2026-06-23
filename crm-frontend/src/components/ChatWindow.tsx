'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, ShieldAlert, Loader2, Sparkles, MessageSquare } from 'lucide-react';

interface Message {
  id: number;
  remitente: 'bot' | 'cliente' | 'humano';
  texto: string;
  fecha_hora: string;
}

interface Chat {
  chat_id_whatsapp: string;
  nombre_cliente: string;
  bot_activo: boolean;
  zona_geografica: string;
}

interface ChatWindowProps {
  activeChat: Chat | null;
  onBotToggle: (chatId: string, active: boolean) => void;
  backendUrl: string;
}

export default function ChatWindow({ activeChat, onBotToggle, backendUrl }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages when activeChat changes
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/api/chats/${activeChat.chat_id_whatsapp}/messages`);
        if (!res.ok) throw new Error('Error al obtener mensajes');
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Set up polling for new messages every 3 seconds to make it real-time
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChat, backendUrl]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !newMessage.trim() || sending) return;

    const textToSend = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await fetch(`${backendUrl}/api/chats/${activeChat.chat_id_whatsapp}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      if (!res.ok) throw new Error('Error al enviar mensaje');
      const savedMsg = await res.json();
      setMessages((prev) => [...prev, savedMsg]);
    } catch (err) {
      console.error(err);
      alert('No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  // Helper to format date
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      return '';
    }
  };

  if (!activeChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 bg-zinc-950/20 backdrop-blur-md rounded-2xl border border-zinc-800/40 p-8">
        <MessageSquare className="w-16 h-16 mb-4 text-emerald-500/40 animate-pulse" />
        <p className="text-lg font-medium text-zinc-300">Selecciona un cliente</p>
        <p className="text-sm text-zinc-500 text-center max-w-xs mt-1">
          Elige un chat de la lista de la izquierda para ver el historial y tomar control manual.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-zinc-850 overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/60 bg-zinc-900/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-lg">
            {activeChat.nombre_cliente.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">{activeChat.nombre_cliente}</h3>
            <p className="text-xs text-zinc-400 flex items-center">
              <span>{activeChat.chat_id_whatsapp}</span>
              {activeChat.zona_geografica && (
                <>
                  <span className="mx-1.5">•</span>
                  <span className="text-emerald-400 font-medium">{activeChat.zona_geografica}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Bot Activation Toggle */}
        <div className="flex items-center space-x-3 bg-zinc-950/60 px-4 py-2 rounded-xl border border-zinc-800/60">
          <div className="flex items-center space-x-1.5">
            <Bot className={`w-4 h-4 ${activeChat.bot_activo ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-semibold text-zinc-300">Asistente IA (Elena)</span>
          </div>
          <button
            onClick={() => onBotToggle(activeChat.chat_id_whatsapp, !activeChat.bot_activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              activeChat.bot_activo ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                activeChat.bot_activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-gradient-to-b from-transparent to-zinc-950/20">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-xs text-zinc-400 mt-2">Cargando conversación...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <p className="text-sm">No hay mensajes anteriores.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isClient = msg.remitente === 'cliente';
            const isBot = msg.remitente === 'bot';
            const isHuman = msg.remitente === 'humano';

            return (
              <div
                key={msg.id || index}
                className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-md ${
                    isClient
                      ? 'bg-zinc-800/80 text-zinc-100 rounded-tl-none border border-zinc-700/50'
                      : isBot
                      ? 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/80 text-emerald-100 border border-emerald-800/60 rounded-tr-none'
                      : 'bg-gradient-to-br from-purple-950/80 to-purple-900/80 text-purple-100 border border-purple-800/60 rounded-tr-none'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    {isBot && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-1.5 py-0.5 rounded-md flex items-center space-x-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Elena IA</span>
                      </span>
                    )}
                    {isHuman && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 font-semibold px-1.5 py-0.5 rounded-md flex items-center space-x-0.5">
                        <User className="w-2.5 h-2.5" />
                        <span>Soporte</span>
                      </span>
                    )}
                    {isClient && (
                      <span className="text-[10px] text-zinc-400 font-semibold">
                        {activeChat.nombre_cliente}
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-400 font-normal">
                      {formatTime(msg.fecha_hora)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {msg.texto}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Warning if IA is processing */}
      {activeChat.bot_activo && (
        <div className="bg-emerald-950/20 border-t border-emerald-900/40 px-4 py-2 flex items-center space-x-2 text-xs text-emerald-400/95 font-medium">
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span>El Asistente de IA está activo. Responderá automáticamente a este cliente.</span>
        </div>
      )}

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 bg-zinc-900/80 border-t border-zinc-800/60 flex items-center space-x-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            activeChat.bot_activo
              ? "Desactiva la IA para responder manualmente..."
              : "Escribe un mensaje de soporte humano..."
          }
          className={`flex-1 bg-zinc-950 border text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 text-zinc-200 transition-all ${
            activeChat.bot_activo
              ? 'border-zinc-800/80 placeholder-zinc-600 focus:ring-zinc-700'
              : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500'
          }`}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            !newMessage.trim() || sending
              ? 'bg-zinc-850 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/20'
          }`}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
