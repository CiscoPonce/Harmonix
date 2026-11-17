"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HarmonixWordmark } from "@/components/HarmonixWordmark";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const { user, isLoading, requestPasswordReset, confirmPasswordReset } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const issued = await requestPasswordReset(email.trim());
      setChallengeId(issued);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      await sendCode();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(email.trim(), challengeId, code.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <HarmonixWordmark href="/" size="xl" showTagline variant="dark" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">Password</h1>
            <p className="mt-1 text-zinc-400">
              {done
                ? "Your password is updated. Sign in with the new one."
                : challengeId
                  ? "Enter the six-digit code and choose a new password. The code expires in 10 minutes."
                  : "We will email a code if this address has a Harmonix account."}
            </p>
          </div>
        </div>
        {isLoading ? (
          <p className="text-center text-zinc-400">Checking session…</p>
        ) : user ? (
          <div className="space-y-4 text-center">
            <p className="text-zinc-400">
              You are signed in. Change your password from Settings.
            </p>
            <Link href="/settings" className="inline-block text-white underline">
              Open Settings
            </Link>
          </div>
        ) : done ? (
          <p className="text-center">
            <Link href="/login" className="text-white underline">
              Back to login
            </Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {challengeId ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">Code</label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">New password</label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : challengeId ? "Update password" : "Email me a code"}
            </Button>
            {challengeId && (
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-zinc-400 underline-offset-4 hover:text-white hover:underline"
                  disabled={busy}
                  onClick={() => sendCode()}
                >
                  Send a new code
                </button>
                <button
                  type="button"
                  className="text-zinc-400 underline-offset-4 hover:text-white hover:underline"
                  disabled={busy}
                  onClick={() => {
                    setChallengeId(null);
                    setCode("");
                    setError(null);
                  }}
                >
                  Use a different email
                </button>
              </div>
            )}
            <p className="text-center text-sm">
              <Link href="/login" className="text-zinc-400 underline-offset-4 hover:text-white hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
