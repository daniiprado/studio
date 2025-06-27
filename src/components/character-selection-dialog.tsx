
'use client';

import { ref, update } from 'firebase/database';
import Image from 'next/image';
import { rtdb } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import { CHARACTERS_LIST, Character } from '@/lib/characters';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CharacterSelectionDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    currentPlayer: Player;
}

export default function CharacterSelectionDialog({ isOpen, setIsOpen, currentPlayer }: CharacterSelectionDialogProps) {
    const [selectedCharacterId, setSelectedCharacterId] = useState(currentPlayer.characterId);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        if (selectedCharacterId === currentPlayer.characterId) {
            setIsOpen(false);
            return;
        }

        setIsSaving(true);
        try {
            const playerRef = ref(rtdb, `players/${currentPlayer.uid}`);
            await update(playerRef, {
                characterId: selectedCharacterId,
            });
            toast({
                title: 'Character Updated!',
                description: `You are now playing as ${CHARACTERS_LIST.find(c => c.id === selectedCharacterId)?.name}.`,
            });
            setIsOpen(false);
        } catch (error) {
            console.error("Error updating character:", error);
            toast({
                title: 'Error',
                description: 'Failed to update your character. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Choose Your Character</DialogTitle>
                    <DialogDescription>
                        Select your adventurer. This will be visible to all other players in the world.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                    {CHARACTERS_LIST.map((character) => (
                        <div
                            key={character.id}
                            className={cn(
                                "relative rounded-lg border-2 p-4 flex flex-col items-center justify-center cursor-pointer transition-all",
                                selectedCharacterId === character.id ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50'
                            )}
                            onClick={() => setSelectedCharacterId(character.id)}
                        >
                            <div className='relative w-16 h-24 flex items-center justify-center overflow-hidden'>
                                <Image
                                    src={character.png}
                                    alt={character.name}
                                    width={character.png.width}
                                    height={character.png.height}
                                    className="max-w-none"
                                    style={{
                                        objectFit: 'none',
                                        objectPosition: `-${character.previewFrame.x}px -${character.previewFrame.y}px`,
                                        width: `${character.previewFrame.w}px`,
                                        height: `${character.previewFrame.h}px`,
                                        transform: 'scale(2.5)'
                                    }}
                                    priority
                                />
                            </div>
                            <p className="mt-2 font-semibold text-center">{character.name}</p>
                            {selectedCharacterId === character.id && (
                                <div className="absolute top-2 right-2 text-primary">
                                    <CheckCircle className="h-6 w-6" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
