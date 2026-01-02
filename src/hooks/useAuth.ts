import { useState, useEffect, useCallback } from 'react';
import { authService, ApiError, type User, type AuthStatus } from '../api/authService';

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  authStatus: AuthStatus | null;
  error: string | null;
}

export interface UseAuthReturn extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    authStatus: null,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Get auth status (whether users exist, registration allowed)
      const status = await authService.getStatus();
      
      // Try to get current user
      try {
        const user = await authService.getMe();
        setState({
          isLoading: false,
          isAuthenticated: true,
          user,
          authStatus: status,
          error: null,
        });
      } catch (err) {
        // Not authenticated
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          authStatus: status,
          error: null,
        });
      }
    } catch (err) {
      // Backend unavailable
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        authStatus: null,
        error: 'Unable to connect to server',
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const user = await authService.login({ username, password });
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: true,
        user,
        error: null,
      }));
      return true;
    } catch (err) {
      let errorMessage = 'Login failed';
      if (err instanceof ApiError) {
        if (err.status === 401) {
          errorMessage = 'Invalid username or password';
        } else if (err.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else {
          errorMessage = err.message;
        }
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const user = await authService.register({ username, password });
      // Fetch fresh auth status after registration (hasUsers/registrationAllowed may have changed)
      const freshStatus = await authService.getStatus();
      setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        authStatus: freshStatus,
        error: null,
      });
      return true;
    } catch (err) {
      let errorMessage = 'Registration failed';
      if (err instanceof ApiError) {
        if (err.status === 403) {
          errorMessage = 'Registration is disabled. Contact the administrator.';
        } else if (err.status === 409) {
          errorMessage = 'This username is already taken.';
        } else {
          errorMessage = err.message;
        }
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    
    try {
      await authService.logout();
    } catch (err) {
      // Ignore logout errors - clear state anyway
    }
    
    // Fetch fresh auth status after logout (registrationAllowed may have changed)
    try {
      const freshStatus = await authService.getStatus();
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        authStatus: freshStatus,
        error: null,
      });
    } catch (err) {
      // Backend unavailable after logout
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        authStatus: null,
        error: null,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };
}
