'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getAuth, onAuthStateChanged, signInWithRedirect, GoogleAuthProvider, signOut as firebaseSignOut, User, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import { AVATAR_SPRITES } from '@/lib/constants';

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

  const handleUserDocument = useCallback(async (firebaseUser: User, token: string | undefined) => {
    const playerDocRef = doc(db, 'players', firebaseUser.uid);
    const playerDoc = await getDoc(playerDocRef);
    const initialX = Math.floor(Math.random() * 500) + 50;
    const initialY = Math.floor(Math.random() * 500) + 50;


    if (!playerDoc.exists()) {
      const randomAvatarUrl = AVATAR_SPRITES[Math.floor(Math.random() * AVATAR_SPRITES.length)];
      const newPlayer: Player = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        avatarUrl: randomAvatarUrl,
        isOnline: true,
        lastActive: serverTimestamp() as any,
        x: initialX,
        y: initialY,
      };
      await setDoc(playerDocRef, newPlayer);
      setPlayer(newPlayer);
    } else {
      await updateDoc(playerDocRef, {
        isOnline: true,
        lastActive: serverTimestamp(),
      });
      setPlayer(playerDoc.data() as Player);
    }
    if (token) {
        setAccessToken(token);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const tokenResult = await getIdTokenResult(firebaseUser);
        await handleUserDocument(firebaseUser, tokenResult.token);
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
