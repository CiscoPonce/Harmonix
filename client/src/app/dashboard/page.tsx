'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Legacy Learn route — permanently redirects to unified Discover home. */
export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/discover');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] dark:bg-[#0C1210]">
      <Loader2 className="h-8 w-8 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" aria-label="Redirecting" />
    </div>
  );
}
