import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // <-- Ajustamos la ruta para importar useAuth
import logoLlagas from '../assets/logo-llagas.png'; // <-- Importamos tu logotipo oficial

export default function NavigationChofer() {
  const { signOut } = useAuth(); // <-- Obtenemos la función de cerrar sesión del contexto
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login'); // Redirige al login tras cerrar sesión顺利
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  return (
    <nav className="w-full bg-white border-b border-slate-200/80 fixed top-0 left-0 right-0 z-50 shadow-sm px-4 py-2 flex items-center justify-between">
      
      {/* LOGO OFICIAL REEMPLAZADO */}
      <div className="flex items-center gap-2">
        <img 
          src={logoLlagas} 
          alt="Llagas Maquinaria y Agregados" 
          className="h-9 w-auto object-contain" // Altura controlada para que encaje perfecto en la barra
        />
      </div>

      {/* SEGMENTED CONTROL / SELECTOR DE PESTAÑAS (Mantiene el estilo claro) */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
        <NavLink
          to="/chofer/registrar"
          className={({ isActive }) =>
            `px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Ruta
        </NavLink>

        <NavLink
          to="/chofer/gastos"
          className={({ isActive }) =>
            `px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Gastos
        </NavLink>

        <NavLink
          to="/chofer/historial"
          className={({ isActive }) =>
            `px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          Historial
        </NavLink>
      </div>

      {/* BOTÓN CERRAR SESIÓN (ALINEADO A LA DERECHA) */}
      <button
        onClick={handleLogout}
        title="Cerrar Sesión"
        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
      >
        <span>🚪</span>
        <span className="hidden sm:inline">Salir</span>
      </button>

    </nav>
  );
}