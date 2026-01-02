import { api, ApiError } from './client';

export interface AuthStatus {
  hasUsers: boolean;
  registrationAllowed: boolean;
}

export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  confirmPassword?: string;
}

/**
 * Authentication API service
 */
export const authService = {
  /**
   * Get authentication status (whether users exist and registration is allowed)
   */
  async getStatus(): Promise<AuthStatus> {
    return api.get<AuthStatus>('/auth/status');
  },

  /**
   * Get current authenticated user
   * Returns user info or throws 401 ApiError if not authenticated
   */
  async getMe(): Promise<User> {
    return api.get<User>('/auth/me');
  },

  /**
   * Register a new user
   * First user becomes admin
   */
  async register(credentials: LoginCredentials): Promise<User> {
    return api.post<User>('/auth/register', credentials);
  },

  /**
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<User> {
    return api.post<User>('/auth/login', credentials);
  },

  /**
   * Logout and destroy session
   */
  async logout(): Promise<void> {
    await api.post<{ message: string }>('/auth/logout', {});
  },
};

export { ApiError };
