import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // <-- Verifica si necesitas un punto más: '../../context/AuthContext'
import logoLlagas from '../assets/logo-llagas.png'; 

export default function NavigationChofer() {
  // NOTA: Si en tu AuthContext la función se llama 'logout', cambia aquí 'signOut' por 'logout'
  const { signOut } = useAuth(); 
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      console.log("Intentando cerrar sesión...");
      
      // Si usas signOut en tu AuthContext:
      if (signOut) {
        await signOut();
      } else {
        console.warn("La función signOut no se encontró en el AuthContext. Verifica el nombre.");
      }
      
      // Forzamos la redirección manual al login
      navigate('/login'); 
    } catch (error) {
      alert('Error al cerrar sesión: ' + error.message);
    }
  };

  return (
    <nav className="w-full bg-white border-b border-slate-200/80 fixed top-0 left-0 right-0 z-50 shadow-sm px-3 py-2 flex items-center justify-between gap-2">
      
      {/* LOGO */}
      <div className="flex items-center shrink-0">
        <img 
          src={logoLlagas} 
          alt="Llagas" 
          className="h-8 w-auto object-contain" 
        />
      </div>

      {/* PESTAÑAS */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
        <NavLink
          to="/chofer/registrar"
          className={({ isActive }) =>
            `px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Ruta
        </NavLink>

        <NavLink
          to="/chofer/gastos"
          className={({ isActive }) =>
            `px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Gastos
        </NavLink>

        <NavLink
          to="/chofer/historial"
          className={({ isActive }) =>
            `px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Historial
        </NavLink>
      </div>

      {/* BOTÓN CERRAR SESIÓN */}
      <button
        onClick={handleLogout}
        type="button"
        title="Cerrar Sesión"
        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0"
      >
        <span>🚪</span>
        <span>Salir</span> 
      </button>

    </nav>
  );
}