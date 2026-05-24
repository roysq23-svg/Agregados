import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const buscarPerfil = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const email = authUser.email || '';

      // Admin temporal por correo
      if (email === 'giselaf@gmail.com') {
        setProfile({
          id: authUser.id,
          usuario: 'giselaf',
          rol: 'admin',
          uuid_auth: authUser.id
        });
        return;
      }

      const { data: chofer, error } = await supabase
        .from('choferes')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (chofer) {
        setProfile({ ...chofer, rol: 'chofer', uuid_auth: authUser.id });
        return;
      }

      // Si no existe perfil, limpiar sesión local para evitar bucles.
      await supabase.auth.signOut({ scope: 'local' });
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
    let isMounted = true;

    const init = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout al recuperar sesión')), 8000);
        });

        const sessionPromise = supabase.auth.getSession();
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        const session = result?.data?.session;

        if (!isMounted) return;

        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(session.user);
        await buscarPerfil(session.user);
      } catch (err) {
        console.error('Error al inicializar auth:', err.message);
        if (!isMounted) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (
        (event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED') &&
        session?.user
      ) {
        setUser(session.user);
        setLoading(true);
        // Evita await directo dentro del callback de auth.
        setTimeout(() => {
          if (!isMounted) return;
          buscarPerfil(session.user);
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logoutCompleto = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        logoutCompleto,
        signOut: logoutCompleto,
        refrescarPerfil: () => buscarPerfil(user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
