
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, MessageSquare, Mic, PanelRightOpen, PanelRightClose, PersonStanding, MicOff } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import dynamic from 'next/dynamic';
import CharacterSelectionDialog from '@/components/character-selection-dialog';

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
  const { toast } = useToast();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
  const [isCharacterModalOpen, setCharacterModalOpen] = useState(false);
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');

  const [isNearNpc, setIsNearNpc] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (!user) return;
  
    const playersRef = query(ref(rtdb, "players"), orderByChild("isOnline"), equalTo(true));
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const playersData: Player[] = [];
      if (snapshot.exists()) {
        const playersObject = snapshot.val();
        Object.keys(playersObject).forEach((uid) => {
          if (uid !== user.uid) {
            playersData.push({ ...playersObject[uid], uid });
          }
        });
      }
      setOnlinePlayers(playersData);
    });
  
    return () => unsubscribe();
  }, [user]);

  const handleVoiceChatClick = async () => {
    if (isRecording) {
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
      return;
    }

    if (hasMicPermission === false) {
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasMicPermission(true);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
    }
  };


  if (loading || !user || !player) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }
  
  return (
    <>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <div className="flex-1 flex flex-col">
            <header className="z-10 flex items-center justify-between p-4 bg-card/50 border-b border-border">
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
                    <DropdownMenuItem onClick={() => setCharacterModalOpen(true)}>
                        <PersonStanding className="mr-2 h-4 w-4" />
                        <span>Change Character</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </header>

            <main className="flex-1 relative">
                <PixiCanvas 
                    currentPlayer={player} 
                    onlinePlayers={onlinePlayers} 
                    gameState={gameState}
                    setGameState={setGameState}
                    onProximityChange={setIsNearNpc}
                />

                <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 p-4">
                    <div className="flex items-center gap-2 rounded-full bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20" disabled={!isNearNpc || gameState !== 'playing'}>
                                    <MessageSquare/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 mb-2">
                            <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Chat with Quest Giver</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Type your message below.
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Input placeholder="Hello there!" />
                                        <Button>Send</Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20" disabled={!isNearNpc || gameState !== 'playing'} onClick={handleVoiceChatClick}>
                            {isRecording ? <MicOff className="text-destructive"/> : <Mic/>}
                        </Button>
                    </div>
                </footer>
            </main>
        </div>
        
        {isSidebarOpen && (
          <aside className="w-[350px] flex-shrink-0 border-l border-border bg-black/20">
            <RightSidebar />
          </aside>
        )}
      </div>
      {player && (
        <CharacterSelectionDialog 
          isOpen={isCharacterModalOpen}
          setIsOpen={setCharacterModalOpen}
          currentPlayer={player}
        />
      )}
    </>
  );
}
