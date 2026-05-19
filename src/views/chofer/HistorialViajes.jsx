import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function HistorialViajes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [viajes, setViajes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchViajesYGastos();
  }, [fecha]);

  const fetchViajesYGastos = async () => {
    if (!profile?.uuid_auth) return;
    setLoading(true);
    try {
      const inicioDia = `${fecha}T00:00:00`;
      const finDia = `${fecha}T23:59:59`;

      const { data: dataViajes, error: errorV } = await supabase
        .from('movimientos')
        .select('*, detalle_movimientos(*)')
        .eq('usuario_id', profile.uuid_auth)
        .gte('creado_en', inicioDia)
        .lte('creado_en', finDia)
        .order('creado_en', { ascending: false });

      if (errorV) throw errorV;

      const { data: dataGastos, error: errorG } = await supabase
        .from('gastos_chofer')
        .select('*')
        .eq('usuario_id', profile.uuid_auth)
        .gte('creado_en', inicioDia)
        .lte('creado_en', finDia)
        .order('creado_en', { ascending: false });

      if (errorG) throw errorG;

      setViajes(dataViajes || []);
      setGastos(dataGastos || []);
    } catch (error) {
      console.error("Error al cargar historial personal:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarViaje = (viaje) => {
    navigate('/chofer/registrar', { state: { viajeAEditar: viaje } });
  };

  // ── Helpers de estado ─────────────────────────────────────
  const esPagado = (v) => {
    const s = v.estado_pago?.toLowerCase().trim();
    return s === 'pagado' || s === 'pagado completo';
  };

  const esAdelanto = (v) => {
    return v.estado_pago?.toLowerCase().trim() === 'adelanto';
  };

  // ── Cálculos correctos ────────────────────────────────────
  // Dinero cobrado = pagados completos + adelantos recibidos
  const dineroCobrado = viajes.reduce((acc, v) => {
    if (esPagado(v)) return acc + (parseFloat(v.monto_total) || 0);
    if (esAdelanto(v)) return acc + (parseFloat(v.monto_recibido) || 0);
    return acc;
  }, 0);

  // Deudas = solo el SALDO pendiente (monto_total - monto_recibido)
  const deudasPorCobrar = viajes.reduce((acc, v) => {
    if (esPagado(v)) return acc; // pagado completo, no debe nada
    const total = parseFloat(v.monto_total) || 0;
    const recibido = parseFloat(v.monto_recibido) || 0;
    return acc + (total - recibido); // saldo real pendiente
  }, 0);

  const totalGastosRuta = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
  const efectivoEnBolsillo = dineroCobrado - totalGastosRuta;

  // ── Proforma ──────────────────────────────────────────────
  const handleImprimirProforma = (viaje) => {
    const ventanaImpresion = window.open('', '_blank');
    const correlativo = viaje.id.toString().slice(-4).toUpperCase();
    const horaFormateada = new Date(viaje.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fechaFormateada = new Date(viaje.creado_en).toLocaleDateString('es-PE');

    const montoTotal = parseFloat(viaje.monto_total) || 0;
    const montoRecibido = parseFloat(viaje.monto_recibido) || 0;
    const saldoPendiente = Math.max(0, montoTotal - montoRecibido);
    const pagadoCompleto = esPagado(viaje);
    const conAdelanto = esAdelanto(viaje);

    // Cobrado real en esta proforma
    const cobradoMostrar = pagadoCompleto ? montoTotal : montoRecibido;
    const saldoMostrar = pagadoCompleto ? 0 : saldoPendiente;

    const filasMateriales = viaje.detalle_movimientos?.map(det => `
      <tr>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1;">${parseFloat(det.cantidad).toFixed(1)}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #cbd5e1;">m³</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-transform: uppercase;">${det.material_tipo}</td>
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;">S/ ${(det.precio_unitario || 0).toFixed(2)}</td>
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">S/ ${((det.cantidad || 0) * (det.precio_unitario || 0)).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    // Fila de adelanto solo si aplica
    const filaAdelanto = conAdelanto ? `
      <tr>
        <td class="lbl-t" style="color: #2563eb;">ADELANTO RECIBIDO</td>
        <td style="color: #2563eb; font-weight: bold;">S/ ${montoRecibido.toFixed(2)}</td>
      </tr>
    ` : '';

    const estadoLabel = pagadoCompleto ? 'PAGADO COMPLETO' : conAdelanto ? `CON ADELANTO (S/ ${montoRecibido.toFixed(2)})` : 'PENDIENTE';

    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Proforma Agregados Llagas</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
            .ticket-container { max-width: 800px; margin: 0 auto; border: 2px solid #1e3a8a; padding: 15px; }
            .header-table { border-collapse: collapse; margin-bottom: 15px; width: 100%; }
            .header-table td { border: 1px solid #1e3a8a; padding: 10px; }
            .logo-space { width: 28%; text-align: center; font-weight: bold; font-size: 24px; color: #1e3a8a; }
            .empresa-info { width: 47%; font-size: 11px; line-height: 1.4; }
            .empresa-info h1 { margin: 0 0 3px 0; font-size: 18px; color: #1e3a8a; font-weight: 900; letter-spacing: 0.5px; }
            .ruc-box { width: 25%; text-align: center; font-size: 13px; line-height: 1.5; }
            .ruc-box .title { font-weight: bold; background: #1e3a8a; color: white; padding: 4px; display: block; margin: 5px 0; font-size: 11px; }
            .datos-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .datos-table td { border: 1px solid #cbd5e1; padding: 8px; width: 25%; }
            .lbl { font-weight: bold; color: #1e3a8a; background: #f8fafc; width: 12% !important; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .items-table th { background: #1e3a8a; color: white; padding: 8px; border: 1px solid #1e3a8a; text-transform: uppercase; font-size: 11px; }
            .footer-container { width: 100%; display: flex; justify-content: flex-end; margin-top: 10px; }
            .totales-table { width: 40%; border-collapse: collapse; }
            .totales-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
            .totales-table .lbl-t { font-weight: bold; text-align: left; background: #f8fafc; }
            .totales-table .total-row { background: #1e3a8a; color: white; font-weight: bold; font-size: 14px; }
            .gracias { text-align: center; margin-top: 40px; font-size: 14px; font-weight: bold; color: #64748b; }
            .sistema-tag { text-align: center; margin-top: 60px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <table class="header-table">
              <tr>
                <td class="logo-space">
                  <div style="font-style: italic; font-weight: 900; font-size: 26px;">LLAGAS</div>
                  <div style="font-size: 7.5px; letter-spacing: 0.5px; margin-top: -3px; color: #64748b; font-weight: bold;">MAQUINARIA Y AGREGADOS</div>
                </td>
                <td class="empresa-info">
                  <h1>AGREGADOS LLAGAS</h1>
                  <span style="font-size: 11px; font-weight: bold; color: #334155;">Venta de agregados, demolición, desmonte y alquiler de maquinaria pesada</span><br>
                  <span style="display: block; margin-top: 4px;">Depósito: Costado del cementerio - Ciudad Eten</span>
                  <strong>Cel: 921377451 / 942981403</strong>
                </td>
                <td class="ruc-box">
                  RUC:<br><strong>20609118998</strong>
                  <span class="title">PROFORMA</span>
                  <strong>P001-${correlativo}</strong><br>
                  <span style="font-size: 9px; color: #64748b;">FEC: ${fechaFormateada}</span><br>
                  <span style="font-size: 9px; color: #64748b;">HORA: ${horaFormateada}</span>
                </td>
              </tr>
            </table>
            <table class="datos-table">
              <tr>
                <td class="lbl">CLIENTE:</td>
                <td style="text-transform: uppercase;">${viaje.cliente_nombre}</td>
                <td class="lbl">TELF./CEL.:</td>
                <td>${viaje.cliente_celular || '—'}</td>
              </tr>
              <tr>
                <td class="lbl">ESTADO:</td>
                <td style="font-weight: bold; color: ${pagadoCompleto ? '#10b981' : conAdelanto ? '#2563eb' : '#f59e0b'};">
                  ${estadoLabel}
                </td>
                <td class="lbl">REG.:</td>
                <td style="text-transform: lowercase;">${profile.usuario || 'chofer'}</td>
              </tr>
            </table>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%;">Cant.</th>
                  <th style="width: 8%;">Unid.</th>
                  <th style="width: 54%;">Descripción</th>
                  <th style="width: 15%;">P. Unit.</th>
                  <th style="width: 15%;">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${filasMateriales}
              </tbody>
            </table>
            <div class="footer-container">
              <table class="totales-table">
                <tr>
                  <td class="lbl-t">SUB TOTAL</td>
                  <td>S/ ${montoTotal.toFixed(2)}</td>
                </tr>
                ${filaAdelanto}
                <tr>
                  <td class="lbl-t" style="color: #10b981;">COBRADO</td>
                  <td style="color: #10b981; font-weight: bold;">S/ ${cobradoMostrar.toFixed(2)}</td>
                </tr>
                <tr>
                  <td class="lbl-t" style="color: #f59e0b;">SALDO PEND.</td>
                  <td style="color: #f59e0b; font-weight: bold;">S/ ${saldoMostrar.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                  <td style="text-align: left; background: #1e3a8a; color: white;">TOTAL</td>
                  <td>S/ ${montoTotal.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            <div class="gracias">¡Gracias por su preferencia!</div>
            <div class="sistema-tag">Documento generado por el sistema de despacho · Agregados Llagas</div>
          </div>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
    ventanaImpresion.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 pb-20">
      <div className="max-w-md mx-auto space-y-4">

        {/* FILTRO FECHA */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center gap-3">
          <div className="w-1/2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Mi Historial</span>
            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{profile?.nombre || 'Mi Caja'}</span>
          </div>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-emerald-600 font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* RESUMEN BILLETERA */}
        {!loading && (viajes.length > 0 || gastos.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl shadow-sm">
              <span className="text-[9px] uppercase font-bold text-emerald-700 block">Efectivo en Bolsillo</span>
              <span className="text-base font-black text-emerald-900 font-mono block mt-0.5">S/ {efectivoEnBolsillo.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Restados S/ {totalGastosRuta.toFixed(2)} de gastos</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl shadow-sm">
              <span className="text-[9px] uppercase font-bold text-amber-700 block">Saldo por Cobrar</span>
              <span className="text-base font-black text-amber-900 font-mono block mt-0.5">S/ {deudasPorCobrar.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Saldo real pendiente</span>
            </div>
          </div>
        )}

        {/* CONTENIDO */}
        {loading ? (
          <p className="text-center text-emerald-600 animate-pulse text-xs py-10 font-bold">Sincronizando mi caja...</p>
        ) : (
          <div className="space-y-4">

            {/* GASTOS */}
            {gastos.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">💸 Mis Gastos del Día</span>
                <div className="divide-y divide-slate-100 text-xs">
                  {gastos.map((g) => (
                    <div key={g.id} className="flex justify-between py-2.5 items-center">
                      <span className="text-slate-600 uppercase text-[11px] font-medium">{g.descripcion}</span>
                      <strong className="text-red-600 font-mono">S/ {g.monto.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIAJES */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-1">🚚 Mis Viajes Realizados</span>
              {viajes.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-xs bg-white border border-dashed border-slate-300 rounded-2xl shadow-sm">
                  No tienes despachos registrados hoy.
                </p>
              ) : (
                viajes.map((viaje) => {
                  const pagado = esPagado(viaje);
                  const adelanto = esAdelanto(viaje);
                  const montoTotal = parseFloat(viaje.monto_total) || 0;
                  const montoRecibido = parseFloat(viaje.monto_recibido) || 0;
                  const saldo = Math.max(0, montoTotal - montoRecibido);

                  return (
                    <div key={viaje.id} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight">{viaje.cliente_nombre}</h3>
                          <p className="text-[9px] text-slate-400 font-bold font-mono mt-0.5">
                            🕒 {new Date(viaje.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEditarViaje(viaje)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-all border border-slate-200"
                            title="Editar viaje"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                            pagado
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : adelanto
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {pagado ? 'PAGADO' : adelanto ? 'ADELANTO' : 'PENDIENTE'}
                          </span>
                        </div>
                      </div>

                      {/* MATERIALES */}
                      <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                        {viaje.detalle_movimientos?.map((det, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] items-center">
                            <span className="text-slate-500 font-medium uppercase">{det.material_tipo} ({parseFloat(det.cantidad).toFixed(1)} m³)</span>
                            <span className="text-slate-700 font-bold font-mono">S/ {((det.cantidad || 0) * (det.precio_unitario || 0)).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* RESUMEN PAGO */}
                      <div className={`rounded-xl px-3 py-2.5 border text-xs space-y-1 ${
                        pagado ? 'bg-emerald-50 border-emerald-200' :
                        adelanto ? 'bg-blue-50 border-blue-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-500">Total despacho</span>
                          <span className="font-mono text-slate-800">S/ {montoTotal.toFixed(2)}</span>
                        </div>
                        {(adelanto || pagado) && montoRecibido > 0 && (
                          <div className="flex justify-between font-bold">
                            <span className="text-emerald-600">{pagado ? 'Cobrado' : 'Adelanto recibido'}</span>
                            <span className="font-mono text-emerald-700">S/ {pagado ? montoTotal.toFixed(2) : montoRecibido.toFixed(2)}</span>
                          </div>
                        )}
                        {!pagado && (
                          <div className="flex justify-between font-black pt-1 border-t border-current border-opacity-20">
                            <span className={adelanto ? 'text-amber-700' : 'text-amber-700'}>⏳ Saldo pendiente</span>
                            <span className={`font-mono ${adelanto ? 'text-amber-700' : 'text-amber-700'}`}>S/ {saldo.toFixed(2)}</span>
                          </div>
                        )}
                        {pagado && (
                          <div className="flex justify-between font-black pt-1 border-t border-emerald-200">
                            <span className="text-emerald-700">✅ Cobrado completo</span>
                            <span className="font-mono text-emerald-700">S/ {montoTotal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {/* BOTÓN IMPRIMIR */}
                      <button
                        onClick={() => handleImprimirProforma(viaje)}
                        className="w-full mt-1 py-2 bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-200 hover:border-emerald-600 flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 transition-transform group-hover:scale-110">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.821V21h10.56v-7.179m-10.56 0H3.722a.75.75 0 0 1-.722-.75v-4.5a.75.75 0 0 1 .722-.75h16.556a.75.75 0 0 1 .722.75v4.5a.75.75 0 0 1-.722.75h-3.002m-10.556 0h10.556M6.72 13.821V7.5a.75.75 0 0 1 .722-.75h9.111a.75.75 0 0 1 .722.75v6.321m-10.556 0h10.556M16.5 10.5h.008v.008H16.5V10.5Z" />
                        </svg>
                        <span>Imprimir Boleta</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}