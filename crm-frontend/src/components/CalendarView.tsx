'use client';

import React, { useState } from 'react';
import { Calendar, User, Clock, DollarSign, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';

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

interface CalendarViewProps {
  citas: Cita[];
  estilistas: Estilista[];
  onUpdateCita: (citaId: number, updateData: { estado?: string; link_comprobante?: string }) => void;
  onRefresh: () => void;
}

export default function CalendarView({ citas, estilistas, onUpdateCita, onRefresh }: CalendarViewProps) {
  // Select active date (defaults to today)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Selected appointment detail modal state
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Generate 7 days starting from today for the calendar bar
  const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('es-ES', { month: 'short' }),
    };
  });

  // Filter appointments for the selected date
  const activeAppointments = citas.filter((appt) => {
    if (!appt.fecha_hora_inicio) return false;
    const apptDate = appt.fecha_hora_inicio.split('T')[0];
    return apptDate === selectedDateStr && appt.estado !== 'cancelada';
  });

  // Working Hours (09:00 to 19:00)
  const hourHeight = 64; // px per hour
  const startHour = 9;
  const endHour = 19;
  const totalHours = endHour - startHour;
  const timeSlots = Array.from({ length: totalHours }).map((_, i) => startHour + i);

  // Calculate layout coordinates for absolute positioning
  const getPosition = (inicioStr: string, finStr: string) => {
    const inicio = new Date(inicioStr);
    const fin = new Date(finStr);

    const startMinutes = (inicio.getHours() - startHour) * 60 + inicio.getMinutes();
    const durationMinutes = (fin.getTime() - inicio.getTime()) / (60 * 1000);

    const top = (startMinutes * hourHeight) / 60;
    const height = (durationMinutes * hourHeight) / 60;

    return { top, height };
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'confirmada':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30';
      case 'anticipo_pendiente':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30';
      case 'cancelada':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/50 hover:bg-sky-500/30';
    }
  };

  const handleStatusChange = async (citaId: number, nuevoEstado: string) => {
    setUpdatingId(citaId);
    try {
      await onUpdateCita(citaId, { estado: nuevoEstado });
      // Update local detailed view
      if (selectedCita && selectedCita.id === citaId) {
        setSelectedCita({ ...selectedCita, estado: nuevoEstado as any });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveComprobante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCita || updatingId) return;

    setUpdatingId(selectedCita.id);
    try {
      await onUpdateCita(selectedCita.id, { 
        link_comprobante: comprobanteUrl,
        estado: 'confirmada' // Auto confirm once a receipt is attached
      });
      setSelectedCita({ 
        ...selectedCita, 
        link_comprobante: comprobanteUrl,
        estado: 'confirmada' 
      });
      setComprobanteUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-zinc-850 p-5 shadow-2xl overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-zinc-100">Agenda Inteligente de Estilistas</h2>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 7-Day Selector Strip */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {daysOfWeek.map((day) => {
          const isActive = day.dateStr === selectedDateStr;
          return (
            <button
              key={day.dateStr}
              onClick={() => setSelectedDateStr(day.dateStr)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                isActive
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-700/20 scale-[1.02]'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-250'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">{day.dayName}</span>
              <span className="text-lg font-bold my-0.5">{day.dayNum}</span>
              <span className="text-[9px] opacity-75">{day.monthName}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Timeline Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 relative border border-zinc-800/80 rounded-xl bg-zinc-950/20">
        
        {/* Stylist Columns Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[60px_1fr] border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md">
          <div className="p-2 border-r border-zinc-800 text-[10px] font-semibold text-zinc-500 text-center flex items-center justify-center">
            Hora
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${estilistas.length}, minmax(0, 1fr))` }}>
            {estilistas.map((estilista) => (
              <div
                key={estilista.id}
                className="p-2 text-center text-xs font-bold text-zinc-200 flex items-center justify-center space-x-1.5 border-r border-zinc-800 last:border-r-0"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>{estilista.nombre}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-[60px_1fr] relative" style={{ height: `${totalHours * hourHeight}px` }}>
          
          {/* Time Sidebar */}
          <div className="relative border-r border-zinc-850 h-full bg-zinc-900/20">
            {timeSlots.map((hour, idx) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2 text-[10px] font-semibold text-zinc-500"
                style={{ top: `${idx * hourHeight + 8}px` }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Grid Columns Area */}
          <div className="relative h-full grid" style={{ gridTemplateColumns: `repeat(${estilistas.length}, minmax(0, 1fr))` }}>
            
            {/* Grid Line Drawers */}
            {timeSlots.map((_, idx) => (
              <div
                key={idx}
                className="absolute w-full border-b border-zinc-900"
                style={{ top: `${idx * hourHeight}px`, height: `${hourHeight}px` }}
              />
            ))}

            {/* Stylists Lanes */}
            {estilistas.map((estilista, stylistIdx) => {
              // Get appointments for this stylist
              const stylistAppts = activeAppointments.filter((a) => a.estilista_id === estilista.id);

              return (
                <div
                  key={estilista.id}
                  className="relative h-full border-r border-zinc-850 last:border-r-0"
                >
                  {/* Render appointments */}
                  {stylistAppts.map((appt) => {
                    const coords = getPosition(appt.fecha_hora_inicio, appt.fecha_hora_fin);
                    const formattedPrice = Number(appt.precio_fijo).toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    });

                    return (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedCita(appt)}
                        style={{ top: `${coords.top}px`, height: `${coords.height}px` }}
                        className={`absolute left-1.5 right-1.5 p-2 rounded-lg border text-left cursor-pointer transition-all z-10 flex flex-col justify-between overflow-hidden ${getStatusColor(
                          appt.estado
                        )}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[70%]">
                              {appt.servicio_nombre}
                            </span>
                            <span className="text-[9px] opacity-75 font-semibold">
                              {formattedPrice}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium mt-0.5 truncate">{appt.nombre_cliente}</p>
                        </div>
                        <div className="flex items-center space-x-1 text-[9px] opacity-80 mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>
                            {new Date(appt.fecha_hora_inicio).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}{' '}
                            -{' '}
                            {new Date(appt.fecha_hora_fin).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Appointment Detail Modal */}
      {selectedCita && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  selectedCita.estado === 'confirmada' ? 'bg-emerald-950 text-emerald-400 border-emerald-900' :
                  selectedCita.estado === 'anticipo_pendiente' ? 'bg-amber-950 text-amber-400 border-amber-900' :
                  'bg-zinc-950 text-zinc-400 border-zinc-800'
                }`}>
                  {selectedCita.estado.toUpperCase().replace('_', ' ')}
                </span>
                <h3 className="text-lg font-bold text-zinc-100 mt-2">{selectedCita.servicio_nombre}</h3>
                <p className="text-xs text-zinc-400">ID de Cita: #{selectedCita.id}</p>
              </div>
              <button
                onClick={() => setSelectedCita(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Main Info */}
            <div className="grid grid-cols-2 gap-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850 text-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase">Cliente</span>
                <p className="text-zinc-200 font-medium">{selectedCita.nombre_cliente}</p>
                <p className="text-[10px] text-zinc-400">{selectedCita.cliente_id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase">Estilista</span>
                <p className="text-zinc-200 font-medium">{selectedCita.estilista_nombre}</p>
              </div>
              <div className="space-y-1 col-span-2 border-t border-zinc-850 pt-2 mt-1">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase">Horario</span>
                <p className="text-zinc-200 font-medium flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {new Date(selectedCita.fecha_hora_inicio).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </p>
                <p className="text-zinc-400 text-xs pl-5">
                  {new Date(selectedCita.fecha_hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' a '}
                  {new Date(selectedCita.fecha_hora_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Proof of Payment / Comprobante */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-zinc-400">Comprobante de Anticipo</h4>
              {selectedCita.link_comprobante ? (
                <div className="flex items-center justify-between bg-zinc-950/30 p-2.5 rounded-xl border border-zinc-850">
                  <span className="text-xs text-zinc-400 truncate max-w-[80%]">
                    {selectedCita.link_comprobante}
                  </span>
                  <a
                    href={selectedCita.link_comprobante}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center space-x-1 font-medium"
                  >
                    <span>Ver</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No se ha registrado comprobante de pago aún.</span>
                </p>
              )}
            </div>

            {/* Actions & Update Form */}
            <div className="space-y-3 pt-2">
              {selectedCita.estado === 'anticipo_pendiente' && (
                <form onSubmit={handleSaveComprobante} className="space-y-2">
                  <label className="text-xs text-zinc-300 block">Registrar Link de Comprobante para Confirmar:</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      required
                      placeholder="https://comprobante.com/img.png"
                      value={comprobanteUrl}
                      onChange={(e) => setComprobanteUrl(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={updatingId === selectedCita.id}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-all"
                    >
                      Registrar
                    </button>
                  </div>
                </form>
              )}

              {/* General state update buttons */}
              <div className="flex items-center justify-end space-x-2 border-t border-zinc-800/60 pt-4">
                {selectedCita.estado !== 'confirmada' && (
                  <button
                    onClick={() => handleStatusChange(selectedCita.id, 'confirmada')}
                    disabled={updatingId === selectedCita.id}
                    className="bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-800 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar</span>
                  </button>
                )}
                {selectedCita.estado !== 'cancelada' && (
                  <button
                    onClick={() => handleStatusChange(selectedCita.id, 'cancelada')}
                    disabled={updatingId === selectedCita.id}
                    className="bg-rose-950/60 text-rose-300 border border-rose-900/80 hover:bg-rose-800 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancelar</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCita(null)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
