"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { WatchDailyWord } from "@/components/watch/WatchDailyWord";
import { Loader2 } from "lucide-react";

export default function WatchPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/watch/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="watch-screen flex min-h-[180px] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main>
      <WatchDailyWord />
    </main>
  );
}
