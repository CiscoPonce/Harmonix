'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-xl font-medium animate-pulse uppercase tracking-widest">Lyric</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-white">
      <main className="w-full max-w-2xl space-y-12 text-center sm:text-left">
        <header className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <h1 className="text-4xl font-bold tracking-tighter uppercase">Lyric</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.email}</span>
            <Button variant="secondary" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>
        
        <section className="space-y-6">
          <h2 className="text-2xl font-medium tracking-tight">Welcome back.</h2>
          <p className="max-w-md text-zinc-400">
            You are logged into your distraction-free learning environment. 
            Ready to focus?
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 p-6 transition-colors hover:bg-zinc-900">
            <h3 className="font-medium">Recent Sessions</h3>
            <p className="mt-2 text-sm text-zinc-500">Coming soon</p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-6 transition-colors hover:bg-zinc-900">
            <h3 className="font-medium">Statistics</h3>
            <p className="mt-2 text-sm text-zinc-500">Coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}
