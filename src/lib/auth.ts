import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { create } from 'zustand';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export { auth, db };

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signIn: async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  },
  signOut: async () => {
    // No need to implement explicit sign out for anonymous users, but we keep the interface.
  }
}));

// Automatically sign in anonymously when the app loads
onAuthStateChanged(auth, async (user) => {
  if (user) {
    useAuthStore.setState({ user, loading: false });
  } else {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error(e);
      useAuthStore.setState({ loading: false });
    }
  }
});

export function handleFirestoreError(error: any, operationType: string, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}
