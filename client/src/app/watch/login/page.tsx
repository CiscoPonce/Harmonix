"use client";

import { FormEvent, useState } from "react";
import { apiFetch, setAccessToken, parseJsonResponse } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function WatchLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await parseJsonResponse<{ error?: string }>(res).catch(() => ({ error: "Login failed" }));
        throw new Error(body.error === "Invalid credentials" ? "Wrong email or password" : body.error || "Login failed");
      }

      const data = await parseJsonResponse<{ accessToken: string }>(res);
      setAccessToken(data.accessToken);
      window.location.assign("/watch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="watch-screen space-y-4 pt-2">
      <div className="text-center space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Harmonix</p>
        <h1 className="text-lg font-black uppercase tracking-tight">Watch</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white"
          />
        </label>
        {error && <p className="text-[11px] text-red-400 text-center leading-snug">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full min-h-[48px] items-center justify-center rounded-full bg-white text-black text-[11px] font-bold uppercase disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
        </button>
      </form>
    </main>
  );
}
