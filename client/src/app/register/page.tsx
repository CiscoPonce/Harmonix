'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/lib/i18n';
import { rememberSignupSource } from '@/lib/signupSource';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';
import Link from 'next/link';

function RegisterForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { requestSignupCode, confirmSignup } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    rememberSignupSource(searchParams.get('src'));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth_passwords_mismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth_password_min'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      if (!challengeId) {
        const issued = await requestSignupCode(email, password);
        setChallengeId(issued);
        return;
      }
      await confirmSignup(email, password, challengeId, code.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth_register_failed');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <HarmonixWordmark href="/" size="xl" showTagline variant="dark" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">{t('auth_register_title')}</h1>
            <p className="mt-1 text-zinc-400">
              {challengeId ? t('auth_check_email_code') : t('auth_register_subtitle')}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {challengeId ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-300">
                {t('auth_code_sent', { email })}
              </p>
              <label htmlFor="code" className="text-sm font-medium">{t('auth_verification_code')}</label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
              <div className="flex gap-4">
                <button
                  type="button"
                  className="text-xs text-zinc-400 underline"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setError(null);
                    try {
                      const issued = await requestSignupCode(email, password);
                      setChallengeId(issued);
                      setCode('');
                    } catch (err) {
                      const message = err instanceof Error ? err.message : t('auth_register_failed');
                      setError(message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  {t('auth_send_new_code')}
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 underline"
                  disabled={isLoading}
                  onClick={() => {
                    setChallengeId(null);
                    setCode('');
                    setError(null);
                  }}
                >
                  {t('auth_different_email')}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">{t('auth_email')}</label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">{t('auth_password')}</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">{t('auth_confirm_password')}</label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
            </>
          )}
          {error && (
            <div className="space-y-2">
              <p className="text-sm text-red-500">{error}</p>
              {error.includes('already registered') && (
                <p className="text-xs text-zinc-400">
                  <Link href={`/login?email=${encodeURIComponent(email)}`} className="text-white underline">
                    {t('auth_login_with_email')}
                  </Link>
                  {' '}{t('auth_or')}{' '}
                  <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className="text-white underline">
                    {t('auth_reset_your_password')}
                  </Link>
                </p>
              )}
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={isLoading || (challengeId !== null && code.length !== 6)}>
            {isLoading ? t('auth_please_wait') : challengeId ? t('auth_confirm_code') : t('auth_send_code')}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          {t('auth_have_account')}{' '}
          <Link href="/login" className="text-white hover:underline">
            {t('auth_login')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
