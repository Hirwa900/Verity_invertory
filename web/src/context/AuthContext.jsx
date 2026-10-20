import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, clearPersistedData } from '../lib/firebase';

const AuthContext = createContext({ user: null, loading: true });

export function buildAuthUser(firebaseUser, tokenResult, profile) {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailVerified: firebaseUser.emailVerified,
    name: profile?.name || tokenResult?.claims?.name || firebaseUser.displayName || firebaseUser.email,
    role: profile?.role || tokenResult?.claims?.role || null,
    isActive: profile ? profile.isActive !== false : true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    let cacheReset = Promise.resolve();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        cacheReset = clearPersistedData().catch(() => {});
        setUser(null);
        setLoading(false);
        return;
      }
      await cacheReset.catch(() => {});
      const [tokenResult, profile] = await Promise.all([
        firebaseUser.getIdTokenResult(true).catch(() => null),
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'verity_users', firebaseUser.uid));
            return snap.exists() ? snap.data() : null;
          } catch {
            return null;
          }
        })(),
      ]);
      setUser(buildAuthUser(firebaseUser, tokenResult, profile));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
