import React from 'react';
import { Outlet } from 'react-router-dom';
import NavigationAdmin from './NavigationAdmin';

export default function LayoutAdmin() {
  return (
    <div className="relative min-h-screen bg-slate-900">
      {/* Barra de navegación superior del administrador */}
      <NavigationAdmin />
      
      {/* El contenido se desplaza hacia abajo 16 unidades para no quedar oculto */}
      <div className="pt-16">
        <Outlet />
      </div>
    </div>
  );
}