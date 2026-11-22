"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HarmonixWordmark } from "@/components/HarmonixWordmark";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const { user, isLoading, requestPasswordReset, confirmPasswordReset } = useAuth();
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("auth_reset_send_failed"));
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
      setError(t("auth_passwords_mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth_password_min"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(email.trim(), challengeId, code.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth_reset_failed"));
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
            <h1 className="text-2xl font-bold tracking-tighter uppercase">{t("auth_password_title")}</h1>
            <p className="mt-1 text-zinc-400">
              {done
                ? t("auth_password_updated")
                : challengeId
                  ? t("auth_reset_enter_code")
                  : t("auth_reset_intro")}
            </p>
          </div>
        </div>
        {isLoading ? (
          <p className="text-center text-zinc-400">{t("auth_checking_session")}</p>
        ) : user ? (
          <div className="space-y-4 text-center">
            <p className="text-zinc-400">
              {t("auth_signed_in_hint")}
            </p>
            <Link href="/settings" className="inline-block text-white underline">
              {t("auth_open_settings")}
            </Link>
          </div>
        ) : done ? (
          <p className="text-center">
            <Link href="/login" className="text-white underline">
              {t("auth_back_to_login")}
            </Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {challengeId ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">{t("auth_code")}</label>
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
                  <label htmlFor="password" className="text-sm font-medium">{t("auth_new_password")}</label>
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
                  <label htmlFor="confirm" className="text-sm font-medium">{t("auth_confirm_password")}</label>
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
                <label htmlFor="email" className="text-sm font-medium">{t("auth_email")}</label>
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
              {busy ? t("auth_please_wait") : challengeId ? t("auth_update_password") : t("auth_email_code")}
            </Button>
            {challengeId && (
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-zinc-400 underline-offset-4 hover:text-white hover:underline"
                  disabled={busy}
                  onClick={() => sendCode()}
                >
                  {t("auth_send_new_code")}
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
                  {t("auth_different_email")}
                </button>
              </div>
            )}
            <p className="text-center text-sm">
              <Link href="/login" className="text-zinc-400 underline-offset-4 hover:text-white hover:underline">
                {t("auth_back_to_login")}
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
