"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function ForgotPasswordPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tighter uppercase">Password</h1>
        {isLoading ? (
          <p className="text-zinc-400">Checking session…</p>
        ) : user ? (
          <>
            <p className="text-zinc-400">
              Change your password from Settings. Email reset links are not offered.
            </p>
            <Link href="/settings" className="inline-block text-white underline">
              Open Settings
            </Link>
          </>
        ) : (
          <>
            <p className="text-zinc-400">
              Sign in with your current password, then change it in Settings. We do
              not reset passwords from an email address alone.
            </p>
            <Link href="/login" className="inline-block text-white underline">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
