'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, User, Clock, DollarSign, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw, Edit, PlusCircle, Check } from 'lucide-react';

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
  pago_tarjeta?: number;
  pago_efectivo?: number;
  descuento_especial?: boolean;
  insumo_tinte_tubos?: number;
  insumo_tinte_tapa_bella?: number;
  insumo_tinte_tapa_loreal?: number;
  insumo_tinte_precio_tubo?: number;
  insumo_tinte_precio_bella?: number;
  insumo_tinte_precio_loreal?: number;
  precio_cobrado?: number | null;
}

interface Estilista {
  id: number;
  nombre: string;
  especialidades: string[];
  activo: boolean;
  color?: string;
}

interface CalendarViewProps {
  citas: Cita[];
  estilistas: Estilista[];
  servicios?: any[];
  chats?: any[];
  onUpdateCita: (citaId: number, updateData: any) => Promise<void>;
  onRefresh: () => void;
}

export default function CalendarView({ citas, estilistas, servicios = [], chats = [], onUpdateCita, onRefresh }: CalendarViewProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editEstilista, setEditEstilista] = useState('');
  const [editServicio, setEditServicio] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editDuration, setEditDuration] = useState('1');

  // Checkout detailed state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutCita, setCheckoutCita] = useState<Cita | null>(null);
  const [pagoTarjeta, setPagoTarjeta] = useState('0');
  const [pagoEfectivo, setPagoEfectivo] = useState('0');
  const [descuentoEspecial, setDescuentoEspecial] = useState(false);
  const [precioCobrado, setPrecioCobrado] = useState('');
  const [insumoTubos, setInsumoTubos] = useState('0');
  const [insumoTapaBella, setInsumoTapaBella] = useState('0');
  const [insumoTapaLoreal, setInsumoTapaLoreal] = useState('0');
  const [precioTubo, setPrecioTubo] = useState('220');
  const [precioBella, setPrecioBella] = useState('50');
  const [precioLoreal, setPrecioLoreal] = useState('60');

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCustomer, setCreateCustomer] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createEstilista, setCreateEstilista] = useState('');
  const [createServicio, setCreateServicio] = useState('');
  const [createDate, setCreateDate] = useState(selectedDateStr);
  const [createHour, setCreateHour] = useState('11:00');
  const [createDuration, setCreateDuration] = useState('1');
  const [createCost, setCreateCost] = useState('0');

  // Autocomplete client search refs/state
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCreateDate(selectedDateStr);
  }, [selectedDateStr]);

  // Click outside autocomplete dropdown logic
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const activeAppointments = citas.filter((appt) => {
    if (!appt.fecha_hora_inicio) return false;
    const apptDate = appt.fecha_hora_inicio.split('T')[0];
    return apptDate === selectedDateStr && appt.estado !== 'cancelada';
  });

  const [y, m, d] = selectedDateStr.split('-').map(Number);
  const selectedDateObj = new Date(y, m - 1, d);
  const dayOfWeek = selectedDateObj.getDay();
  
  let startHour = (dayOfWeek === 5 || dayOfWeek === 6) ? 9 : 11;
  let endHour = 20;

  activeAppointments.forEach((appt) => {
    if (appt.fecha_hora_inicio) {
      const apptDate = new Date(appt.fecha_hora_inicio);
      const apptStartHour = apptDate.getHours();
      if (apptStartHour < startHour) startHour = apptStartHour;
    }
    if (appt.fecha_hora_fin) {
      const apptDate = new Date(appt.fecha_hora_fin);
      const apptEndHour = Math.ceil(apptDate.getHours() + apptDate.getMinutes() / 60);
      if (apptEndHour > endHour) endHour = apptEndHour;
    }
  });

  const hourHeight = 70; // px per hour
  const totalHours = endHour - startHour;
  const timeSlots = Array.from({ length: totalHours }).map((_, i) => startHour + i);

  const getStylistAppointmentsSorted = (stylistId: number) => {
    return activeAppointments
      .filter((a) => a.estilista_id === stylistId)
      .sort((a, b) => new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime());
  };

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
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30';
      case 'anticipo_pendiente':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
      case 'cancelada':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30';
    }
  };

  const handleStatusChange = async (citaId: number, nuevoEstado: string) => {
    setUpdatingId(citaId);
    try {
      await onUpdateCita(citaId, { estado: nuevoEstado });
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
        estado: 'confirmada'
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCita || updatingId) return;
    setUpdatingId(selectedCita.id);
    try {
      await onUpdateCita(selectedCita.id, {
        stylist: editEstilista,
        service: editServicio,
        date: editDate,
        hour: editHour,
        duration: editDuration
      });
      setIsEditing(false);
      setSelectedCita(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutCita || updatingId) return;
    setUpdatingId(checkoutCita.id);
    try {
      await onUpdateCita(checkoutCita.id, {
        estado: 'confirmada',
        pago_tarjeta: Number(pagoTarjeta),
        pago_efectivo: Number(pagoEfectivo),
        descuento_especial: descuentoEspecial,
        insumo_tinte_tubos: Number(insumoTubos),
        insumo_tinte_tapa_bella: Number(insumoTapaBella),
        insumo_tinte_tapa_loreal: Number(insumoTapaLoreal),
        insumo_tinte_precio_tubo: Number(precioTubo),
        insumo_tinte_precio_bella: Number(precioBella),
        insumo_tinte_precio_loreal: Number(precioLoreal),
        precio_cobrado: precioCobrado.trim() !== '' ? Number(precioCobrado) : null
      });
      setShowCheckoutModal(false);
      setCheckoutCita(null);
      setSelectedCita(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCustomer || !createServicio || !createEstilista) return;

    try {
      const res = await fetch('http://localhost:5000/api/citas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: createCustomer,
          phone: createPhone,
          stylist: createEstilista,
          service: createServicio,
          date: createDate,
          hour: createHour,
          duration: createDuration,
          cost: createCost,
          status: 'Pendiente'
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setCreateCustomer('');
        setCreatePhone('');
        setClientSearch('');
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditMode = () => {
    if (!selectedCita) return;
    setEditEstilista(selectedCita.estilista_nombre);
    setEditServicio(selectedCita.servicio_nombre);
    
    const localStart = new Date(selectedCita.fecha_hora_inicio);
    const year = localStart.getFullYear();
    const month = String(localStart.getMonth() + 1).padStart(2, '0');
    const day = String(localStart.getDate()).padStart(2, '0');
    setEditDate(`${year}-${month}-${day}`);
    
    const hour = String(localStart.getHours()).padStart(2, '0');
    const minutes = String(localStart.getMinutes()).padStart(2, '0');
    setEditHour(`${hour}:${minutes}`);
    
    const start = new Date(selectedCita.fecha_hora_inicio);
    const end = new Date(selectedCita.fecha_hora_fin);
    const diffHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    setEditDuration(String(diffHours));
    
    setIsEditing(true);
  };

  const openCheckoutMode = (cita: Cita) => {
    setCheckoutCita(cita);
    setPagoTarjeta('0');
    setPagoEfectivo(String(cita.precio_fijo));
    setDescuentoEspecial(!!cita.descuento_especial);
    setPrecioCobrado(String(cita.precio_cobrado || cita.precio_fijo));
    setInsumoTubos(String(cita.insumo_tinte_tubos || '0'));
    setInsumoTapaBella(String(cita.insumo_tinte_tapa_bella || '0'));
    setInsumoTapaLoreal(String(cita.insumo_tinte_tapa_loreal || '0'));
    setPrecioTubo(String(cita.insumo_tinte_precio_tubo || '220'));
    setPrecioBella(String(cita.insumo_tinte_precio_bella || '50'));
    setPrecioLoreal(String(cita.insumo_tinte_precio_loreal || '60'));
    setShowCheckoutModal(true);
  };

  const handleClientSearchChange = (val: string) => {
    setClientSearch(val);
    setCreateCustomer(val);
    if (val.trim() === '') {
      setFilteredClients([]);
      setShowDropdown(false);
    } else {
      const match = chats.filter(c => 
        c.nombre_cliente.toLowerCase().includes(val.toLowerCase()) || 
        c.chat_id_whatsapp.includes(val)
      );
      setFilteredClients(match.slice(0, 5));
      setShowDropdown(true);
    }
  };

  const selectClient = (client: any) => {
    setCreateCustomer(client.nombre_cliente);
    setCreatePhone(client.chat_id_whatsapp);
    setClientSearch(client.nombre_cliente);
    setShowDropdown(false);
  };

  const isDyeService = (serviceName: string) => {
    const norm = serviceName.toLowerCase();
    return norm.includes('tinte') || norm.includes('balayage') || norm.includes('luces') || norm.includes('color') || norm.includes('decolor');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-zinc-850 p-5 shadow-2xl overflow-hidden font-sans">
      
      {/* Calendar Header & Actions */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-zinc-100">Recepción: Agenda de Estilistas</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-emerald-700/10 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Agendar Cita</span>
          </button>
          <button
            onClick={onRefresh}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 rounded-xl transition-all"
            title="Refrescar agenda"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7-Day Selector Strip */}
      <div className="grid grid-cols-7 gap-2 mb-4 shrink-0">
        {daysOfWeek.map((day) => {
          const isActive = day.dateStr === selectedDateStr;
          return (
            <button
              key={day.dateStr}
              onClick={() => setSelectedDateStr(day.dateStr)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                isActive
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-700/20 scale-[1.02]'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">{day.dayName}</span>
              <span className="text-base font-bold my-0.5">{day.dayNum}</span>
              <span className="text-[8px] opacity-75">{day.monthName}</span>
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: estilista.color || '#10b981' }}></div>
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
            {estilistas.map((estilista) => {
              const stylistAppts = getStylistAppointmentsSorted(estilista.id);

              return (
                <div
                  key={estilista.id}
                  className="relative h-full border-r border-zinc-850 last:border-r-0"
                >
                  {/* Render appointments */}
                  {stylistAppts.map((appt) => {
                    const coords = getPosition(appt.fecha_hora_inicio, appt.fecha_hora_fin);
                    const formattedPrice = Number(appt.precio_cobrado !== null && appt.precio_cobrado !== undefined ? appt.precio_cobrado : appt.precio_fijo).toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    });

                    const overlaps = stylistAppts.filter(other => 
                      other.id !== appt.id && 
                      ((new Date(appt.fecha_hora_inicio) < new Date(other.fecha_hora_fin) && new Date(appt.fecha_hora_fin) > new Date(other.fecha_hora_inicio)))
                    );
                    
                    let width = 'calc(100% - 12px)';
                    let left = '6px';
                    if (overlaps.length > 0) {
                      const totalColumns = overlaps.length + 1;
                      const selfIndex = stylistAppts.indexOf(appt) % totalColumns;
                      width = `calc(${100 / totalColumns}% - 8px)`;
                      left = `calc(${(100 / totalColumns) * selfIndex}% + 4px)`;
                    }

                    return (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedCita(appt)}
                        style={{ top: `${coords.top}px`, height: `${coords.height}px`, width, left }}
                        className={`absolute p-2 rounded-lg border text-left cursor-pointer transition-all z-10 flex flex-col justify-between overflow-hidden ${getStatusColor(
                          appt.estado
                        )}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wide truncate max-w-[65%]">
                              {appt.servicio_nombre}
                            </span>
                            <span className="text-[9px] opacity-75 font-bold shrink-0">
                              {formattedPrice}
                            </span>
                          </div>
                          <p className="text-[10px] font-semibold mt-0.5 truncate">{appt.nombre_cliente}</p>
                        </div>
                        <div className="flex items-center space-x-1 text-[8px] opacity-80 mt-1 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          <span className="truncate">
                            {new Date(appt.fecha_hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(appt.fecha_hora_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* Appointment Detail & Status & Edit Modal */}
      {selectedCita && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                <h3 className="text-base font-bold text-zinc-100 mt-2">{selectedCita.servicio_nombre}</h3>
                <p className="text-[10px] text-zinc-500">ID de Cita: #{selectedCita.id}</p>
              </div>
              <div className="flex items-center space-x-2">
                {!isEditing && (
                  <button
                    onClick={openEditMode}
                    className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
                    title="Editar Cita"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedCita(null);
                    setIsEditing(false);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 text-sm p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Read/Edit Body Switch */}
            {!isEditing ? (
              <div className="space-y-4">
                {/* Main Info */}
                <div className="grid grid-cols-2 gap-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850 text-xs">
                  <div className="space-y-1">
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase">Cliente</span>
                    <p className="text-zinc-200 font-medium">{selectedCita.nombre_cliente}</p>
                    <p className="text-[9px] text-zinc-450">{selectedCita.cliente_id}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase">Estilista</span>
                    <p className="text-zinc-200 font-medium">{selectedCita.estilista_nombre}</p>
                  </div>
                  <div className="space-y-1 col-span-2 border-t border-zinc-850 pt-2 mt-1">
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase">Horario</span>
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
                    <p className="text-zinc-400 text-xs pl-5 mt-0.5">
                      {new Date(selectedCita.fecha_hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' a '}
                      {new Date(selectedCita.fecha_hora_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {selectedCita.pago_tarjeta !== undefined && (selectedCita.pago_tarjeta > 0 || selectedCita.pago_efectivo! > 0) && (
                    <div className="space-y-1 col-span-2 border-t border-zinc-850 pt-2 mt-1">
                      <span className="text-[9px] text-zinc-500 font-semibold uppercase">Registro de Pago</span>
                      <p className="text-zinc-300 font-medium">
                        Tarjeta: ${selectedCita.pago_tarjeta} | Efectivo: ${selectedCita.pago_efectivo}
                      </p>
                      {selectedCita.descuento_especial && (
                        <p className="text-[10px] text-amber-400 font-bold">★ Descuento Especial Tony Activo</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Proof of Payment / Comprobante */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold uppercase text-zinc-500">Comprobante de Anticipo</h4>
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
                    <p className="text-xs text-amber-400 flex items-center space-x-1 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>No hay comprobante cargado.</span>
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
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all"
                        >
                          Cargar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* General state update buttons */}
                  <div className="flex items-center justify-end space-x-2 border-t border-zinc-800/60 pt-4">
                    {selectedCita.estado !== 'confirmada' && (
                      <button
                        onClick={() => openCheckoutMode(selectedCita)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-700/5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Validar y Cobrar</span>
                      </button>
                    )}
                    {selectedCita.estado !== 'cancelada' && (
                      <button
                        onClick={() => handleStatusChange(selectedCita.id, 'cancelada')}
                        disabled={updatingId === selectedCita.id}
                        className="bg-rose-950/40 text-rose-450 border border-rose-900/30 hover:bg-rose-900/40 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
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
            ) : (
              /* EDIT MODE */
              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Estilista</label>
                  <select
                    value={editEstilista}
                    onChange={(e) => setEditEstilista(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  >
                    {estilistas.map(e => (
                      <option key={e.id} value={e.nombre}>{e.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Servicio</label>
                  <select
                    value={editServicio}
                    onChange={(e) => setEditServicio(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  >
                    {servicios.map(s => (
                      <option key={s.id} value={s.nombre}>{s.nombre} - ${s.precio_fijo}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">Fecha</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-semibold block">Hora</label>
                    <input
                      type="time"
                      value={editHour}
                      onChange={(e) => setEditHour(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Duración (Horas)</label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  >
                    <option value="0.5">30 mins</option>
                    <option value="1">1 hora</option>
                    <option value="1.5">1.5 horas</option>
                    <option value="2">2 horas</option>
                    <option value="3">3 horas</option>
                    <option value="4">4 horas</option>
                    <option value="5">5 horas</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-2 border-t border-zinc-850 pt-4 mt-2">
                  <button
                    type="submit"
                    disabled={updatingId === selectedCita.id}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal (Validar y Cobrar) */}
      {showCheckoutModal && checkoutCita && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-2 border-b border-zinc-850">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Cobro y Liquidación de Servicio</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Servicio: {checkoutCita.servicio_nombre} para {checkoutCita.nombre_cliente}</p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-xs">
              
              {/* Split Payment */}
              <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">División de Pago</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Monto en Tarjeta ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pagoTarjeta}
                      onChange={(e) => {
                        setPagoTarjeta(e.target.value);
                        const rawTotal = Number(precioCobrado || checkoutCita.precio_fijo);
                        const card = Number(e.target.value) || 0;
                        setPagoEfectivo(String(Math.max(0, rawTotal - card)));
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-semibold block">Monto en Efectivo ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pagoEfectivo}
                      onChange={(e) => {
                        setPagoEfectivo(e.target.value);
                        const rawTotal = Number(precioCobrado || checkoutCita.precio_fijo);
                        const cash = Number(e.target.value) || 0;
                        setPagoTarjeta(String(Math.max(0, rawTotal - cash)));
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Prices & Special Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Tarifa Final Cobrada al Cliente ($)</label>
                  <input
                    type="number"
                    value={precioCobrado}
                    onChange={(e) => {
                      setPrecioCobrado(e.target.value);
                      setPagoEfectivo(e.target.value);
                      setPagoTarjeta('0');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-zinc-200 font-bold text-emerald-400 focus:outline-none"
                  />
                  <p className="text-[9px] text-zinc-500">Precio normal: ${checkoutCita.precio_fijo}</p>
                </div>

                <div className="flex items-center pt-5 pl-2">
                  <label className="flex items-center space-x-2 text-zinc-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={descuentoEspecial}
                      onChange={(e) => setDescuentoEspecial(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-800 text-emerald-600 bg-zinc-950 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                    />
                    <span>Descuento Especial Tony</span>
                  </label>
                </div>
              </div>
              
              {descuentoEspecial && (
                <div className="bg-emerald-950/20 border border-emerald-900/50 p-2.5 rounded-xl text-[10px] text-emerald-400 font-semibold">
                  ★ La comisión del estilista se calculará al 100% sobre el precio de lista (${checkoutCita.precio_fijo} MXN), sin importar el descuento hecho al cliente.
                </div>
              )}

              {/* Dye Supplies calculations if it is a color/tinte service */}
              {isDyeService(checkoutCita.servicio_nombre) && (
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 space-y-3">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Insumos a Descontar de Comisión (Tintes)</span>
                  </h4>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 block">Tubos de Tinte</label>
                      <input
                        type="number"
                        min="0"
                        value={insumoTubos}
                        onChange={(e) => setInsumoTubos(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 block">Tapas Bella</label>
                      <input
                        type="number"
                        min="0"
                        value={insumoTapaBella}
                        onChange={(e) => setInsumoTapaBella(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 block">Tapas Loreal</label>
                      <input
                        type="number"
                        min="0"
                        value={insumoTapaLoreal}
                        onChange={(e) => setInsumoTapaLoreal(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                  </div>

                  {/* Pricing Overrides */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900">
                    <div className="space-y-1">
                      <label className="text-[8px] text-zinc-500 block">Precio/Tubo ($)</label>
                      <input
                        type="number"
                        value={precioTubo}
                        onChange={(e) => setPrecioTubo(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1 text-zinc-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-zinc-500 block">Precio/Bella ($)</label>
                      <input
                        type="number"
                        value={precioBella}
                        onChange={(e) => setPrecioBella(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1 text-zinc-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-zinc-500 block">Precio/Loreal ($)</label>
                      <input
                        type="number"
                        value={precioLoreal}
                        onChange={(e) => setPrecioLoreal(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1 text-zinc-400"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-amber-500/80 pt-1">
                    Costo estimado a deducir del estilista:{' '}
                    <strong>
                      ${(Number(insumoTubos) * Number(precioTubo) + Number(insumoTapaBella) * Number(precioBella) + Number(insumoTapaLoreal) * Number(precioLoreal))} MXN
                    </strong>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 border-t border-zinc-850 pt-4">
                <button
                  type="submit"
                  disabled={updatingId === checkoutCita.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1 shadow-lg shadow-emerald-700/10 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Validar Transacción</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Creation / Agenda Form Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-2 border-b border-zinc-850">
              <h3 className="text-base font-bold text-zinc-100 flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>Agendar Nueva Cita Directa</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              
              {/* Autocomplete Client Finder */}
              <div className="space-y-1 relative" ref={dropdownRef}>
                <label className="text-zinc-400 font-semibold block">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Empieza a escribir el nombre..."
                  value={clientSearch}
                  onChange={(e) => handleClientSearchChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                
                {showDropdown && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto divide-y divide-zinc-850">
                    {filteredClients.map(c => (
                      <button
                        key={c.chat_id_whatsapp}
                        type="button"
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-2 hover:bg-zinc-850 text-zinc-350 hover:text-white transition-all text-xs"
                      >
                        <span className="font-bold">{c.nombre_cliente}</span>
                        <span className="text-[10px] text-zinc-500 block">{c.chat_id_whatsapp}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold block">Número de WhatsApp (Opcional si es nuevo)</label>
                <input
                  type="text"
                  placeholder="Ej: 52155XXXXXXXX"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold block">Estilista</label>
                <select
                  required
                  value={createEstilista}
                  onChange={(e) => setCreateEstilista(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                >
                  <option value="">-- Seleccionar --</option>
                  {estilistas.map(e => (
                    <option key={e.id} value={e.nombre}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold block">Servicio</label>
                <select
                  required
                  value={createServicio}
                  onChange={(e) => {
                    setCreateServicio(e.target.value);
                    const matched = servicios.find(s => s.nombre === e.target.value);
                    if (matched) {
                      setCreateCost(String(matched.precio_fijo));
                      setCreateDuration(String(matched.duracion_minutos / 60));
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                >
                  <option value="">-- Seleccionar --</option>
                  {servicios.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre} - ${s.precio_fijo}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Fecha</label>
                  <input
                    type="date"
                    required
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Hora</label>
                  <input
                    type="time"
                    required
                    value={createHour}
                    onChange={(e) => setCreateHour(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Duración (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 font-semibold block">Costo ($)</label>
                  <input
                    type="number"
                    required
                    value={createCost}
                    onChange={(e) => setCreateCost(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 border-t border-zinc-850 pt-4 mt-2">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Confirmar y Agendar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
