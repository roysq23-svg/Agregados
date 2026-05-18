import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // <-- Importamos el contexto real

export default function NavigationAdmin() {
  const navigate = useNavigate();
  const { logoutCompleto } = useAuth(); // <-- Jalamos la función de cierre real

  const handleCerrarSesion = async () => {
    if (window.confirm('¿Seguro que desea salir del panel de administración?')) {
      await logoutCompleto(); // <-- Limpia Supabase y los estados de React
      navigate('/login');
    }
  };

  const linkStyle = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
      isActive
        ? 'bg-emerald-500 text-slate-900 shadow-md shadow-emerald-500/20'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-950 border-b border-slate-800 px-6 z-50 flex items-center justify-between shadow-xl">
      
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-base italic">L</div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-wider text-white uppercase leading-none">AGREGADOS LLAGAS</span>
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Control de Gestión</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NavLink to="/admin/dashboard" className={linkStyle}>
          <i className="fa-solid fa-chart-pie text-xs"></i>
          <span>Dashboard Global</span>
        </NavLink>

        <NavLink to="/admin/rendicion" className={linkStyle}>
          <i className="fa-solid fa-truck-ramp-box text-xs"></i>
          <span>Rendición y Caja</span>
        </NavLink>
      </div>

      <button
        onClick={handleCerrarSesion}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 text-xs font-bold transition-all"
      >
        <i className="fa-solid fa-power-off"></i>
        <span>Cerrar Panel</span>
      </button>

    </nav>
  );
}