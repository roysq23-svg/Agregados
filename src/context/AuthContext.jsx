import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

const buscarPerfil = async (authUser) => {
  if (!authUser) return;
  try {
    const email = authUser.email || '';

    // Admin hardcodeado
    if (email === 'giselaf@gmail.com') {
      setProfile({
        id: authUser.id,
        usuario: 'giselaf',
        rol: 'admin',
        uuid_auth: authUser.id
      });
      return;
    }

    // Busca en choferes usando el mismo UUID de auth
    const { data: chofer } = await supabase
      .from('choferes')
      .select('*')
      .eq('id', authUser.id) // ✅ el id de choferes = auth.users.id
      .single();

    if (chofer) {
      setProfile({ ...chofer, rol: 'chofer', uuid_auth: authUser.id });
      return;
    }

    // No encontrado → cierra sesión
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);

  } catch (err) {
    console.error('Error en buscarPerfil:', err.message);
    setProfile(null);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    const init = async () => {
      // Limpia cualquier sesión corrupta primero
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false); // ← sin sesión, va directo al login
        return;
      }

      setUser(session.user);
      await buscarPerfil(session.user);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await buscarPerfil(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const logoutCompleto = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logoutCompleto, refrescarPerfil: () => buscarPerfil(user) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);