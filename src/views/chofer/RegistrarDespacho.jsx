import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Quitar flechitas de inputs number
const noSpinStyle = {
  MozAppearance: 'textfield',
  WebkitAppearance: 'none',
};

export default function RegistrarDespacho() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const viajeAEditar = location.state?.viajeAEditar || null;

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCelular, setClienteCelular] = useState('');
  const [estadoPago, setEstadoPago] = useState('pendiente');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [materiales, setMateriales] = useState([{ material_tipo: '', cantidad: '', precio_unitario: '' }]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [totalM3Hoy, setTotalM3Hoy] = useState(0);

  useEffect(() => {
    if (profile?.uuid_auth) fetchTotalM3Hoy();
  }, [profile]);

  const fetchTotalM3Hoy = async () => {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('movimientos')
      .select('cantidad_cubos')
      .eq('usuario_id', profile.uuid_auth)
      .gte('creado_en', hoyInicio.toISOString())
      .lte('creado_en', hoyFin.toISOString());

    if (data) {
      const total = data.reduce((sum, v) => sum + (parseFloat(v.cantidad_cubos) || 0), 0);
      setTotalM3Hoy(total);
    }
  };

  useEffect(() => {
    if (viajeAEditar) {
      setClienteNombre(viajeAEditar.cliente_nombre || '');
      setClienteCelular(viajeAEditar.cliente_celular || '');
      setEstadoPago(viajeAEditar.estado_pago || 'pendiente');
      setMontoRecibido(viajeAEditar.monto_recibido ? String(viajeAEditar.monto_recibido) : '');

      if (viajeAEditar.detalle_movimientos && viajeAEditar.detalle_movimientos.length > 0) {
        setMateriales(viajeAEditar.detalle_movimientos.map(det => ({
          material_tipo: det.material_tipo,
          cantidad: det.cantidad.toString(),
          precio_unitario: det.precio_unitario.toString()
        })));
      }
    }
  }, [viajeAEditar]);

  const handleMaterialChange = (index, field, value) => {
    const nuevosMateriales = [...materiales];
    nuevosMateriales[index][field] = value;
    setMateriales(nuevosMateriales);
  };

  const agregarMaterialRow = () => {
    setMateriales([...materiales, { material_tipo: '', cantidad: '', precio_unitario: '' }]);
  };

  const eliminarMaterialRow = (index) => {
    if (materiales.length > 1) {
      setMateriales(materiales.filter((_, i) => i !== index));
    }
  };

  const totalM3 = materiales.reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);
  const totalDinero = materiales.reduce((sum, item) => {
    const cant = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio_unitario) || 0;
    return sum + (cant * precio);
  }, 0);

  const adelanto = parseFloat(montoRecibido) || 0;
  const saldoPendiente = Math.max(0, totalDinero - adelanto);

  const handleEstadoChange = (val) => {
    setEstadoPago(val);
    if (val !== 'adelanto') setMontoRecibido('');
  };

  const handleRegistrarSalida = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setSuccessMsg('');

    const montoFinal = estadoPago === 'pagado'
      ? totalDinero
      : estadoPago === 'adelanto'
      ? adelanto
      : 0;

    try {
      if (viajeAEditar) {
        const { error: errorUpdate } = await supabase
          .from('movimientos')
          .update({
            cliente_nombre: clienteNombre.trim(),
            cliente_celular: clienteCelular.trim() || null,
            estado_pago: estadoPago,
            monto_total: totalDinero,
            monto_recibido: montoFinal > 0 ? montoFinal : null,
            cantidad_cubos: totalM3
          })
          .eq('id', viajeAEditar.id);

        if (errorUpdate) throw errorUpdate;

        await supabase.from('detalle_movimientos').delete().eq('movimiento_id', viajeAEditar.id);

        const detallesInsertar = materiales.map(item => ({
          movimiento_id: viajeAEditar.id,
          material_tipo: item.material_tipo,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario)
        }));

        const { error: errorDetalles } = await supabase.from('detalle_movimientos').insert(detallesInsertar);
        if (errorDetalles) throw errorDetalles;

        setSuccessMsg('✅ ¡Viaje actualizado correctamente!');
        setTimeout(() => navigate('/chofer/historial'), 1500);

      } else {
        const { data: inserted, error: errorInsert } = await supabase
          .from('movimientos')
          .insert({
            usuario_id: profile.uuid_auth,
            cliente_nombre: clienteNombre.trim(),
            cliente_celular: clienteCelular.trim() || null,
            estado_pago: estadoPago,
            monto_total: totalDinero,
            monto_recibido: montoFinal > 0 ? montoFinal : null,
            cantidad_cubos: totalM3
          })
          .select().single();

        if (errorInsert) throw errorInsert;

        const detallesInsertar = materiales.map(item => ({
          movimiento_id: inserted.id,
          material_tipo: item.material_tipo,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario)
        }));

        const { error: errorDetalles } = await supabase
          .from('detalle_movimientos')
          .insert(detallesInsertar);

        if (errorDetalles) throw errorDetalles;

        setSuccessMsg('✅ ¡Despacho registrado con éxito!');
        setClienteNombre('');
        setClienteCelular('');
        setMontoRecibido('');
        setEstadoPago('pendiente');
        setMateriales([{ material_tipo: '', cantidad: '', precio_unitario: '' }]);
        fetchTotalM3Hoy();
      }

    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 pb-24 flex flex-col items-center">
        <div className="w-full max-w-md space-y-4">

          {/* ENCABEZADO */}
          <div className="text-center py-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {viajeAEditar ? '✏️ Modificar Despacho' : '📝 Registrar Despacho'}
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
              {viajeAEditar ? `Editando viaje de ${viajeAEditar.cliente_nombre}` : 'Generación de Proforma Digital'}
            </p>
          </div>

          {/* BANNER TOTAL M3 DEL DÍA */}
          {!viajeAEditar && (
            <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">M³ acumulados hoy</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{totalM3Hoy.toFixed(1)} m³</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Este despacho</p>
                <p className="text-lg font-black text-white font-mono mt-0.5">+{totalM3.toFixed(1)} m³</p>
              </div>
            </div>
          )}

          {/* MENSAJE DE ÉXITO */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleRegistrarSalida} className="space-y-4">

            {/* CLIENTE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cliente / Razón Social
                </label>
                <input
                  type="text"
                  required
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Manuela Ferretería"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Celular del Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={clienteCelular}
                  onChange={(e) => setClienteCelular(e.target.value)}
                  placeholder="Ej: 971377451"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                />
              </div>
            </div>

            {/* MATERIALES */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                🛠️ Materiales del Viaje
              </span>

              {materiales.map((item, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5 relative">
                  {materiales.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarMaterialRow(index)}
                      className="absolute top-3 right-3 text-xs font-bold text-red-600 hover:text-red-500 cursor-pointer bg-red-50 px-2 py-1 rounded-md border border-red-100 transition-all"
                    >
                      ✕ Quitar
                    </button>
                  )}
                  <span className="text-xs font-black text-emerald-600 font-mono block">ITEM #{index + 1}</span>

                  <input
                    type="text"
                    required
                    value={item.material_tipo}
                    onChange={(e) => handleMaterialChange(index, 'material_tipo', e.target.value)}
                    placeholder="Material (Ej: Arena fina, Piedra, Afirmado)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cantidad (m³)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={item.cantidad}
                        onChange={(e) => handleMaterialChange(index, 'cantidad', e.target.value)}
                        placeholder="0.00"
                        style={noSpinStyle}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Precio x m³ (S/)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={item.precio_unitario}
                        onChange={(e) => handleMaterialChange(index, 'precio_unitario', e.target.value)}
                        placeholder="S/"
                        style={noSpinStyle}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={agregarMaterialRow}
                className="w-full py-3 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-dashed border-emerald-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>➕</span> Agregar otro material
              </button>
            </div>

            {/* TOTALES */}
            <div className="bg-emerald-600 border border-emerald-700 p-4 rounded-2xl text-center shadow-md text-white">
              <p className="text-2xl font-black font-mono">Total: S/ {totalDinero.toFixed(2)}</p>
              <p className="text-[11px] font-bold text-emerald-100 mt-0.5 uppercase tracking-wider">
                {totalM3.toFixed(1)} m³ totales en el despacho
              </p>
            </div>

            {/* ESTADO DE PAGO */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                💰 Estado de Pago
              </span>

              <select
                value={estadoPago}
                onChange={(e) => handleEstadoChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="pendiente">⏳ Pago Pendiente</option>
                <option value="adelanto">💙 Pago con Adelanto</option>
                <option value="pagado">✅ Pago Completo</option>
              </select>

              {/* Campo adelanto — solo si eligió "adelanto" */}
              {estadoPago === 'adelanto' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Monto Adelantado (S/)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      placeholder="Ej: 200.00"
                      style={noSpinStyle}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-blue-200 text-slate-900 placeholder-slate-400 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                    />
                  </div>

                  {adelanto > 0 && totalDinero > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500 uppercase">Total despacho</span>
                        <span className="font-mono text-slate-800">S/ {totalDinero.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-blue-600 uppercase">Adelanto recibido</span>
                        <span className="font-mono text-blue-700">− S/ {adelanto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black pt-2 border-t border-blue-200">
                        <span className="text-amber-700">⏳ Saldo pendiente</span>
                        <span className="font-mono text-amber-700">S/ {saldoPendiente.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTÓN */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 text-white font-black text-center rounded-xl shadow-md transition-all text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                viajeAEditar
                  ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
              }`}
            >
              {loading ? 'Procesando...' : viajeAEditar ? '💾 Actualizar Cambios' : '🚚 Registrar Despacho'}
            </button>
          </form>

        </div>
      </div>
    </>
  );
}