import React from 'react';
import { Outlet } from 'react-router-dom';
import NavigationChofer from './NavigationChofer';

export default function LayoutChofer() {
  return (
    <div className="relative min-h-screen bg-slate-900">
      {/* Menú Superior Fijo */}
      <NavigationChofer />
      
      {/* El contenedor ahora empuja el contenido hacia abajo para que no lo tape la barra */}
      <div className="pt-16">
        <Outlet />
      </div>
    </div>
  );
}