'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, setAccessToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


function friendlyAuthError(error: string | undefined, context: 'login' | 'register') {
  if (error === 'Invalid credentials') {
    return 'Wrong email or password. If you already registered, try resetting your password.';
  }
  if (error === 'Email already registered') {
    return 'This email is already registered. Log in instead, or reset your password below.';
  }
  return error || (context === 'login' ? 'Login failed' : 'Registration failed');
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshSession = async () => {
    console.log('[Auth] Starting session refresh...');
    
    // Create a timeout to ensure we don't hang the UI forever
    const timeout = setTimeout(() => {
      console.warn('[Auth] Refresh session timed out');
      setIsLoading(false);
    }, 5000);

    try {
      const res = await apiFetch('/auth/refresh', { method: 'POST' });
      console.log(`[Auth] Refresh response status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log('[Auth] Refresh token accepted');
        setAccessToken(data.accessToken);
        
        // Fetch user data
        console.log('[Auth] Fetching user info...');
        const userRes = await apiFetch('/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          console.log('[Auth] User info received:', userData.email);
          setUser(userData);
        }
      } else {
        console.log('[Auth] Refresh failed or no session');
      }
    } catch (error) {
      console.error('[Auth] Failed to refresh session:', error);
    } finally {
      clearTimeout(timeout);
      console.log('[Auth] Refresh flow complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // We intentionally bootstrap state from external systems inside this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSession();
  }, []);

  const login = async (email: string, password: string) => {
    console.log(`[Auth] Attempting login for ${email}`);
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('[Auth] Login successful');
      setAccessToken(data.accessToken);
      setUser(data.user);
      router.push('/dashboard');
    } else {
      const errorData = await res.json();
      console.warn('[Auth] Login failed:', errorData.error);
      throw new Error(friendlyAuthError(errorData.error, 'login'));
    }
  };

  const register = async (email: string, password: string) => {
    console.log(`[Auth] Attempting registration for ${email}`);
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      console.log('[Auth] Registration successful, logging in...');
      // Backend register doesn't return token, so login after registration
      await login(email, password);
    } else {
      const errorData = await res.json();
      console.warn('[Auth] Registration failed:', errorData.error);
      throw new Error(friendlyAuthError(errorData.error, 'register'));
    }
  };


  const resetPassword = async (email: string, password: string) => {
    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Password reset failed');
    }
    await login(email, password);
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
