import React, { useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const noSpinStyle = { MozAppearance: 'textfield', WebkitAppearance: 'none' };

export default function ControlGastos() {
  const { profile } = useAuth();

  // ── Pestaña activa ─────────────────────────────────────
  const [tab, setTab] = useState('gasto'); // 'gasto' | 'ingreso'

  // ── Estado Gastos ──────────────────────────────────────
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Combustible');
  const [descripcion, setDescripcion] = useState('');
  const [loadingGasto, setLoadingGasto] = useState(false);
  const [successGasto, setSuccessGasto] = useState('');

  // ── Estado Ingresos Extra ──────────────────────────────
  const [montoIngreso, setMontoIngreso] = useState('');
  const [observacion, setObservacion] = useState('');
  const [loadingIngreso, setLoadingIngreso] = useState(false);
  const [successIngreso, setSuccessIngreso] = useState('');

  // ── Registrar Gasto ────────────────────────────────────
  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    if (loadingGasto) return;
    setLoadingGasto(true);
    setSuccessGasto('');
    try {
      const detalleFinal = `[${categoria}] ${descripcion.trim() || 'Gasto de ruta'}`;
      const { error } = await supabase
        .from('gastos_chofer')
        .insert({
          usuario_id: profile.uuid_auth,
          descripcion: detalleFinal,
          monto: parseFloat(monto)
        });
      if (error) throw error;
      setSuccessGasto('✅ Gasto registrado correctamente.');
      setMonto('');
      setDescripcion('');
    } catch (error) {
      alert('Error al registrar gasto: ' + error.message);
    } finally {
      setLoadingGasto(false);
    }
  };

  // ── Registrar Ingreso Extra ────────────────────────────
  const handleRegistrarIngreso = async (e) => {
    e.preventDefault();
    if (loadingIngreso) return;
    setLoadingIngreso(true);
    setSuccessIngreso('');
    try {
      const { error } = await supabase
        .from('ingresos_extra')
        .insert({
          usuario_id: profile.uuid_auth,
          monto: parseFloat(montoIngreso),
          observacion: observacion.trim() || 'Abono de deuda anterior'
        });
      if (error) throw error;
      setSuccessIngreso('✅ Ingreso extra registrado correctamente.');
      setMontoIngreso('');
      setObservacion('');
    } catch (error) {
      alert('Error al registrar ingreso: ' + error.message);
    } finally {
      setLoadingIngreso(false);
    }
  };

  return (
    <>
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 pb-24 flex flex-col items-center">
        <div className="w-full max-w-md space-y-5">

          {/* ENCABEZADO */}
          <div className="text-center py-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center justify-center gap-2">
              <span>💰</span> Control de Caja
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
              Gastos e ingresos en ruta
            </p>
          </div>

          {/* TABS */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setTab('gasto'); setSuccessGasto(''); setSuccessIngreso(''); }}
              className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                tab === 'gasto'
                  ? 'bg-red-600 border-red-600 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              💸 Registrar Gasto
            </button>
            <button
              type="button"
              onClick={() => { setTab('ingreso'); setSuccessGasto(''); setSuccessIngreso(''); }}
              className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                tab === 'ingreso'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              💵 Ingreso Extra
            </button>
          </div>

          {/* ── FORMULARIO GASTO ── */}
          {tab === 'gasto' && (
            <>
              {successGasto && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
                  {successGasto}
                </div>
              )}
              <form onSubmit={handleRegistrarGasto} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-5">

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Monto del Gasto (S/)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-base font-mono">S/</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="0.00"
                      style={noSpinStyle}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-black focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white text-lg font-mono transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Categoría
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Combustible', label: 'Combustible', icon: '⛽' },
                      { id: 'Comida', label: 'Comida', icon: '🍲' },
                      { id: 'Bebida', label: 'Bebida', icon: '🥤' },
                      { id: 'Repuestos / Otros', label: 'Repuestos / Otros', icon: '⚙️' }
                    ].map((cat) => {
                      const esActivo = categoria === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoria(cat.id)}
                          className={`py-3 px-3 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            esActivo
                              ? 'bg-red-600 border-red-600 text-white shadow-md scale-[1.02]'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-lg">{cat.icon}</span>
                          <span className="tracking-wide text-[11px] text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Detalle / Descripción (Opcional)
                  </label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej: Menú grifo, compra de perno..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white text-sm transition-all shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingGasto}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingGasto ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Guardando...</span></>
                  ) : (
                    <><span>💾</span><span>Guardar Gasto</span></>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── FORMULARIO INGRESO EXTRA ── */}
          {tab === 'ingreso' && (
            <>
              {successIngreso && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
                  {successIngreso}
                </div>
              )}

              {/* AVISO INFORMATIVO */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">💡 ¿Para qué sirve esto?</p>
                <p className="text-xs text-blue-600 font-medium leading-relaxed">
                  Úsalo cuando recibas dinero de deudas anteriores que no están registradas en la app. 
                  Se sumará a tu dinero total del día.
                </p>
              </div>

              <form onSubmit={handleRegistrarIngreso} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-5">

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Monto Recibido (S/)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-emerald-500 font-bold text-base font-mono">S/</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={montoIngreso}
                      onChange={(e) => setMontoIngreso(e.target.value)}
                      placeholder="0.00"
                      style={noSpinStyle}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-lg font-mono transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Observación — ¿De dónde viene este dinero?
                  </label>
                  <textarea
                    required
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Ej: Abono de Juan Ríos por deuda de la semana pasada, 3 viajes de arena..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all shadow-inner resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingIngreso}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingIngreso ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Guardando...</span></>
                  ) : (
                    <><span>💵</span><span>Guardar Ingreso Extra</span></>
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}