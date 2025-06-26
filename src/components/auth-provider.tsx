'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithRedirect, GoogleAuthProvider, signOut as firebaseSignOut, User, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
    const playerDocRef = doc(db, 'players', firebaseUser.uid);
    const playerDoc = await getDoc(playerDocRef);
    const initialX = 0;
    const initialY = 0;


    if (!playerDoc.exists()) {
      const randomCharacter = CHARACTERS_LIST[Math.floor(Math.random() * CHARACTERS_LIST.length)];
      const newPlayer: Player = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        characterId: randomCharacter.id,
        isOnline: true,
        lastActive: serverTimestamp() as any,
        x: initialX,
        y: initialY,
        direction: 'front',
      };
      await setDoc(playerDocRef, newPlayer);
      setPlayer(newPlayer);
    } else {
      // For existing users, also reset their position to the center on login
      // to ensure they are visible.
      await updateDoc(playerDocRef, {
        isOnline: true,
        lastActive: serverTimestamp(),
        x: initialX,
        y: initialY,
      });
      // Use the existing data but override x and y for the local state immediately
      setPlayer({ ...playerDoc.data(), uid: playerDoc.id, x: initialX, y: initialY, isOnline: true } as Player);
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
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!user) { // Prevent re-running if user is already set by redirect result
            setUser(firebaseUser);
            await handleUserDocument(firebaseUser);
        }
      } else {
        if (user) { // only update if a user was previously logged in
            const playerDocRef = doc(db, 'players', user.uid);
            await updateDoc(playerDocRef, { isOnline: false, lastActive: serverTimestamp() });
        }
        setUser(null);
        setPlayer(null);
        setAccessToken(null);
      }
      setLoading(false);
    });

    checkRedirectResult();

    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
        if (auth.currentUser) {
            const playerDocRef = doc(db, 'players', auth.currentUser.uid);
            await updateDoc(playerDocRef, { isOnline: false, lastActive: serverTimestamp() });
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        unsubscribe();
        window.removeEventListener('beforeunload', handleBeforeUnload);
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
        const playerDocRef = doc(db, 'players', user.uid);
        await updateDoc(playerDocRef, { isOnline: false, lastActive: serverTimestamp() });
    }
    await firebaseSignOut(auth);
  };

  const value = { user, player, loading, accessToken, signInWithGoogle, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
