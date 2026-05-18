import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Vistas
import Login from './views/auth/Login';
import RegistrarDespacho from './views/chofer/RegistrarDespacho';
import ControlGastos from './views/chofer/ControlGastos';
import HistorialViajes from './views/chofer/HistorialViajes';
import Dashboard from './views/admin/Dashboard';
import RendicionChofer from './views/admin/RendicionChofer';

// Layouts
import LayoutChofer from './components/LayoutChofer';
import LayoutAdmin from './components/LayoutAdmin';

// Componente Guardián de Rutas Estricto
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400 font-medium animate-pulse">
        Cargando seguridad...
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && !allowedRoles.includes(profile?.rol)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Enrutador Inteligente por Rol (Corregido para manejar el loading)
const HomeRedirect = () => {
  const { user, profile, loading } = useAuth();
  
  // Si el AuthContext está consultando a Supabase, esperamos aquí
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400 font-medium animate-pulse">
        Cargando seguridad...
      </div>
    );
  }

  // Si no hay usuario logueado en absoluto, directo al login
  if (!user) return <Navigate to="/login" replace />;
  
  // Si hay usuario pero el perfil aún se está recuperando, esperamos un momento
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400 font-medium animate-pulse">
        Cargando perfil...
      </div>
    );
  }
  
  // Redirección limpia según el rol real de la base de datos
  if (profile.rol === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (profile.rol === 'chofer') return <Navigate to="/chofer/registrar" replace />;
  
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta Pública */}
          <Route path="/login" element={<Login />} />
          
          {/* CORREGIDO: HomeRedirect ahora maneja su propia lógica sin pisarse con ProtectedRoute */}
          <Route path="/" element={<HomeRedirect />} />

          {/* GRUPO DE RUTAS DEL CHOFER (Con Layout y Barra Superior Fija) */}
          <Route element={<ProtectedRoute allowedRoles={['chofer']}><LayoutChofer /></ProtectedRoute>}>
            <Route path="/chofer/registrar" element={<RegistrarDespacho />} />
            <Route path="/chofer/gastos" element={<ControlGastos />} />
            <Route path="/chofer/historial" element={<HistorialViajes />} />
          </Route>

          {/* GRUPO DE RUTAS DEL ADMINISTRADOR (Con Layout y Menú Corporativo Fijo) */}
          <Route element={<ProtectedRoute allowedRoles={['admin']}><LayoutAdmin /></ProtectedRoute>}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/rendicion" element={<RendicionChofer />} />
          </Route>

          {/* Redirección por defecto para evitar bucles con URLs extrañas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;