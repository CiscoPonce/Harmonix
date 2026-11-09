'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, setAccessToken, parseJsonResponse } from '@/lib/api';
import { readSignupSource } from '@/lib/signupSource';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  username?: string | null;
  bio?: string | null;
  has_avatar?: boolean;
  native_language?: string;
  target_language?: string;
  genre?: string;
  difficulty?: string;
  cefr_level?: string;
  voice_gender?: 'female' | 'male' | string;
  dyslexia_font?: number | boolean;
  is_spotify_connected?: boolean;
  spotify_display_name?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestSignupCode: (email: string, password: string) => Promise<string>;
  confirmSignup: (email: string, password: string, challengeId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


function friendlyAuthError(error: string | undefined, context: 'login' | 'register') {
  if (error === 'Invalid credentials') {
    return 'Wrong email or password.';
  }
  if (error === 'Email already registered') {
    return 'This email is already registered. Log in instead.';
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
        const data = await parseJsonResponse<{ accessToken: string }>(res);
        console.log('[Auth] Refresh token accepted');
        setAccessToken(data.accessToken);

        console.log('[Auth] Fetching user info...');
        const userRes = await apiFetch('/auth/me');
        if (userRes.ok) {
          const userData = await parseJsonResponse<User>(userRes);
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
      const data = await parseJsonResponse<{ accessToken: string; user: User }>(res);
      console.log('[Auth] Login successful');
      setAccessToken(data.accessToken);
      setUser(data.user);
      router.push('/discover');
    } else {
      const errorData = await parseJsonResponse<{ error?: string }>(res).catch(() => ({
        error: 'Login failed',
      }));
      console.warn('[Auth] Login failed:', errorData.error);
      throw new Error(friendlyAuthError(errorData.error, 'login'));
    }
  };

  const requestSignupCode = async (email: string, password: string) => {
    const res = await apiFetch('/auth/register/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonResponse<{ error?: string; challenge_id?: string }>(res).catch(() => null);
    if (!res.ok || !data?.challenge_id) {
      throw new Error(friendlyAuthError(data?.error, 'register'));
    }
    return data.challenge_id;
  };

  const confirmSignup = async (email: string, password: string, challengeId: string, code: string) => {
    const res = await apiFetch('/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        challenge_id: challengeId,
        code,
        source: readSignupSource() ?? undefined,
      }),
    });
    if (res.ok) {
      const data = await parseJsonResponse<{ accessToken: string; user: User }>(res);
      setAccessToken(data.accessToken);
      setUser(data.user);
      router.push('/discover');
      return;
    }
    const errorData = await parseJsonResponse<{ error?: string }>(res).catch(() => ({
      error: 'Registration failed',
    }));
    throw new Error(friendlyAuthError(errorData.error, 'register'));
  };

  const refreshUser = async () => {
    try {
      const userRes = await apiFetch('/auth/me');
      if (userRes.ok) {
        const userData = await parseJsonResponse<User>(userRes);
        setUser(userData);
      }
    } catch (error) {
      console.error('[Auth] Failed to refresh user:', error);
    }
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, requestSignupCode, confirmSignup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
