'use client';

import { Suspense, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth_login_failed');
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
            <h1 className="text-2xl font-bold tracking-tighter uppercase">{t('auth_login_title')}</h1>
            <p className="mt-1 text-zinc-400">{t('auth_login_subtitle')}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-right text-xs">
            <Link href="/forgot-password" className="text-zinc-400 hover:text-white underline-offset-4 hover:underline">
              {t('auth_forgot_password')}
            </Link>
          </p>
          <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
            {isLoading ? t('auth_logging_in') : t('auth_login')}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          {t('auth_no_account')}{' '}
          <Link href="/register" className="text-white hover:underline">
            {t('auth_register')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
