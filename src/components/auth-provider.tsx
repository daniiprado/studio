
'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithRedirect, GoogleAuthProvider, signOut as firebaseSignOut, User, getRedirectResult } from 'firebase/auth';
import {
  ref,
  get,
  set,
  update,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';
import { auth, rtdb } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import { CHARACTERS_LIST } from '@/lib/characters';

interface AuthContextType {
  user: User | null;
  player: Player | null;
  loading: boolean;
  accessToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const handleUserDocument = useCallback(async (firebaseUser: User) => {
    const playerRef = ref(rtdb, `players/${firebaseUser.uid}`);
    const playerSnapshot = await get(playerRef);
    const initialX = 150;
    const initialY = 400;

    // Set up onDisconnect to mark user as offline and update last active time
    onDisconnect(playerRef).update({ isOnline: false, lastActive: serverTimestamp() });

    if (!playerSnapshot.exists()) {
      const randomCharacter = CHARACTERS_LIST[Math.floor(Math.random() * CHARACTERS_LIST.length)];
      const newPlayer: Player = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        characterId: randomCharacter.id,
        isOnline: true,
        lastActive: serverTimestamp() as any, // RTDB placeholder
        x: initialX,
        y: initialY,
        direction: 'front',
      };
      await set(playerRef, newPlayer);
      setPlayer({ ...newPlayer, lastActive: Date.now() }); // Use client-side time for initial local state
    } else {
      const updates = {
        isOnline: true,
        lastActive: serverTimestamp(),
        x: initialX,
        y: initialY,
        direction: 'front',
      };
      await update(playerRef, updates);
      // Use existing data, but override with login-time values for local state
      setPlayer({ ...playerSnapshot.val(), uid: playerSnapshot.key, ...updates, isOnline: true } as Player);
    }
  }, []);

  useEffect(() => {
    // This effect handles the result from the Google Sign-In redirect.
    const checkRedirectResult = async () => {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
          }
          const firebaseUser = result.user;
          setUser(firebaseUser);
          await handleUserDocument(firebaseUser);
        }
      } catch (error) {
        console.error("Error getting redirect result", error);
      }
      // Set loading to false only after redirect result has been processed
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!user) { // Prevent re-running if user is already set by redirect result
            setUser(firebaseUser);
            await handleUserDocument(firebaseUser);
        }
      } else {
        setUser(null);
        setPlayer(null);
        setAccessToken(null);
      }
       if (auth.currentUser === firebaseUser) {
         setLoading(false);
       }
    });

    checkRedirectResult();

    return () => {
        unsubscribe();
    };
  }, [handleUserDocument, user]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    provider.addScope('https://www.googleapis.com/auth/tasks.readonly');
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const signOut = async () => {
    if (user) {
        const playerRef = ref(rtdb, `players/${user.uid}`);
        // Set offline status gracefully on sign out
        await update(playerRef, { isOnline: false, lastActive: serverTimestamp() });
    }
    await firebaseSignOut(auth);
  };

  const value = { user, player, loading, accessToken, signInWithGoogle, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
