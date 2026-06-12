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
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshSession = async () => {
    try {
      const res = await apiFetch('/auth/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        
        // Fetch user data
        const userRes = await apiFetch('/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);
      router.push('/');
    } else {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Login failed');
    }
  };

  const register = async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      // Backend register doesn't return token, so login after registration
      await login(email, password);
    } else {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Registration failed');
    }
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
