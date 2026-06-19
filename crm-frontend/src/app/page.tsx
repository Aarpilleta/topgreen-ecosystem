'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  Users, 
  DollarSign, 
  AlertCircle, 
  Plus, 
  ArrowRight,
  TrendingUp,
  Clock,
  UserPlus
} from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import CalendarView from '../components/CalendarView';

interface Chat {
  chat_id_whatsapp: string;
  nombre_cliente: string;
  bot_activo: boolean;
  zona_geografica: string;
  ultimo_mensaje?: string;
  ultimo_mensaje_fecha?: string;
}

interface Cita {
  id: number;
  cliente_id: string;
  nombre_cliente: string;
  estilista_id: number;
  estilista_nombre: string;
  servicio_id: number;
  servicio_nombre: string;
  precio_fijo: string | number;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  estado: 'pendiente' | 'anticipo_pendiente' | 'confirmada' | 'cancelada';
  link_comprobante?: string;
}

interface Estilista {
  id: number;
  nombre: string;
  especialidades: string[];
  activo: boolean;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'chats' | 'calendar'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [estilistas, setEstilistas] = useState<Estilista[]>([]);
  const [loading, setLoading] = useState(true);

  const [waStatus, setWaStatus] = useState<'connecting' | 'qr' | 'connected'>('connecting');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);

  // New mock client state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');

  // Simulator state (to test sending messages from user's WhatsApp)
  const [simMessage, setSimMessage] = useState('');
  const [simulating, setSimulating] = useState(false);

  // Fetch all necessary data
  const fetchData = async () => {
    try {
      const [chatsRes, citasRes, estilistasRes, statusRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chats`),
        fetch(`${BACKEND_URL}/api/citas`),
        fetch(`${BACKEND_URL}/api/estilistas`),
        fetch(`${BACKEND_URL}/api/whatsapp/status`)
      ]);

      if (chatsRes.ok) {
        const chatsData = await chatsRes.json();
        setChats(chatsData);
        // Sync selected chat details
        if (selectedChat) {
          const updated = chatsData.find((c: Chat) => c.chat_id_whatsapp === selectedChat.chat_id_whatsapp);
          if (updated) setSelectedChat(updated);
        }
      }

      if (citasRes.ok) setCitas(await citasRes.json());
      if (estilistasRes.ok) setEstilistas(await estilistasRes.json());
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setWaStatus(statusData.status);
        if (statusData.status === 'qr') {
          const qrRes = await fetch(`${BACKEND_URL}/api/whatsapp/qr`);
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            setWaQr(qrData.qr);
          }
        } else {
          setWaQr(null);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWa = async () => {
    if (!confirm('¿Estás seguro de que deseas desconectar la vinculación de WhatsApp?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/disconnect`, { method: 'POST' });
      if (res.ok) {
        setWaStatus('connecting');
        setWaQr(null);
      }
    } catch (err) {
      console.error('Error disconnecting WhatsApp:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll data every 4 seconds to sync status changes and new bookings
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Toggle bot_activo status
  const handleBotToggle = async (chatId: string, newStatus: boolean) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chats/${chatId}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_activo: newStatus })
      });
      if (res.ok) {
        const updatedChat = await res.json();
        setChats(prev => prev.map(c => c.chat_id_whatsapp === chatId ? { ...c, bot_activo: updatedChat.bot_activo } : c));
        if (selectedChat?.chat_id_whatsapp === chatId) {
          setSelectedChat(prev => prev ? { ...prev, bot_activo: updatedChat.bot_activo } : null);
        }
      }
    } catch (err) {
      console.error('Error toggling bot status:', err);
    }
  };

  // Update appointment status
  const handleUpdateCita = async (citaId: number, updateData: { estado?: string; link_comprobante?: string }) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/citas/${citaId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (res.ok) {
        fetchData(); // reload appointments
      }
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  // Create mock client/chat
  const handleCreateMockClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientPhone || !newClientName) return;

    try {
      // Simulate receiving a message from this number to register it
      const res = await fetch(`${BACKEND_URL}/webhook/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: newClientPhone,
          message: 'Hola, buenas tardes',
          clienteNombre: newClientName
        })
      });

      if (res.ok) {
        setNewClientPhone('');
        setNewClientName('');
        setShowNewClientModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Error creating mock client:', err);
    }
  };

  // Send message as Client (WhatsApp Simulator)
  const handleSimulateClientMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !simMessage.trim() || simulating) return;

    setSimulating(true);
    const textToSend = simMessage;
    setSimMessage('');

    try {
      await fetch(`${BACKEND_URL}/webhook/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.chat_id_whatsapp,
          message: textToSend
        })
      });
      fetchData();
    } catch (err) {
      console.error('Error simulating client message:', err);
    } finally {
      setSimulating(false);
    }
  };

  // Analytics Metrics
  const activeChatsCount = chats.length;
  const confirmedCitas = citas.filter(c => c.estado === 'confirmada');
  const pendingCitas = citas.filter(c => c.estado === 'anticipo_pendiente');
  const revenue = confirmedCitas.reduce((acc, c) => acc + Number(c.precio_fijo), 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Premium Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              TOP GREEN
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Ecosistema Premium Automático</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'chats'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-250'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Consola de Chats</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-250'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendario Estilistas</span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          {waStatus === 'connected' ? (
            <button
              onClick={handleDisconnectWa}
              className="bg-emerald-950/40 hover:bg-red-950/20 text-emerald-400 hover:text-red-400 border border-emerald-500/20 hover:border-red-500/30 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Desconectar WhatsApp"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>WhatsApp Conectado</span>
            </button>
          ) : (
            <button
              onClick={() => setShowWaModal(true)}
              className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Vincular WhatsApp</span>
            </button>
          )}

          <button
            onClick={() => setShowNewClientModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-700/20 flex items-center space-x-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Chat Simulador</span>
          </button>
        </div>
      </header>

      {/* Stats Board */}
      <section className="grid grid-cols-4 gap-4 px-6 pt-6 pb-2 shrink-0">
        
        {/* Stat 1 */}
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Clientes Totales</span>
            <h3 className="text-2xl font-black text-zinc-100 mt-1">{activeChatsCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Citas Confirmadas</span>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">{confirmedCitas.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pendientes de Anticipo</span>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{pendingCitas.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Ingresos Confirmados</span>
            <h3 className="text-2xl font-black text-teal-300 mt-1">
              {revenue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 min-h-0 flex gap-6 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4"></div>
            <p className="text-sm font-semibold">Cargando ecosistema TOP GREEN...</p>
          </div>
        ) : activeTab === 'chats' ? (
          
          /* CHATS TAB */
          <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
            
            {/* Chats List Sidebar (Left) */}
            <div className="w-80 bg-zinc-900/30 border border-zinc-850 rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-300">Chats Recientes</h2>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 font-bold px-2 py-0.5 rounded-full">
                  {chats.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
                {chats.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    No hay chats registrados. Crea uno con el botón superior.
                  </div>
                ) : (
                  chats.map((chat) => {
                    const isSelected = selectedChat?.chat_id_whatsapp === chat.chat_id_whatsapp;
                    return (
                      <button
                        key={chat.chat_id_whatsapp}
                        onClick={() => setSelectedChat(chat)}
                        className={`w-full text-left p-4 transition-all flex items-start space-x-3 ${
                          isSelected
                            ? 'bg-zinc-850/80 border-l-4 border-emerald-500'
                            : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 shrink-0">
                          {chat.nombre_cliente.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-zinc-200 truncate">{chat.nombre_cliente}</span>
                            <span className={`w-2 h-2 rounded-full ${chat.bot_activo ? 'bg-emerald-500' : 'bg-purple-500'}`} title={chat.bot_activo ? 'Bot Elena Activo' : 'Soporte Humano'}></span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{chat.chat_id_whatsapp}</p>
                          <p className="text-xs text-zinc-500 mt-1 truncate italic">
                            {chat.ultimo_mensaje || 'Sin mensajes'}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat Conversation View (Center) */}
            <div className="flex-1 min-h-0">
              <ChatWindow 
                activeChat={selectedChat} 
                onBotToggle={handleBotToggle} 
                backendUrl={BACKEND_URL} 
              />
            </div>

            {/* WhatsApp Simulator Panel (Right) */}
            {selectedChat && (
              <div className="w-80 bg-zinc-900/30 border border-zinc-850 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 border-b border-zinc-800 pb-3">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-zinc-200">Simulador Cliente WhatsApp</h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                    Usa este panel para simular que <strong>{selectedChat.nombre_cliente}</strong> envía un mensaje por WhatsApp. Si la IA de Elena está activa, procesará sus herramientas en tiempo real y responderá.
                  </p>

                  <form onSubmit={handleSimulateClientMessage} className="space-y-3">
                    <textarea
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      placeholder="Escribe como si fueras el cliente..."
                      rows={4}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!simMessage.trim() || simulating}
                      className="w-full bg-zinc-800 border border-zinc-700 hover:bg-emerald-600 hover:border-emerald-500 hover:text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center space-x-1"
                    >
                      {simulating ? 'Enviando y Procesando...' : 'Enviar como Cliente'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                <div className="border-t border-zinc-850 pt-4 text-[10px] text-zinc-500 space-y-1">
                  <p><strong>CPs/Zonas Cobertura:</strong> Satélite (53100), Mundo E (54054), Zona Esmeralda, Lomas Verdes, Naucalpan, Tlalnepantla, Polanco (11560), Condesa, Roma, Lomas, Del Valle, Santa Fe.</p>
                  <p><strong>Servicios:</strong> Nanoplastia ($3000), Depilación IPL ($3200), Nanopore ($1500), Botox Capilar ($850), Corte ($400).</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          
          /* CALENDAR TAB */
          <div className="flex-1 min-h-0">
            <CalendarView 
              citas={citas} 
              estilistas={estilistas} 
              onUpdateCita={handleUpdateCita} 
              onRefresh={fetchData} 
            />
          </div>
        )}
      </main>

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Crear Cliente Simulador</span>
              </h3>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMockClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 block font-semibold">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sofia Varela"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 block font-semibold">Número de Teléfono (WhatsApp ID)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 5215599887766"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-700/20"
              >
                Registrar y Simular Entrada
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp QR Modal */}
      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Vincular WhatsApp</span>
              </h3>
              <button
                onClick={() => setShowWaModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4 py-2">
              {waStatus === 'connecting' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-xs text-zinc-400 font-medium">Generando código de vinculación...</p>
                </div>
              )}

              {waStatus === 'qr' && waQr && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="bg-white p-3 rounded-2xl border border-zinc-800 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={waQr} alt="WhatsApp QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-xs text-zinc-300 text-center font-medium">
                    Escanea este código QR desde la app móvil de WhatsApp (Dispositivos vinculados) para iniciar sesión.
                  </p>
                </div>
              )}

              {waStatus === 'connected' && (
                <div className="flex flex-col items-center py-6 space-y-3 text-center">
                  <div className="w-12 h-12 bg-emerald-950/60 border border-emerald-500/30 rounded-full flex items-center justify-center">
                    <span className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400">¡Conexión Exitosa!</h4>
                    <p className="text-xs text-zinc-400 mt-1">El chatbot está listo para procesar mensajes en vivo.</p>
                  </div>
                  <button
                    onClick={() => {
                      handleDisconnectWa();
                      setShowWaModal(false);
                    }}
                    className="mt-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Desconectar Cuenta
                  </button>
                </div>
              )}
            </div>

            <div className="text-[10px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
              <p>Nota: Este método mantiene activa tu aplicación móvil y tu historial de chats actual intacto.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

