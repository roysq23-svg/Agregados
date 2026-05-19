import React, { useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function ControlGastos() {
  const { profile } = useAuth();
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Combustible');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setSuccessMsg('');

    try {
      const detalleFinal = `[${categoria}] ${descripcion.trim() || 'Gasto de ruta'}`;

      const { error } = await supabase
        .from('gastos_chofer')
        .insert({
          usuario_id: profile.uuid_auth, // ✅ corregido: era chofer_id
          descripcion: detalleFinal,
          monto: parseFloat(monto)
        });

      if (error) throw error;

      setSuccessMsg('✅ Gasto registrado correctamente en caja chica.');
      setMonto('');
      setDescripcion('');
    } catch (error) {
      alert('Error al registrar gasto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 pb-24 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">

        {/* ENCABEZADO */}
        <div className="text-center py-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center justify-center gap-2">
            <span>💰</span> Control de Gastos
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Registro de caja chica en ruta
          </p>
        </div>

        {/* NOTIFICACIÓN DE ÉXITO */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
            {successMsg}
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleRegistrarGasto} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-5">

          {/* MONTO */}
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
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-lg font-mono transition-all shadow-inner"
              />
            </div>
          </div>

          {/* CATEGORÍAS */}
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
                    className={`py-3 px-3 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer ${
                      esActivo
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 scale-[1.02]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="tracking-wide text-[11px] text-center">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DETALLE */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Detalle / Descripción (Opcional)
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Menú grifo, compra de perno..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all shadow-inner"
            />
          </div>

          {/* BOTÓN */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar Gasto de Ruta</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}