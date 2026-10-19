import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      let tokenResult = null;
      try {
        tokenResult = await firebaseUser.getIdTokenResult(true);
      } catch {
        tokenResult = null;
      }
      let profile = null;
      try {
        const profileSnap = await getDoc(doc(db, 'verity_users', firebaseUser.uid));
        profile = profileSnap.exists() ? profileSnap.data() : null;
      } catch {
        profile = null;
      }
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        name: profile?.name || tokenResult?.claims?.name || firebaseUser.displayName || firebaseUser.email,
        role: profile?.role || tokenResult?.claims?.role || null,
        isActive: profile ? profile.isActive !== false : true,
      });
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
