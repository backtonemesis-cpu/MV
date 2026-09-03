import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;
  if (!user.email || !user.emailVerified) {
    await signOut(auth);
    throw new Error('MV requires an authenticated account with a verified email address.');
  }
  return user;
}

export function signOutOfMV() {
  return signOut(auth);
}
