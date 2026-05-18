import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';

// ── Helpers de fecha ────────────────────────────────────────
function getRangoFecha(periodo, fechaBase) {
  const base = new Date(fechaBase + 'T12:00:00'); // evita desfase de zona
  let inicio, fin;

  if (periodo === 'dia') {
    inicio = new Date(fechaBase + 'T00:00:00');
    fin    = new Date(fechaBase + 'T23:59:59');
  } else if (periodo === 'semana') {
    // Lunes a Domingo de la semana que contiene fechaBase
    const day = base.getDay(); // 0=dom
    const diffLunes = (day === 0 ? -6 : 1 - day);
    inicio = new Date(base);
    inicio.setDate(base.getDate() + diffLunes);
    inicio.setHours(0, 0, 0, 0);
    fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
  } else if (periodo === 'mes') {
    inicio = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0);
    fin    = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // 'personalizado' — el caller pasa fechaInicio y fechaFin directo
    return null;
  }

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  };
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function RendicionChofer() {
  const [choferes, setChoferes]     = useState([]);
  const [choferSel, setChoferSel]   = useState('');
  const [periodo, setPeriodo]       = useState('dia');
  const [fechaBase, setFechaBase]   = useState(new Date().toISOString().split('T')[0]);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin]     = useState(new Date().toISOString().split('T')[0]);

  const [viajes, setViajes]   = useState([]);
  const [gastos, setGastos]   = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal edición
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [viajeAEditar,      setViajeAEditar]      = useState(null);
  const [editCliente,       setEditCliente]       = useState('');
  const [editProducto,      setEditProducto]      = useState('');
  const [editVolumen,       setEditVolumen]       = useState('');
  const [editPrecioUnit,    setEditPrecioUnit]    = useState('');
  const [editMonto,         setEditMonto]         = useState('');
  const [editEstado,        setEditEstado]        = useState('pendiente');
  const [savingEdit,        setSavingEdit]        = useState(false);
  const [editError,         setEditError]         = useState('');

  // Cargar choferes
  useEffect(() => {
    supabase.from('choferes').select('*').eq('activo', true)
      .then(({ data }) => { if (data) setChoferes(data); });
  }, []);

  // Fetch principal
  const fetchData = useCallback(async () => {
    if (!choferSel) return;
    setLoading(true);
    try {
      let inicioISO, finISO;

      if (periodo === 'personalizado') {
        inicioISO = `${fechaInicio}T00:00:00.000Z`;
        finISO    = `${fechaFin}T23:59:59.999Z`;
      } else {
        const rango = getRangoFecha(periodo, fechaBase);
        // Ajuste zona PE (UTC-5 → sumamos 5h al inicio del día local)
        const inicioLocal = new Date(fechaBase + 'T00:00:00');
        const finLocal    = periodo === 'dia'
          ? new Date(fechaBase + 'T23:59:59')
          : rango.fin;

        inicioISO = rango.inicio;
        finISO    = rango.fin;
      }

      const [{ data: dV, error: eV }, { data: dG, error: eG }] = await Promise.all([
        supabase
          .from('movimientos')
          .select('*, detalle_movimientos(*)')
          .eq('usuario_id', choferSel)
          .gte('creado_en', inicioISO)
          .lte('creado_en', finISO)
          .order('creado_en', { ascending: true }),
        supabase
          .from('gastos_chofer')
          .select('*')
          .eq('usuario_id', choferSel)
          .gte('creado_en', inicioISO)
          .lte('creado_en', finISO),
      ]);

      if (eV) throw eV;
      if (eG) throw eG;
      setViajes(dV || []);
      setGastos(dG || []);
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [choferSel, periodo, fechaBase, fechaInicio, fechaFin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers estado ────────────────────────────────────────
  const esPagado = (e) => {
    const s = (e || '').toLowerCase().trim();
    return s === 'pagado' || s === 'pagado completo';
  };

  // ── Cálculos ──────────────────────────────────────────────
  const totalViajes        = viajes.length;
  const totalM3            = viajes.reduce((a, v) => a + (parseFloat(v.cantidad_cubos) || 0), 0);
  const totalBruto         = viajes.reduce((a, v) => a + (parseFloat(v.monto_total)    || 0), 0);
  const totalCobrado       = viajes.reduce((a, v) => esPagado(v.estado_pago) ? a + (parseFloat(v.monto_total) || 0) : a, 0);
  const totalPendiente     = totalBruto - totalCobrado;
  const totalGastos        = gastos.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
  const netoAEntregar      = totalCobrado - totalGastos;
  const viajesPendientes   = viajes.filter(v => !esPagado(v.estado_pago));

  // Agrupar por día para vista semanal/mensual
  const viajesPorDia = viajes.reduce((acc, v) => {
    const dia = v.creado_en?.split('T')[0] || '?';
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(v);
    return acc;
  }, {});

  // ── Modal ────────────────────────────────────────────────
  const abrirModal = (v) => {
    setEditError('');
    setViajeAEditar(v);
    setEditCliente(v.cliente_nombre || '');
    setEditProducto(v.tipo_material || v.producto || '');
    const vol = parseFloat(v.cantidad_cubos) || 0;
    const monto = parseFloat(v.monto_total) || 0;
    setEditVolumen(String(vol));
    setEditMonto(String(monto));
    setEditPrecioUnit(vol > 0 ? String((monto / vol).toFixed(2)) : '');
    setEditEstado(v.estado_pago || 'pendiente');
    setIsModalOpen(true);
  };
  const cerrarModal = () => { setIsModalOpen(false); setViajeAEditar(null); setEditError(''); };

  const onVolChange = (val) => {
    setEditVolumen(val);
    const v = parseFloat(val) || 0, p = parseFloat(editPrecioUnit) || 0;
    if (v > 0 && p > 0) setEditMonto((v * p).toFixed(2));
  };
  const onPrecioChange = (val) => {
    setEditPrecioUnit(val);
    const v = parseFloat(editVolumen) || 0, p = parseFloat(val) || 0;
    if (v > 0 && p > 0) setEditMonto((v * p).toFixed(2));
  };

  const guardarCambios = async () => {
    if (savingEdit) return;
    if (!editCliente.trim()) { setEditError('El nombre del cliente no puede estar vacío.'); return; }
    const vol = parseFloat(editVolumen), monto = parseFloat(editMonto);
    if (!vol || vol <= 0) { setEditError('Ingresa un volumen válido.'); return; }
    if (!monto || monto <= 0) { setEditError('Ingresa un monto válido.'); return; }
    setSavingEdit(true); setEditError('');
    try {
      const payload = {
        cliente_nombre: editCliente.trim(),
        cantidad_cubos: vol,
        monto_total: monto,
        estado_pago: editEstado,
      };
      if (editProducto) payload.tipo_material = editProducto.trim();
      const { error } = await supabase.from('movimientos').update(payload).eq('id', viajeAEditar.id);
      if (error) throw error;
      cerrarModal();
      await fetchData();
    } catch (err) {
      setEditError('Error: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Etiqueta de periodo activo ────────────────────────────
  const labelPeriodo = () => {
    if (periodo === 'dia') return `Día: ${fmt(fechaBase + 'T12:00:00')}`;
    if (periodo === 'semana') {
      const r = getRangoFecha('semana', fechaBase);
      return `Semana: ${fmt(r.inicio)} – ${fmt(r.fin)}`;
    }
    if (periodo === 'mes') {
      const r = getRangoFecha('mes', fechaBase);
      return `Mes: ${fmt(r.inicio)} – ${fmt(r.fin)}`;
    }
    return `${fmt(fechaInicio + 'T12:00:00')} – ${fmt(fechaFin + 'T12:00:00')}`;
  };

  const periodos = [
    { id: 'dia',          icon: '📅', label: 'Día' },
    { id: 'semana',       icon: '📆', label: 'Semana' },
    { id: 'mes',          icon: '🗓️', label: 'Mes' },
    { id: 'personalizado',icon: '🔍', label: 'Personalizado' },
  ];

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 relative">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── ENCABEZADO ── */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">🚚 Rendición de Cuentas y Caja</h1>
              <p className="text-xs text-slate-400 mt-0.5">Cuadre de despachos · metros cúbicos · gastos de ruta</p>
            </div>
            <div className="flex flex-col w-full md:w-auto">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Conductor</label>
              <select
                value={choferSel}
                onChange={(e) => setChoferSel(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none min-w-[200px]"
              >
                <option value="">-- Elige un Chofer --</option>
                {choferes.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.nombre?.toUpperCase() || ch.usuario}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de periodo */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {periodos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodo(p.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                    periodo === p.id
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>

            {/* Controles de fecha según periodo */}
            {periodo !== 'personalizado' ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
                    {periodo === 'dia' ? 'Fecha' : periodo === 'semana' ? 'Cualquier día de la semana' : 'Cualquier día del mes'}
                  </label>
                  <input
                    type="date"
                    value={fechaBase}
                    onChange={(e) => setFechaBase(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-emerald-600 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                {choferSel && (
                  <div className="mt-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Mostrando</p>
                    <p className="text-xs font-black text-emerald-900 mt-0.5">{labelPeriodo()}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Desde</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-emerald-600 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Hasta</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-emerald-600 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                {choferSel && (
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Mostrando</p>
                    <p className="text-xs font-black text-emerald-900 mt-0.5">{labelPeriodo()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ESTADO VACÍO ── */}
        {!choferSel ? (
          <div className="bg-white border border-dashed border-slate-300 text-center py-20 rounded-2xl shadow-sm">
            <p className="text-4xl mb-3">👆</p>
            <p className="text-slate-400 text-sm font-medium">Selecciona un conductor para ver el reporte.</p>
          </div>

        ) : loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-emerald-600 text-sm font-semibold">Cargando datos…</p>
          </div>

        ) : (
          <>
            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Viajes</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalViajes}</p>
                <span className="text-[11px] text-slate-500 block mt-0.5">{totalM3.toFixed(1)} m³</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Bruto</span>
                <p className="text-lg font-black text-blue-600 mt-1 font-mono">S/ {totalBruto.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">generado en ruta</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Cobrado</span>
                <p className="text-lg font-black text-emerald-600 mt-1 font-mono">S/ {totalCobrado.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">ingreso real</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Pendiente</span>
                <p className="text-lg font-black text-amber-600 mt-1 font-mono">S/ {totalPendiente.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">{viajesPendientes.length} viaje(s)</span>
              </div>
              <div className="col-span-2 lg:col-span-1 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center shadow-sm">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Neto a Entregar</span>
                <p className="text-lg font-black text-emerald-900 mt-1 font-mono">S/ {netoAEntregar.toFixed(2)}</p>
                <span className="text-[11px] text-emerald-700/70 block mt-0.5">− S/ {totalGastos.toFixed(2)} gastos</span>
              </div>
            </div>

            {/* ── LAYOUT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Lista de viajes — agrupada por día si es semana/mes */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    📦 Viajes {periodo === 'dia' ? 'del Día' : periodo === 'semana' ? 'de la Semana' : periodo === 'mes' ? 'del Mes' : 'del Período'}
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-lg">
                    {totalViajes} registro{totalViajes !== 1 ? 's' : ''}
                  </span>
                </div>

                {totalViajes === 0 ? (
                  <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-12 text-center text-slate-400 text-xs">
                    No hay viajes registrados en este período.
                  </div>
                ) : (
                  // Si es día, mostrar directo. Si es semana/mes, agrupar por día
                  periodo === 'dia' ? (
                    <div className="space-y-3">
                      {viajes.map(v => <TarjetaViaje key={v.id} v={v} esPagado={esPagado} onEditar={abrirModal} />)}
                    </div>
                  ) : (
                    Object.keys(viajesPorDia).sort().map(dia => {
                      const vsDia = viajesPorDia[dia];
                      const totalDia = vsDia.reduce((a, v) => a + (parseFloat(v.monto_total) || 0), 0);
                      const cobradoDia = vsDia.reduce((a, v) => esPagado(v.estado_pago) ? a + (parseFloat(v.monto_total) || 0) : a, 0);
                      return (
                        <div key={dia} className="space-y-2">
                          {/* Cabecera del día */}
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                {new Date(dia + 'T12:00:00').toLocaleDateString('es-PE', {
                                  weekday: 'long', day: '2-digit', month: 'short'
                                }).toUpperCase()}
                              </span>
                              <span className="text-[10px] bg-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded-lg">
                                {vsDia.length} viaje{vsDia.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black">
                              <span className="text-emerald-600 font-mono">S/ {cobradoDia.toFixed(2)}</span>
                              {totalDia - cobradoDia > 0 && (
                                <span className="text-amber-500 font-mono">+ S/ {(totalDia - cobradoDia).toFixed(2)} pend.</span>
                              )}
                            </div>
                          </div>
                          {/* Tarjetas de ese día */}
                          <div className="space-y-2">
                            {vsDia.map(v => <TarjetaViaje key={v.id} v={v} esPagado={esPagado} onEditar={abrirModal} compact />)}
                          </div>
                          {/* Subtotal día */}
                          <div className="bg-slate-100 rounded-xl px-4 py-2 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Subtotal {new Date(dia + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</span>
                            <span className="font-black font-mono text-slate-800 text-sm">S/ {totalDia.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              {/* Panel lateral */}
              <div className="space-y-4">

                {/* Pendientes */}
                {viajesPendientes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-3">⏳ Pendiente de Cobro</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {viajesPendientes.map(v => (
                        <div key={v.id} className="flex justify-between items-start text-xs gap-2">
                          <div>
                            <span className="font-bold text-amber-900 uppercase block">{v.cliente_nombre}</span>
                            <span className="text-amber-600 text-[10px]">
                              {new Date(v.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <span className="font-black font-mono text-amber-700 whitespace-nowrap">
                            S/ {parseFloat(v.monto_total).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-700 uppercase">Total a cobrar</span>
                      <span className="font-black font-mono text-amber-800">S/ {totalPendiente.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Gastos */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <h4 className="text-[10px] font-black text-red-600 uppercase tracking-wider mb-3">💸 Gastos de Ruta</h4>
                  {gastos.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-4">Sin gastos declarados.</p>
                  ) : (
                    <div className="space-y-2">
                      {gastos.map(g => (
                        <div key={g.id} className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-slate-600 font-medium uppercase block">{g.descripcion}</span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(g.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <span className="font-bold font-mono text-red-600">S/ {parseFloat(g.monto).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Total gastos</span>
                        <span className="font-black font-mono text-red-600">S/ {totalGastos.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumen de caja */}
                <div className="bg-slate-800 rounded-2xl p-4 text-white">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">🧾 Resumen del Período</h4>
                  <p className="text-[10px] text-emerald-400 font-semibold mb-3">{labelPeriodo()}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total bruto</span>
                      <span className="font-mono font-bold">S/ {totalBruto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cobrado</span>
                      <span className="font-mono font-bold text-emerald-400">S/ {totalCobrado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pendiente</span>
                      <span className="font-mono font-bold text-amber-400">S/ {totalPendiente.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">− Gastos ruta</span>
                      <span className="font-mono font-bold text-red-400">S/ {totalGastos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-600">
                      <span className="font-black text-white">Neto a Entregar</span>
                      <span className="font-black font-mono text-emerald-400 text-lg">S/ {netoAEntregar.toFixed(2)}</span>
                    </div>
                    {periodo !== 'dia' && totalViajes > 0 && (
                      <div className="pt-2 border-t border-slate-700 space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Promedios diarios</p>
                        <div className="flex justify-between text-slate-400">
                          <span>Viajes / día</span>
                          <span className="font-mono">{(totalViajes / Object.keys(viajesPorDia).length).toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Ingreso / día</span>
                          <span className="font-mono">S/ {(totalBruto / Object.keys(viajesPorDia).length).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </>
        )}
      </div>

      {/* ── MODAL EDICIÓN ── */}
      {isModalOpen && viajeAEditar && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-800 px-5 py-4 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black text-white uppercase">✏️ Editar Viaje</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase">
                  {viajeAEditar.cliente_nombre} · {new Date(viajeAEditar.creado_en).toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short'
                  })} {new Date(viajeAEditar.creado_en).toLocaleTimeString('es-PE', {
                    hour: '2-digit', minute: '2-digit', hour12: true
                  })}
                </p>
              </div>
              <button type="button" onClick={cerrarModal}
                className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-red-700">⚠️ {editError}</div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Nombre del Cliente</label>
                <input type="text" value={editCliente} onChange={e => setEditCliente(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Producto / Material</label>
                <input type="text" value={editProducto} onChange={e => setEditProducto(e.target.value)}
                  placeholder="ARENA, PIEDRA, AFIRMADO…"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Volumen (m³)</label>
                  <input type="number" step="0.1" min="0" value={editVolumen} onChange={e => onVolChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Precio x m³</label>
                  <input type="number" step="0.01" min="0" value={editPrecioUnit} onChange={e => onPrecioChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  Monto Total (S/) <span className="normal-case text-emerald-500 font-semibold">— automático</span>
                </label>
                <input type="number" step="0.01" min="0" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-base font-black font-mono text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                {parseFloat(editVolumen) > 0 && parseFloat(editPrecioUnit) > 0 && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                    {parseFloat(editVolumen).toFixed(1)} m³ × S/ {parseFloat(editPrecioUnit).toFixed(2)} = S/ {(parseFloat(editVolumen) * parseFloat(editPrecioUnit)).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Estado de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'pendiente', label: '⏳ Pendiente', sub: 'Debe / Por cobrar' },
                    { val: 'pagado',    label: '✅ Pagado',    sub: 'Cobrado completo' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setEditEstado(opt.val)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        editEstado === opt.val
                          ? opt.val === 'pagado' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}>
                      <div className="text-xs font-black">{opt.label}</div>
                      <div className="text-[10px] font-semibold opacity-70">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={cerrarModal} disabled={savingEdit}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button type="button" onClick={guardarCambios} disabled={savingEdit}
                  className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase shadow-md cursor-pointer flex items-center justify-center gap-2">
                  {savingEdit ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando…</>
                  ) : '💾 Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente tarjeta de viaje ───────────────────────────────
function TarjetaViaje({ v, esPagado, onEditar, compact = false }) {
  const pagado   = esPagado(v.estado_pago);
  const volumen  = parseFloat(v.cantidad_cubos) || 0;
  const monto    = parseFloat(v.monto_total) || 0;
  const precioU  = volumen > 0 ? (monto / volumen).toFixed(2) : '—';
  const producto = (v.tipo_material || v.producto || 'ARENA').toUpperCase();

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${pagado ? 'border-slate-200' : 'border-amber-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${pagado ? 'bg-white' : 'bg-amber-50/60'}`}>
        <div>
          <p className="font-black text-slate-900 text-sm uppercase">{v.cliente_nombre}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            🕐 {new Date(v.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEditar(v)}
            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-emerald-600 text-slate-500 hover:text-white rounded-xl border border-slate-200 hover:border-emerald-600 transition-all cursor-pointer"
            title="Editar viaje">✏️</button>
          <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase ${
            pagado ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {pagado ? 'PAGADO' : 'PENDIENTE'}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="px-4 py-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Producto</p>
            <p className="text-xs font-black text-slate-700 mt-0.5">{producto}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Volumen</p>
            <p className="text-xs font-black text-slate-700 mt-0.5 font-mono">{volumen.toFixed(1)} m³</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">P. Unit.</p>
            <p className="text-xs font-black text-slate-700 mt-0.5 font-mono">S/ {precioU}</p>
          </div>
        </div>
      )}

      {compact && (
        <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-[11px] text-slate-500">
          <span className="font-bold">{producto}</span>
          <span className="font-mono">{volumen.toFixed(1)} m³</span>
          <span className="font-mono">S/ {precioU}/m³</span>
        </div>
      )}

      <div className={`px-4 py-2.5 flex items-center justify-between border-t ${pagado ? 'border-slate-100 bg-slate-50/50' : 'border-amber-100 bg-amber-50/40'}`}>
        <span className="text-[10px] text-slate-400 font-bold uppercase">Monto Total</span>
        <span className={`font-black font-mono text-base ${pagado ? 'text-emerald-700' : 'text-amber-700'}`}>
          S/ {monto.toFixed(2)}
        </span>
      </div>
    </div>
  );
}