import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [metricas, setMetricas] = useState({
    totalVentas: 0,
    totalM3: 0,
    dineroCobrado: 0,
    dineroPendiente: 0,
    totalGastos: 0
  });
  
  const [ultimosViajes, setUltimosViajes] = useState([]);
  const [rankingChoferes, setRankingChoferes] = useState([]);
  const [listaConductores, setListaConductores] = useState({}); // Diccionario ID -> Nombre
  
  // Estados para el Modal de Edición de Pagos
  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);
  const [nuevoEstadoPago, setNuevoEstadoPago] = useState('pendiente');
  const [guardandoModal, setGuardandoModal] = useState(false);

  // Filtro de mes actual por defecto (Año-Mes)
  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesActualStr);

  useEffect(() => {
    inicializarDashboard();
  }, [mesFiltro]);

  const inicializarDashboard = async () => {
    setLoading(true);
    try {
      // 1. Cargar catálogo de choferes para tener sus nombres reales indexados por su ID
      const { data: dataChoferes } = await supabase.from('choferes').select('id, nombre');
      const diccionarioChoferes = {};
      dataChoferes?.forEach(c => {
        diccionarioChoferes[c.id] = c.nombre;
      });
      setListaConductores(diccionarioChoferes);

      // 2. Definir rangos de fechas locales de Perú (UTC-5)
      const [anio, mes] = mesFiltro.split('-');
      const primerDiaPeru = `${anio}-${mes}-01T05:00:00.000Z`;
      
      const siguienteMesObj = new Date(parseInt(anio), parseInt(mes), 1);
      const siguienteMesStr = `${siguienteMesObj.getFullYear()}-${String(siguienteMesObj.getMonth() + 1).padStart(2, '0')}`;
      const ultimoDiaPeru = `${siguienteMesStr}-01T04:59:59.999Z`;

      // 3. Consultar viajes trayendo también sus detalles de materiales en una sola llamada
      const { data: viajes, error: errorV } = await supabase
        .from('movimientos')
        .select('*, detalle_movimientos(*)')
        .gte('creado_en', primerDiaPeru)
        .lte('creado_en', ultimoDiaPeru)
        .order('creado_en', { ascending: false });

      if (errorV) throw errorV;

      // 4. Consultar gastos operacionales
      const { data: gastos, error: errorG } = await supabase
        .from('gastos_chofer')
        .select('*')
        .gte('creado_en', primerDiaPeru)
        .lte('creado_en', ultimoDiaPeru);

      if (errorG) throw errorG;

      // 5. Procesar Métricas Globales
      const totalVentas = viajes?.reduce((acc, v) => acc + (parseFloat(v.monto_total) || 0), 0) || 0;
      const totalM3 = viajes?.reduce((acc, v) => acc + (parseFloat(v.cantidad_cubos) || 0), 0) || 0;
      const dineroCobrado = viajes?.reduce((acc, v) => {
        const est = v.estado_pago?.toLowerCase().trim();
        return (est === 'pagado' || est === 'pagado completo') ? acc + (parseFloat(v.monto_total) || 0) : acc;
      }, 0) || 0;
      const dineroPendiente = totalVentas - dineroCobrado;
      const totalGastos = gastos?.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0) || 0;

      setMetricas({ totalVentas, totalM3, dineroCobrado, dineroPendiente, totalGastos });
      setUltimosViajes(viajes || []); 

      // 6. Agrupar producción mensual mapeando con los nombres reales de los conductores
      const mapaChoferes = {};
      viajes?.forEach(v => {
        const keyID = v.usuario_id || 'Desconocido';
        const nombreReal = diccionarioChoferes[v.id_chofer] || diccionarioChoferes[keyID] || "Conductor General";
        
        if (!mapaChoferes[keyID]) {
          mapaChoferes[keyID] = { nombre: nombreReal, viajesCount: 0, m3Count: 0, totalSoles: 0 };
        }
        mapaChoferes[keyID].viajesCount += 1;
        mapaChoferes[keyID].m3Count += parseFloat(v.cantidad_cubos) || 0;
        mapaChoferes[keyID].totalSoles += parseFloat(v.monto_total) || 0;
      });

      const listaRank = Object.keys(mapaChoferes).map(id => ({
        id,
        ...mapaChoferes[id]
      }));
      setRankingChoferes(listaRank);

    } catch (error) {
      console.error("Error cargando el Dashboard:", error.message);
    } finally {
      loading && setLoading(false);
      setLoading(false);
    }
  };

  // Función para abrir el modal de deudas y abonos
  const handleAbrirModificarPago = (viaje) => {
    setViajeSeleccionado(viaje);
    setNuevoEstadoPago(viaje.estado_pago || 'pendiente');
  };

  // Guardar cambio de estado de deudas en Supabase
  const handleGuardarEstadoPago = async () => {
    if (!viajeSeleccionado) return;
    setGuardandoModal(true);
    try {
      const { error } = await supabase
        .from('movimientos')
        .update({ estado_pago: nuevoEstadoPago })
        .eq('id', viajeSeleccionado.id);

      if (error) throw error;
      
      // Cerrar ventana y recargar métricas refrescadas
      setViajeSeleccionado(null);
      inicializarDashboard();
    } catch (error) {
      alert("Error al actualizar pago: " + error.message);
    } finally {
      setGuardandoModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <span className="text-indigo-600 text-xs font-bold uppercase tracking-widest block">Panel de Control</span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">📊 Dashboard General del Negocio</h1>
            <p className="text-xs text-slate-500">Resumen operativo mensual y rendimiento financiero de la flota</p>
          </div>

          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Periodo de Análisis</label>
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-600 text-sm font-semibold animate-pulse">Calculando métricas globales...</p>
          </div>
        ) : (
          <>
            {/* GRIDS DE METRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Tarjeta 1 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Volumen Despachado</span>
                <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{metricas.totalM3.toFixed(1)} <span className="text-xs font-normal text-slate-400">m³</span></p>
                <div className="text-[11px] text-slate-400 mt-2">Cubos de agregados en obra</div>
              </div>

              {/* Tarjeta 2 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-l-4 border-l-indigo-500">
                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Venta Bruta Total</span>
                <p className="text-3xl font-black text-indigo-600 mt-1 font-mono">S/ {metricas.totalVentas.toFixed(2)}</p>
                <div className="text-[11px] text-slate-400 mt-2">Valor total facturado/ruta</div>
              </div>

              {/* Tarjeta 3 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-l-4 border-l-emerald-500">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Efectivo Cobrado</span>
                <p className="text-3xl font-black text-emerald-600 mt-1 font-mono">S/ {metricas.dineroCobrado.toFixed(2)}</p>
                <div className="text-[11px] text-slate-400 mt-2">Dinero ingresado a caja</div>
              </div>

              {/* Tarjeta 4 (Cuentas por cobrar - Alerta sutil) */}
              <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 shadow-sm transition-all hover:shadow-md border-l-4 border-l-amber-500">
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Cuentas por Cobrar</span>
                <p className="text-3xl font-black text-amber-700 mt-1 font-mono">S/ {metricas.dineroPendiente.toFixed(2)}</p>
                <div className="text-[11px] text-amber-600 mt-2">Dinero atrapado en la calle</div>
              </div>

              {/* Tarjeta 5 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-l-4 border-l-rose-500">
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">Gastos Operacionales</span>
                <p className="text-3xl font-black text-rose-600 mt-1 font-mono">S/ {metricas.totalGastos.toFixed(2)}</p>
                <div className="text-[11px] text-slate-400 mt-2">Combustible, peajes y viáticos</div>
              </div>
            </div>

            {/* SECCIÓN INFERIOR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* HISTORIAL DE DESPACHOS */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    ⚡ Historial de Despachos en Ruta
                  </h3>
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Clic en la acción para modificar</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Cliente / Destino</th>
                        <th className="pb-3 font-semibold">Materiales Despachados</th>
                        <th className="pb-3 text-right font-semibold">Importe</th>
                        <th className="pb-3 text-center font-semibold">Estado Pago</th>
                        <th className="pb-3 text-center font-semibold">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {ultimosViajes.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-12 text-slate-400 text-xs italic">No hay despachos registrados en este periodo.</td>
                        </tr>
                      ) : (
                        ultimosViajes.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-4">
                              <div className="font-semibold text-slate-900 uppercase tracking-tight text-xs">{v.cliente_nombre}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {new Date(v.creado_en).toLocaleDateString('es-PE')} - {new Date(v.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                            </td>
                            <td className="py-4 pr-2">
                              <div className="flex flex-wrap gap-1">
                                {v.detalle_movimientos?.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">Sin especificar</span>
                                ) : (
                                  v.detalle_movimientos?.map((det, idx) => (
                                    <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200 uppercase">
                                      {det.material_tipo} ({parseFloat(det.cantidad).toFixed(1)}m³)
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-right font-bold text-slate-700 font-mono text-xs">S/ {v.monto_total.toFixed(2)}</td>
                            <td className="py-4 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                v.estado_pago?.toLowerCase().trim() === 'pagado' || v.estado_pago?.toLowerCase().trim() === 'pagado completo'
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {v.estado_pago}
                              </span>
                            </td>
                           <td className="py-4 text-center">
  <button
    onClick={() => handleAbrirModificarPago(v)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-xs rounded-full border border-indigo-100 hover:border-indigo-600 transition-all duration-200 shadow-sm group/btn cursor-pointer"
    title="Cambiar estado de deudas"
  >
    {/* Icono de billete hecho con SVG nativo (No requiere librerías externas) */}
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth="2" 
      stroke="currentColor" 
      className="w-4 h-4 transition-transform group-hover/btn:scale-110"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Zm13.5 6a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
    <span>Gestionar</span>
  </button>
</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RENDIMIENTO DE FLOTA */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  🚚 Rendimiento Mensual de Flota
                </h3>
                
                <div className="space-y-3">
                  {rankingChoferes.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-12 italic">No hay registros de choferes este mes.</p>
                  ) : (
                    rankingChoferes.map((ch) => (
                      <div key={ch.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-slate-300 transition-all">
                        <div>
                          <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">{ch.nombre}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700">{ch.viajesCount}</span> viajes | <span className="font-semibold text-slate-700">{ch.m3Count.toFixed(1)} m³</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-medium block">Total Recaudado</span>
                          <strong className="text-xs text-emerald-600 font-mono font-bold">S/ {ch.totalSoles.toFixed(2)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </>
        )}

        {/* MODAL EMERGENTE RE-DISEÑADO */}
        {viajeSeleccionado && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl transform transition-all scale-100 animate-in zoom-in-95">
              
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">💰 Regularizar Cuenta</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Cliente: <span className="font-semibold text-slate-700">{viajeSeleccionado.cliente_nombre}</span></p>
                </div>
                <button 
                  onClick={() => setViajeSeleccionado(null)} 
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 text-xs"
                >✕</button>
              </div>

              {/* DETALLES DE SALDO */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monto Total del Viaje:</span>
                  <strong className="text-slate-800 font-mono">S/ {viajeSeleccionado.monto_total.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Estado Actual:</span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold uppercase">{viajeSeleccionado.estado_pago}</span>
                </div>
              </div>

              {/* SELECCIÓN NUEVO ESTADO DE PAGO */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Modificar Estado del Pago Actual
                </label>
                <select
                  value={nuevoEstadoPago}
                  onChange={(e) => setNuevoEstadoPago(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="pendiente">Pendiente (Por Cobrar Completo)</option>
                  <option value="pagado">Pagado Completo (Ingresó a Caja)</option>
                  <option value="adelanto">Con Adelanto / Saldo a favor</option>
                </select>
              </div>

              {/* ACCIONES DEL MODAL */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViajeSeleccionado(null)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoModal}
                  onClick={handleGuardarEstadoPago}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all text-center"
                >
                  {guardandoModal ? 'Guardando...' : '💾 Confirmar Pago'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}