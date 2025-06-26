import { Suspense } from 'react';
import GameClient from './game-client';
import { Loader2 } from 'lucide-react';

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    }>
      <GameClient />
    </Suspense>
  );
}
