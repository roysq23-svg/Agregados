import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';

export default function RendicionChofer() {
  const [choferes, setChoferes] = useState([]);
  const [uuidChoferSeleccionado, setUuidChoferSeleccionado] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  const [viajes, setViajes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar lista de choferes
  useEffect(() => {
    async function cargarChoferes() {
      const { data } = await supabase.from('choferes').select('*').eq('activo', true);
      if (data) setChoferes(data);
    }
    cargarChoferes();
  }, []);

  // Cargar movimientos y gastos al cambiar los filtros
  useEffect(() => {
    if (uuidChoferSeleccionado) {
      fetchDataRendicion();
    }
  }, [uuidChoferSeleccionado, fecha]);

  const fetchDataRendicion = async () => {
    setLoading(true);
    try {
      const inicioDiaUTC = `${fecha}T05:00:00.000Z`;
      
      const tomorow = new Date(fecha);
      tomorow.setDate(tomorow.getDate() + 1);
      const fechaManana = tomorow.toISOString().split('T')[0];
      const finDiaUTC = `${fechaManana}T04:59:59.999Z`;

      // 1. Traer viajes
      const { data: dataViajes, error: errorV } = await supabase
        .from('movimientos')
        .select('*, detalle_movimientos(*)')
        .eq('usuario_id', uuidChoferSeleccionado)
        .gte('creado_en', inicioDiaUTC)
        .lte('creado_en', finDiaUTC);

      if (errorV) throw errorV;

      // 2. Traer gastos
      const { data: dataGastos, error: errorG } = await supabase
        .from('gastos_chofer')
        .select('*')
        .eq('usuario_id', uuidChoferSeleccionado)
        .gte('creado_en', inicioDiaUTC)
        .lte('creado_en', finDiaUTC);

      if (errorG) throw errorG;

      setViajes(dataViajes || []);
      setGastos(dataGastos || []);
    } catch (error) {
      console.error("Error al cuadrar caja:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirModificarPago = (viaje) => {
    console.log("Modificando pago del viaje:", viaje.id);
  };

  // CÁLCULOS LOGÍSTICOS
  const totalViajes = viajes.length;
  const totalM3 = viajes.reduce((acc, v) => acc + (parseFloat(v.cantidad_cubos) || 0), 0);
  const dineroTotalGenerado = viajes.reduce((acc, v) => acc + (parseFloat(v.monto_total) || 0), 0);
  
  const dineroCobrado = viajes.reduce((acc, v) => {
    const estado = v.estado_pago?.toLowerCase().trim();
    if (estado === 'pagado' || estado === 'pagado completo') {
      return acc + (parseFloat(v.monto_total) || 0);
    }
    return acc;
  }, 0);

  const dineroPendiente = dineroTotalGenerado - dineroCobrado;
  const totalGastosRuta = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
  const efectivoAEntregar = dineroCobrado - totalGastosRuta;

  return (
    // CAMBIO INTERFAZ GENERAL: De bg-slate-900 a un gris ultra claro, fresco y descansado
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO MODO CLARO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">🚚 Rendición de Cuentas y Caja</h1>
            <p className="text-xs text-slate-500 mt-0.5">Cuadre diario de despachos, metros cúbicos y gastos de ruta</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Seleccionar Conductor</label>
              <select
                value={uuidChoferSeleccionado}
                onChange={(e) => setUuidChoferSeleccionado(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none min-w-[200px]"
              >
                <option value="">-- Elige un Chofer --</option>
                {choferes.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.nombre?.toUpperCase() || ch.usuario}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Fecha de Operación</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-emerald-600 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {!uuidChoferSeleccionado ? (
          <div className="bg-white border border-dashed border-slate-300 text-center py-16 rounded-2xl text-slate-400 text-sm shadow-sm">
            <i className="fa-solid fa-truck-moving text-4xl mb-3 text-slate-300 block"></i>
            Por favor, selecciona un conductor en la parte superior para calcular la rendición.
          </div>
        ) : loading ? (
          <p className="text-center text-emerald-600 animate-pulse py-12 text-sm font-semibold">Procesando base de datos de Agregados Llagas...</p>
        ) : (
          <>
            {/* TARJETAS RESUMEN EN CLARO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Viajes Registrados</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalViajes}</p>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">{totalM3.toFixed(1)} m³ despachados</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Monto Total Bruto</span>
                <p className="text-2xl font-black text-blue-600 mt-1">S/ {dineroTotalGenerado.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">Valor total en ruta</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Dinero Cobrado</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">S/ {dineroCobrado.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">Ingreso real a caja</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Saldo Pendiente</span>
                <p className="text-2xl font-black text-amber-600 mt-1">S/ {dineroPendiente.toFixed(2)}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">Por cobrar a clientes</span>
              </div>

              {/* Tarjeta destacada de entrega */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center shadow-sm">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Efectivo Neto a Entregar</span>
                <p className="text-2xl font-black text-emerald-900 mt-1 font-mono">S/ {efectivoAEntregar.toFixed(2)}</p>
                <span className="text-[11px] text-emerald-700/80 block mt-0.5">Restado S/ {totalGastosRuta.toFixed(2)} de gastos</span>
              </div>
            </div>

            {/* TABLAS DE DESGLOSE MODO CLARO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TABLA DE DESPACHOS */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">📝 Detalle de Viajes Entregados</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Hora</th>
                        <th className="pb-3 text-center">Volumen</th>
                        <th className="pb-3 text-right">Monto</th>
                        <th className="pb-3 text-center">Estado</th>
                        <th className="pb-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {viajes.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">No hay viajes registrados por este chofer en la fecha seleccionada.</td>
                        </tr>
                      ) : (
                        viajes.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 font-bold text-slate-700 uppercase">{v.cliente_nombre}</td>
                            <td className="py-3.5 text-slate-500 text-xs font-mono">
                              {new Date(v.creado_en).toLocaleTimeString('es-PE', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </td>
                            <td className="py-3.5 text-center font-mono text-slate-600">{parseFloat(v.cantidad_cubos).toFixed(1)} m³</td>
                            <td className="py-3.5 text-right font-bold text-slate-700 font-mono">S/ {v.monto_total.toFixed(2)}</td>
                            <td className="py-3.5 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                                v.estado_pago?.toLowerCase().trim() === 'pagado' || v.estado_pago?.toLowerCase().trim() === 'pagado completo'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {v.estado_pago}
                              </span>
                            </td>
                            {/* Botón de acción refinado para modo claro */}
                            <td className="py-3.5 text-center">
                              <button
                                onClick={() => handleAbrirModificarPago(v)}
                                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-emerald-600 text-slate-600 hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-600 text-xs font-bold transition-all shadow-sm group/btn cursor-pointer"
                                title="Modificar estado de pago"
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  strokeWidth="2.5" 
                                  stroke="currentColor" 
                                  className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Zm13.5 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                </svg>
                                <span>Editar</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLA DE GASTOS MODO CLARO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider">💰 Gastos y Desembolsos en Ruta</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                        <th className="pb-3">Descripción / Concepto</th>
                        <th className="pb-3 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {gastos.length === 0 ? (
                        <tr>
                          <td colSpan="2" className="text-center py-8 text-slate-400 text-xs">El chofer no declaró gastos de caja chica hoy.</td>
                        </tr>
                      ) : (
                        gastos.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 text-slate-600 font-medium text-xs uppercase">{g.descripcion}</td>
                            <td className="py-3.5 text-right font-bold text-red-600 font-mono">S/ {g.monto.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {gastos.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                    <span>Total Gastos:</span>
                    <strong className="text-red-600 font-mono text-sm">S/ {totalGastosRuta.toFixed(2)}</strong>
                  </div>
                )}
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  );
}