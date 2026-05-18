import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function RegistrarDespacho() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const viajeAEditar = location.state?.viajeAEditar || null;

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCelular, setClienteCelular] = useState('');
  const [estadoPago, setEstadoPago] = useState('pendiente');
  const [materiales, setMateriales] = useState([{ material_tipo: '', cantidad: '', precio_unitario: '' }]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (viajeAEditar) {
      setClienteNombre(viajeAEditar.cliente_nombre || '');
      setClienteCelular(viajeAEditar.cliente_celular || '');
      setEstadoPago(viajeAEditar.estado_pago || 'pendiente');
      
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

  const handleRegistrarSalida = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setSuccessMsg('');

    try {
      if (viajeAEditar) {
        const { error: errorUpdate } = await supabase
          .from('movimientos')
          .update({
            cliente_nombre: clienteNombre.trim(),
            cliente_celular: clienteCelular.trim() || null,
            estado_pago: estadoPago,
            monto_total: totalDinero,
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
        
        setTimeout(() => {
          navigate('/chofer/historial');
        }, 1500);

      } else {
        const { data: inserted, error: errorInsert } = await supabase
          .from('movimientos')
          .insert({
            usuario_id: profile.uuid_auth,
            cliente_nombre: clienteNombre.trim(),
            cliente_celular: clienteCelular.trim() || null,
            estado_pago: estadoPago,
            monto_total: totalDinero,
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
        setMateriales([{ material_tipo: '', cantidad: '', precio_unitario: '' }]);
      }

    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 pb-24 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        
        {/* ENCABEZADO MEJORADO EN MODO CLARO */}
        <div className="text-center py-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            {viajeAEditar ? '✏️ Modificar Despacho' : '📝 Registrar Despacho'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            {viajeAEditar ? `Editando viaje de ${viajeAEditar.cliente_nombre}` : 'Generación de Proforma Digital'}
          </p>
        </div>

        {/* MENSAJE DE ÉXITO */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegistrarSalida} className="space-y-4">
          
          {/* SECCIÓN CLIENTE */}
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

          {/* SECCIÓN MATERIALES DINÁMICOS */}
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
                
                <div>
                  <input
                    type="text"
                    required
                    value={item.material_tipo}
                    onChange={(e) => handleMaterialChange(index, 'material_tipo', e.target.value)}
                    placeholder="Material (Ej: Arena fina, Piedra, Afirmado)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

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

          {/* CUADRO VIVOS DE TOTALES */}
          <div className="bg-emerald-600 border border-emerald-700 p-4.5 rounded-2xl text-center shadow-md text-white">
            <p className="text-2xl font-black font-mono">Total: S/ {totalDinero.toFixed(2)}</p>
            <p className="text-[11px] font-bold text-emerald-100 mt-0.5 uppercase tracking-wider">
              {totalM3.toFixed(1)} m³ totales en el despacho
            </p>
          </div>

          {/* SECCIÓN ESTADO PAGO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Estado Inicial de Pago
            </label>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="pendiente">⏳ Pendiente por Cobrar</option>
              <option value="pagado">✅ Pagado Completo</option>
            </select>
          </div>

          {/* BOTÓN DE ACCIÓN CAMBIA DE COLOR SEGÚN CONTEXTO (Mantiene Amber si edita, Emerald si crea) */}
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
  );
}