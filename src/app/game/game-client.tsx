'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, MessageSquare, Mic, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RightSidebar from '@/components/right-sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import dynamic from 'next/dynamic';

const PixiCanvas = dynamic(() => import('@/components/pixi-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-accent" />
    </div>
  ),
});


export default function GameClient() {
  const { user, player, loading, signOut } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (!user) return;
  
    const q = query(collection(db, "players"), where("isOnline", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players: Player[] = [];
      snapshot.forEach((doc) => {
        players.push({ ...doc.data(), uid: doc.id } as Player);
      });
      setOnlinePlayers(players);
    });
  
    return () => unsubscribe();
  }, [user]);

  if (loading || !user || !player) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }
  
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <main className="flex-1 flex flex-col relative">
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <h1 className="font-headline text-2xl text-primary font-bold tracking-wider">ServiAdventures</h1>
          <div className="flex items-center gap-4">
             <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="text-foreground hover:text-accent hover:bg-white/10"
              >
                {isSidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'User'} />
                    <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <PixiCanvas currentPlayer={player} onlinePlayers={onlinePlayers} />

        <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 p-4">
            <div className="flex items-center gap-2 rounded-full bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20"><MessageSquare/></Button>
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20"><Mic/></Button>
            </div>
        </footer>

      </main>
      
      {isSidebarOpen && (
        <aside className="w-[350px] flex-shrink-0 border-l border-border bg-black/20">
          <RightSidebar />
        </aside>
      )}
    </div>
  );
}
