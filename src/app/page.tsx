'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/game');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-headline text-primary">ServiAdventures</h1>
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="text-muted-foreground">Loading your adventure...</p>
      </div>
    </div>
  );
}
