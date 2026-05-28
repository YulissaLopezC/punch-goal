import { auth } from './firebase.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const provider = new GoogleAuthProvider();

export async function iniciarSesionGoogle() {
  return signInWithPopup(auth, provider);
}

export async function cerrarSesion() {
  return signOut(auth);
}

export function onCambioAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
