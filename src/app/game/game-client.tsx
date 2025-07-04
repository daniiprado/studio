
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, MessageSquare, Mic, PanelRightOpen, PanelRightClose, PersonStanding, MicOff, Video } from 'lucide-react';
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
import { equalTo, onValue, orderByChild, query, ref, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import dynamic from 'next/dynamic';
import CharacterSelectionDialog from '@/components/character-selection-dialog';
import { npcChat } from '@/ai/flows/npc-chat-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [npcResponse, setNpcResponse] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

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

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };
    if (isCameraOpen) {
      getCameraPermission();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isCameraOpen, toast]);
  
  const updatePlayerState = useCallback((data: Partial<Player>) => {
    if (!user) return;
    const playerRef = ref(rtdb, `players/${user.uid}`);
    update(playerRef, data);
  }, [user]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setNpcResponse(null);
    try {
      const result = await npcChat({ message: chatInput });
      setNpcResponse(result.response);
      setChatInput('');
    } catch (error) {
      console.error('Error in text chat:', error);
      toast({
        title: 'An error occurred',
        description: 'The NPC is busy right now, try again later.',
        variant: 'destructive',
      });
      setNpcResponse('The Quest Giver seems to be lost in thought...');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceChatClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
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
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            setIsSubmitting(true);
            setNpcResponse(null);
            const result = await npcChat({ audioDataUri: base64data });
            toast({
              title: "Quest Giver says...",
              description: result.response,
              duration: 5000,
            });
          } catch(err) {
            console.error('Error sending voice chat:', err);
            toast({
              title: 'An error occurred',
              description: 'The NPC did not hear you, try again.',
              variant: 'destructive',
            });
          } finally {
            setIsSubmitting(false);
          }
        }
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
        updatePlayerState({ isMicOn: false });
      };

      recorder.start();
      setIsRecording(true);
      updatePlayerState({ isMicOn: true });

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      setIsRecording(false);
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
      <div className="h-screen w-full bg-background text-foreground overflow-hidden relative">
        <main className="absolute inset-0 z-10">
          <PixiCanvas 
            currentPlayer={player} 
            onlinePlayers={onlinePlayers} 
            gameState={gameState}
            setGameState={setGameState}
            onProximityChange={setIsNearNpc}
          />
        </main>
        
        <header className={cn(
          "absolute top-0 left-0 z-10 flex items-center justify-between px-4 py-2 bg-card/50 border-b border-border backdrop-blur-sm transition-[right] duration-300 ease-in-out",
          isSidebarOpen ? "right-[300px]" : "right-0"
        )}>
            <h1 className="font-headline text-xl text-white font-bold tracking-wider">ServiPals</h1>
            <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="h-8 w-8 text-foreground hover:text-accent hover:bg-white/10"
                >
                {isSidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}
                <span className="sr-only">Toggle Sidebar</span>
                </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                    <Avatar className="h-8 w-8">
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

        {isCameraOpen && (
          <div className="absolute top-20 left-4 z-20 w-64 bg-black/50 p-2 rounded-lg border border-border">
            <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access to use this feature.
                  </AlertDescription>
                </Alert>
            )}
          </div>
        )}

        <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 p-4">
            <div className="flex items-center gap-2 rounded-full bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                <Popover open={isChatOpen} onOpenChange={(open) => {
                    setIsChatOpen(open);
                    if (!open) setNpcResponse(null);
                }}>
                    <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20" disabled={!isNearNpc || gameState !== 'playing'} onClick={() => setIsChatOpen(true)}>
                            <MessageSquare/>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 mb-2">
                        <form onSubmit={handleSendMessage} className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Chat with Quest Giver</h4>
                                <p className="text-sm text-muted-foreground">
                                    Type your message below.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Input 
                                    placeholder="Hello there!" 
                                    value={chatInput} 
                                    onChange={(e) => setChatInput(e.target.value)} 
                                    disabled={isSubmitting}
                                />
                                <Button type="submit" disabled={isSubmitting || !chatInput.trim()}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Send
                                </Button>
                            </div>
                        </form>
                        {isSubmitting && !npcResponse && (
                            <div className="mt-4 text-sm p-3 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <p className="ml-2 text-muted-foreground">Thinking...</p>
                            </div>
                        )}
                        {npcResponse && (
                            <div className="mt-4 text-sm p-3 bg-muted rounded-md border">
                                <p className="font-semibold text-accent">Quest Giver:</p>
                                <p className="text-foreground/90 whitespace-pre-wrap">{npcResponse}</p>
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/20" disabled={!isNearNpc || gameState !== 'playing' || isSubmitting} onClick={handleVoiceChatClick}>
                    {isRecording ? <MicOff className="text-destructive"/> : (isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic/>)}
                </Button>
                <Button size="icon" variant={isCameraOpen ? "secondary" : "ghost"} className="rounded-full hover:bg-accent/20" disabled={gameState !== 'playing'} onClick={() => {
                  const newCameraState = !isCameraOpen;
                  setIsCameraOpen(newCameraState);
                  updatePlayerState({ isCameraOn: newCameraState });
                }}>
                    <Video/>
                </Button>
            </div>
        </footer>
        
        {isSidebarOpen && (
          <aside className="absolute right-0 top-0 bottom-0 w-[300px] flex-shrink-0 border-l border-border bg-black/20 z-20">
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
