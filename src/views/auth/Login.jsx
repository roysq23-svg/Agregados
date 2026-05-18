import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
// Importa tu logotipo aquí (ajusta la ruta según dónde guardaste la imagen)
import logoLlagas from '../../assets/logo-llagas.png'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;
      navigate('/');
    } catch (error) {
      if (error.message === 'Invalid login credentials') {
        setErrorMsg('El correo o la contraseña son incorrectos.');
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // CAMBIO DE FONDO GENERAL: De bg-slate-900 oscuro a un sutil y fresco gris claro bg-slate-50
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      
      {/* Tarjeta contenedora con fondo blanco limpio, bordes suaves y sombra sutil */}
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-200/60">
        
        {/* Encabezado con tu Logotipo Oficial */}
        <div className="text-center flex flex-col items-center">
          <div className="mb-4 transition-transform hover:scale-105 duration-200">
            <img 
              src={logoLlagas} 
              alt="Logo Llagas Maquinaria y Agregados" 
              className="h-20 w-auto object-contain drop-shadow-sm"
              onError={(e) => {
                // Por si acaso la ruta falle en lo que configuras el archivo, mantendrá un respaldo estético
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline-flex';
              }}
            />
            {/* Respaldo por si no encuentra la imagen temporalmente */}
            <div className="hidden items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 text-3xl font-black">
              LL
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
            Agregados Llagas
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Control de Despachos y Logística de Ruta
          </p>
        </div>

        {/* Mensaje de Error estilizado en claro */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold p-3.5 rounded-xl text-center shadow-sm">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Formulario con inputs modernos en Modo Claro */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          {/* Botón de acción con color corporativo esmeralda */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Validando credenciales...
                </span>
              ) : (
                'INICIAR SESIÓN'
              )}
            </button>
          </div>
        </form>

      </div>
      
      {/* Footer sutil fuera de la tarjeta */}
      <p className="mt-4 text-[11px] text-slate-400 font-medium">
        © {new Date().getFullYear()} Llagas Maquinaria y Agregados. Todos los derechos reservados.
      </p>
    </div>
  );
}