import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User,
  Auth,
} from 'firebase/auth';
import type { UserRole, UserStatus } from '../types';
import { api } from '../api/client';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Check if Firebase is actually configured
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.warn('Firebase initialization failed:', e);
  }
}

const googleProvider = new GoogleAuthProvider();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  token: string | null;
  firebaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: 'employee',
  status: 'pending',
  companyId: null,
  token: null,
  firebaseConfigured: false,
  signIn: async () => {},
  register: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshToken: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [role, setRole] = useState<UserRole>('employee');
  const [status, setStatus] = useState<UserStatus>('pending');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        const tokenResult = await firebaseUser.getIdTokenResult();
        setRole((tokenResult.claims.role as UserRole) || 'employee');
        setCompanyId((tokenResult.claims.companyId as string) || null);
        
        // Fetch current user profile to get status
        try {
          // We don't await this directly to not block the initial auth state resolution
          // if the backend is slow.
          api.getCurrentUser().then(userProfile => {
             setStatus(userProfile.status || 'approved');
          }).catch(err => {
             console.error("Failed to fetch user profile status", err);
          });
        } catch (e) {
             console.error("Failed to fetch user profile status", e);
        }
      } else {
        setToken(null);
        setRole('employee');
        setCompanyId(null);
        setStatus('pending');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (data: any) => {
    // 1. Call backend to create firebase auth + firestore user + set claims
    await api.registerUser(data);
    // 2. Sign in locally
    if (!auth) throw new Error('Firebase not configured');
    await signInWithEmailAndPassword(auth, data.email, data.password);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase not configured');
    await signInWithPopup(auth, googleProvider);
    // Note: Google sign in doesn't currently support the companyId registration flow.
    // It will act as a generic fallback.
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const refreshToken = async () => {
    if (!auth?.currentUser) return;
    const idToken = await auth.currentUser.getIdToken(true);
    setToken(idToken);
    const tokenResult = await auth.currentUser.getIdTokenResult(true);
    setRole((tokenResult.claims.role as UserRole) || 'employee');
    setCompanyId((tokenResult.claims.companyId as string) || null);
    try {
        const userProfile = await api.getCurrentUser();
        setStatus(userProfile.status || 'approved');
    } catch (e) {
        console.error("Failed to fetch user profile status on refresh", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        role,
        status,
        companyId,
        token,
        firebaseConfigured: isFirebaseConfigured,
        signIn,
        register,
        signInWithGoogle,
        signOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Export a safe auth reference for the API client
const safeAuth = auth;
const safeDb = db;
export { safeAuth as auth, safeDb as db };
