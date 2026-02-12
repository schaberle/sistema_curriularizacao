import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook useAuth - Gerencia estado de autenticação
 *
 * Responsabilidades:
 * 1. Login/logout
 * 2. Verificar autenticação
 * 3. Armazenar token e organizerId
 */

export interface AuthState {
  isAuthenticated: boolean;
  organizerId: string | null;
  email: string | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    organizerId: null,
    email: null,
    loading: true,
    error: null,
  });

  // Verificar se já tem token ao carregar
  useEffect(() => {
    const token = localStorage.getItem('token');
    const organizerId = localStorage.getItem('organizerId');

    if (token && organizerId) {
      setAuth({
        isAuthenticated: true,
        organizerId,
        email: localStorage.getItem('email'),
        loading: false,
        error: null,
      });
    } else {
      setAuth({
        isAuthenticated: false,
        organizerId: null,
        email: null,
        loading: false,
        error: null,
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuth((prev) => ({ ...prev, loading: true, error: null }));

      const response = await api.login(email, password);

      // Salvar token e info
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('organizerId', response.data.organizerId);
      localStorage.setItem('email', response.data.email);

      setAuth({
        isAuthenticated: true,
        organizerId: response.data.organizerId,
        email: response.data.email,
        loading: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao fazer login';
      setAuth((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('organizerId');
    localStorage.removeItem('email');

    setAuth({
      isAuthenticated: false,
      organizerId: null,
      email: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...auth,
    login,
    logout,
  };
}
