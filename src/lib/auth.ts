import { create } from 'zustand';
import { db } from './localFirestore';

type LocalUser = {
  uid: string;
  isAnonymous: boolean;
};

const USER_ID_KEY = 'ssb_local_user_id';

const getLocalUserId = () => {
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const nextId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_ID_KEY, nextId);
  return nextId;
};

const localUser: LocalUser = {
  uid: getLocalUserId(),
  isAnonymous: true,
};

const authListeners = new Set<(user: LocalUser | null) => void>();

export const auth = {
  currentUser: localUser as LocalUser | null,
  onAuthStateChanged(callback: (user: LocalUser | null) => void) {
    authListeners.add(callback);
    callback(this.currentUser);
    return () => {
      authListeners.delete(callback);
    };
  },
};

export { auth, db };

interface AuthState {
  user: LocalUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: auth.currentUser,
  loading: false,
  signIn: async () => {
    set({ user: auth.currentUser, loading: false });
  },
  signOut: async () => {
    set({ user: auth.currentUser, loading: false });
  }
}));

auth.onAuthStateChanged((user) => {
  useAuthStore.setState({ user, loading: false });
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
