"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

function ForgotPasswordForm() {
 const searchParams = useSearchParams();
 const email = searchParams.get("email") || "";
 const { resetPassword } = useAuth();
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [isLoading, setIsLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (password !== confirmPassword) {
 setError("Passwords do not match");
 return;
 }
 if (password.length < 6) {
 setError("Password must be at least 6 characters");
 return;
 }
 setIsLoading(true);
 setError(null);
 try {
 await resetPassword(email, password);
 } catch (err) {
 setError(err instanceof Error ? err.message : "Password reset failed");
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
 <div className="w-full max-w-sm space-y-8">
 <div className="text-center">
 <h1 className="text-3xl font-bold tracking-tighter uppercase">Reset Password</h1>
 <p className="text-zinc-400">Set a new password for your account</p>
 </div>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="space-y-2">
 <label htmlFor="email" className="text-sm font-medium">Email</label>
 <Input id="email" type="email" value={email} readOnly />
 </div>
 <div className="space-y-2">
 <label htmlFor="password" className="text-sm font-medium">New Password</label>
 <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
 </div>
 <div className="space-y-2">
 <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
 <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
 </div>
 {error && <p className="text-sm text-red-500">{error}</p>}
 <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
 {isLoading ? "Updating..." : "Update Password"}
 </Button>
 </form>
 <p className="text-center text-sm text-zinc-400">
 <Link href="/login" className="text-white hover:underline">Back to login</Link>
 </p>
 </div>
 </div>
 );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
