import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let initialized = false; // 👈 flag

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await buscarPerfil(currentUser);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error inicializando usuario:", error);
      setLoading(false);
    } finally {
      initialized = true; // 👈 marca que ya terminó
    }
  };

  checkUser();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!initialized) return; // 👈 ignora el primer disparo si checkUser no terminó
    
    const currentUser = session?.user ?? null;
    setUser(currentUser);
    
    if (currentUser) {
      await buscarPerfil(currentUser);
    } else {
      setProfile(null);
      setLoading(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);

  // Función inteligente amarrada al correo real de tu administración
  const buscarPerfil = async (authUser) => {
    if (!authUser) return;
    try {
      const email = authUser.email || '';
      const nombreUsuario = email ? email.split('@')[0] : '';

      // =========================================================================
      // REGLA ABSOLUTA PARA GISERA - ADMINISTRADORA DE AGREGADOS LLAGAS
      // =========================================================================
      if (email === 'giselaf@gmail.com' || email.startsWith('admin') || nombreUsuario === 'admin') {
        setProfile({
          id: authUser.id,
          usuario: nombreUsuario,
          rol: 'admin',
          uuid_auth: authUser.id
        });
        return; // El finally de abajo se encargará del setLoading(false)
      }

      // Si no es el correo de Gisela, lo tratamos como chofer y buscamos en la tabla
      const { data: choferes, error: choferError } = await supabase
        .from('choferes')
        .select('*')
        .eq('usuario', nombreUsuario);

      if (choferError) console.error("Error en query de choferes:", choferError.message);

      if (choferes && choferes.length > 0) {
        setProfile({
          ...choferes[0],
          rol: 'chofer',
          uuid_auth: authUser.id
        });
      } else {
        // Fallback por si acaso para que no se congele la app
        setProfile({
          id: authUser.id,
          usuario: nombreUsuario,
          rol: 'chofer',
          uuid_auth: authUser.id
        });
      }

    } catch (err) {
      console.error("Error crítico en buscarPerfil:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN PARA CERRAR SESIÓN LIMPIANDO TODO
  const logoutCompleto = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logoutCompleto, refrescarPerfil: () => buscarPerfil(user) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);