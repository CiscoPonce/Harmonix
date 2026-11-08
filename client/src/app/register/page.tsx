'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
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

  useEffect(() => {
    rememberSignupSource(searchParams.get('src'));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
      const message = err instanceof Error ? err.message : 'Failed to register';
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
            <h1 className="text-2xl font-bold tracking-tighter uppercase">Register</h1>
            <p className="mt-1 text-zinc-400">
              {challengeId ? 'Check your email for the code' : 'Create an account to get started'}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {challengeId ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-300">
                Enter the six-digit code sent to {email}. It expires in 10 minutes.
              </p>
              <label htmlFor="code" className="text-sm font-medium">Verification code</label>
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
                      const message = err instanceof Error ? err.message : 'Failed to register';
                      setError(message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  Send a new code
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
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
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
            <label htmlFor="password" className="text-sm font-medium">Password</label>
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
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
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
                    Log in with this email
                  </Link>
                  {' '}or{' '}
                  <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className="text-white underline">
                    reset your password
                  </Link>
                </p>
              )}
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={isLoading || (challengeId !== null && code.length !== 6)}>
            {isLoading ? 'Please wait...' : challengeId ? 'Confirm code' : 'Send code'}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline">
            Login
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
