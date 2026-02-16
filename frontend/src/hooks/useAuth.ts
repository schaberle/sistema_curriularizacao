import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

/**
 * Hook useAuth - Gerencia estado de autenticação via Supabase
 */

export interface AuthState {
  isAuthenticated: boolean;
  organizerId: string | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  session: Session | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    organizerId: null,
    email: null,
    loading: true,
    error: null,
    session: null,
  });

  const updateAuth = (session: Session | null) => {
    if (session) {
      setAuth({
        isAuthenticated: true,
        organizerId: session.user.id,
        email: session.user.email || null,
        loading: false,
        error: null,
        session,
      });
    } else {
      setAuth({
        isAuthenticated: false,
        organizerId: null,
        email: null,
        loading: false,
        error: null,
        session: null,
      });
    }
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuth(session);
    });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuth(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuth((prev) => ({ ...prev, loading: true, error: null }));

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return true;
    } catch (error: any) {
      setAuth((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'Erro ao fazer login',
      }));
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return {
    ...auth,
    login,
    logout,
  };
}
