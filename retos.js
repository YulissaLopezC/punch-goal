import { db } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

function retosRef(uid) {
  return collection(db, 'usuarios', uid, 'retos');
}

export function escucharRetos(uid, callback) {
  return onSnapshot(retosRef(uid), (snapshot) => {
    const retos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(retos);
  });
}

export async function crearReto(uid, { nombre, emoji, totalHuecos, premio }) {
  return addDoc(retosRef(uid), {
    nombre,
    emoji,
    totalHuecos,
    premio,
    huecosMarcados: 0,
    historial: [],
    completado: false,
    fechaCompletado: null,
    creadoEn: serverTimestamp()
  });
}

export async function marcarHueco(uid, retoId, reto) {
  const ref = doc(db, 'usuarios', uid, 'retos', retoId);
  const nuevosHuecos = reto.huecosMarcados + 1;
  const completado = nuevosHuecos >= reto.totalHuecos;

  await updateDoc(ref, {
    huecosMarcados: nuevosHuecos,
    historial: arrayUnion(new Date()),
    completado,
    fechaCompletado: completado ? serverTimestamp() : null
  });

  return completado;
}

export async function eliminarReto(uid, retoId) {
  return deleteDoc(doc(db, 'usuarios', uid, 'retos', retoId));
}
