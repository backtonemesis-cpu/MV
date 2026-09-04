import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import { clearAuthToken, setAuthToken } from '../utils/api';
import { isMvOwnerEmail, MV_OWNER_EMAIL, MV_SINGLE_USER_MODE } from '../accessPolicy';

interface AuthGateProps {
  children: React.ReactNode;
}

const FIREBASE_COOKIE_NAME = 'mv_firebase_id';

function setEventStreamAuthCookie(idToken: string): void {
  document.cookie = `${FIREBASE_COOKIE_NAME}=${encodeURIComponent(idToken)}; Path=/; Max-Age=3600; Secure; SameSite=Strict`;
}

function clearEventStreamAuthCookie(): void {
  document.cookie = `${FIREBASE_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; SameSite=Strict`;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(import.meta.env.DEV);
  const [isSignedIn, setIsSignedIn] = useState(import.meta.env.DEV);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    return onIdTokenChanged(auth, async (user) => {
      try {
        if (!user) {
          clearAuthToken();
          clearEventStreamAuthCookie();
          setIsSignedIn(false);
          setIsReady(true);
          return;
        }

        if (MV_SINGLE_USER_MODE && !isMvOwnerEmail(user.email)) {
          await signOut(auth);
          clearAuthToken();
          clearEventStreamAuthCookie();
          setIsSignedIn(false);
          setIsReady(true);
          setError(`MV is currently private. Only ${MV_OWNER_EMAIL} can sign in.`);
          return;
        }

        const idToken = await user.getIdToken();
        setAuthToken(idToken);
        setEventStreamAuthCookie(idToken);
        setIsSignedIn(true);
        setIsReady(true);
        setError(null);
      } catch (err) {
        clearAuthToken();
        clearEventStreamAuthCookie();
        setIsSignedIn(false);
        setIsReady(true);
        setError(err instanceof Error ? err.message : 'Unable to verify sign-in.');
      }
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: MV_OWNER_EMAIL,
      });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (import.meta.env.DEV) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          Verifying secure identity…
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-lg text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-neutral-900 dark:text-neutral-100">MV Finance</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            MV is currently private and restricted to Marius. Sign in with ${MV_OWNER_EMAIL}.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 text-left">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-semibold disabled:opacity-60"
          >
            {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign in with Google
          </button>

          <p className="mt-4 text-[11px] text-neutral-400 dark:text-neutral-500">
            Other Google accounts are rejected and receive no MV financial data.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
