import { iniciarSesionGoogle, cerrarSesion, onCambioAuth } from './auth.js';
import { escucharRetos, crearReto, marcarHueco, eliminarReto } from './retos.js';

// ── State ──────────────────────────────────────────────────────────────────────
let currentUser = null;
let unsubscribeRetos = null;
let retoParaMarcar = null;

// ── DOM References ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const loginScreen     = $('login-screen');
const appScreen       = $('app-screen');
const retosActivosEl  = $('retos-activos');
const retosCompEl     = $('retos-completados');
const modalCrear      = $('modal-crear');
const modalConfirmar  = $('modal-confirmar');
const modalCelebra    = $('modal-celebracion');

// ── Auth ───────────────────────────────────────────────────────────────────────
onCambioAuth((user) => {
  if (user) {
    currentUser = user;
    mostrarApp();
    iniciarEscucha();
  } else {
    currentUser = null;
    mostrarLogin();
    if (unsubscribeRetos) { unsubscribeRetos(); unsubscribeRetos = null; }
  }
});

function mostrarApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  $('user-name').textContent = currentUser.displayName?.split(' ')[0] ?? '';
  const photo = $('user-photo');
  if (currentUser.photoURL) {
    photo.src = currentUser.photoURL;
    photo.classList.remove('hidden');
  }
}

function mostrarLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

$('btn-login').addEventListener('click', async () => {
  try {
    await iniciarSesionGoogle();
  } catch (e) {
    console.error('Login error:', e);
  }
});

$('btn-signout').addEventListener('click', () => cerrarSesion());

// ── Realtime listener ──────────────────────────────────────────────────────────
function iniciarEscucha() {
  unsubscribeRetos = escucharRetos(currentUser.uid, (retos) => {
    const activos     = retos.filter(r => !r.completado)
                             .sort((a, b) => (a.creadoEn?.seconds ?? 0) - (b.creadoEn?.seconds ?? 0));
    const completados = retos.filter(r => r.completado)
                             .sort((a, b) => (b.fechaCompletado?.seconds ?? 0) - (a.fechaCompletado?.seconds ?? 0));
    renderActivos(activos);
    renderCompletados(completados);
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
$('tab-activos').addEventListener('click', () => cambiarTab('activos'));
$('tab-completados').addEventListener('click', () => cambiarTab('completados'));

function cambiarTab(tab) {
  const isActivos = tab === 'activos';
  $('tab-activos').className     = isActivos
    ? 'pb-3 text-primary border-b-2 border-primary font-bold font-label-md text-label-md'
    : 'pb-3 text-on-surface-variant font-medium font-label-md text-label-md';
  $('tab-completados').className = !isActivos
    ? 'pb-3 text-primary border-b-2 border-primary font-bold font-label-md text-label-md'
    : 'pb-3 text-on-surface-variant font-medium font-label-md text-label-md';
  $('panel-activos').classList.toggle('hidden', !isActivos);
  $('panel-completados').classList.toggle('hidden', isActivos);
}

// ── Render: Activos ────────────────────────────────────────────────────────────
function renderActivos(retos) {
  if (retos.length === 0) {
    retosActivosEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-on-surface-variant">
        <span class="text-5xl mb-4">🎯</span>
        <p class="font-headline-sm text-headline-sm">Sin retos activos</p>
        <p class="font-body-sm text-body-sm mt-1">Crea tu primer reto para empezar</p>
      </div>`;
    return;
  }

  retosActivosEl.innerHTML = retos.map(cardActivaHTML).join('');

  retos.forEach(reto => {
    // Punch buttons (solo los vacíos)
    const btns = retosActivosEl.querySelectorAll(`[data-id="${reto.id}"] .punch-hole.vacio`);
    btns.forEach(btn => btn.addEventListener('click', () => abrirConfirmar(reto)));

    // Delete
    retosActivosEl.querySelector(`[data-id="${reto.id}"] .btn-delete`)
      ?.addEventListener('click', () => pedirEliminar(reto.id));
  });
}

function cardActivaHTML(reto) {
  const progreso = Math.round((reto.huecosMarcados / reto.totalHuecos) * 100);
  const huecos = Array.from({ length: reto.totalHuecos }, (_, i) => {
    const done = i < reto.huecosMarcados;
    return `<div class="punch-hole ${done ? 'marcado' : 'vacio'}">
      <span class="emoji">${reto.emoji}</span>
    </div>`;
  }).join('');

  return `
  <article data-id="${reto.id}"
    class="bg-surface-container-lowest rounded-xl p-4 shadow-[rgba(99,102,241,0.08)_0px_4px_12px] border border-outline-variant/30 flex flex-col gap-4">
    <div class="flex justify-between items-start">
      <div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">${reto.emoji} ${reto.nombre}</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
          ${reto.huecosMarcados} de ${reto.totalHuecos} huecos
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="bg-surface-variant text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm">${progreso}%</span>
        <button class="btn-delete text-outline hover:text-error transition-colors p-1 rounded-lg">
          <span class="material-symbols-outlined text-[20px]">delete</span>
        </button>
      </div>
    </div>
    <div class="flex flex-wrap gap-3">${huecos}</div>
    <div class="w-full bg-surface-container rounded-full h-1.5">
      <div class="progress-fill bg-secondary h-1.5 rounded-full" style="width:${progreso}%"></div>
    </div>
  </article>`;
}

// ── Render: Completados ────────────────────────────────────────────────────────
function renderCompletados(retos) {
  if (retos.length === 0) {
    retosCompEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-on-surface-variant">
        <span class="text-5xl mb-4">🏆</span>
        <p class="font-headline-sm text-headline-sm">Aún no hay logros</p>
        <p class="font-body-sm text-body-sm mt-1">¡Sigue marcando huecos!</p>
      </div>`;
    return;
  }

  retosCompEl.innerHTML = retos.map(cardCompletadaHTML).join('');
}

function cardCompletadaHTML(reto) {
  return `
  <article class="bg-secondary-container/20 border border-secondary/20 rounded-xl p-4 flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <span class="text-3xl">${reto.emoji}</span>
      <div class="flex-1">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">${reto.nombre}</h3>
        <p class="font-body-sm text-body-sm text-secondary">✓ ${reto.totalHuecos} huecos completados</p>
      </div>
      <span class="text-2xl">🏆</span>
    </div>
    <div class="bg-surface-container-lowest rounded-lg p-3 border border-secondary/20">
      <p class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">Tu premio</p>
      <p class="font-body-md text-body-md text-on-surface">${reto.premio}</p>
    </div>
  </article>`;
}

// ── Modal: Confirmar hueco ─────────────────────────────────────────────────────
function abrirConfirmar(reto) {
  retoParaMarcar = reto;
  $('confirmar-emoji').textContent  = reto.emoji;
  $('confirmar-nombre').textContent = reto.nombre;
  modalConfirmar.classList.remove('hidden');
}

$('btn-confirmar-si').addEventListener('click', async () => {
  if (!retoParaMarcar || !currentUser) return;
  const reto = retoParaMarcar;
  retoParaMarcar = null;
  modalConfirmar.classList.add('hidden');

  const completado = await marcarHueco(currentUser.uid, reto.id, reto);
  if (completado) mostrarCelebracion(reto);
});

$('btn-confirmar-no').addEventListener('click', () => {
  retoParaMarcar = null;
  modalConfirmar.classList.add('hidden');
});

// ── Modal: Crear reto ──────────────────────────────────────────────────────────
$('btn-nuevo-reto').addEventListener('click', () => modalCrear.classList.remove('hidden'));
$('btn-cerrar-crear').addEventListener('click', cerrarModalCrear);

$('form-crear-reto').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const datos = {
    nombre:      $('input-nombre').value.trim(),
    emoji:       $('input-emoji').value.trim(),
    totalHuecos: parseInt($('input-huecos').value),
    premio:      $('input-premio').value.trim()
  };

  if (!datos.nombre || !datos.emoji || !datos.totalHuecos || !datos.premio) return;

  const btn = $('btn-guardar-reto');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  await crearReto(currentUser.uid, datos);
  cerrarModalCrear();

  btn.disabled = false;
  btn.textContent = 'Crear reto';
});

function cerrarModalCrear() {
  modalCrear.classList.add('hidden');
  $('form-crear-reto').reset();
}

// ── Modal: Celebración ─────────────────────────────────────────────────────────
function mostrarCelebracion(reto) {
  $('celebracion-nombre').textContent = reto.nombre;
  $('celebracion-premio').textContent  = reto.premio;

  // Mostrar front del flip, luego voltear
  const flipInner = $('flip-card-inner');
  flipInner.classList.remove('is-flipped');
  $('flip-front-emoji').textContent = reto.emoji;
  $('flip-back-emoji').textContent  = reto.emoji;

  modalCelebra.classList.remove('hidden');
  setTimeout(() => flipInner.classList.add('is-flipped'), 400);
}

$('btn-cerrar-celebracion').addEventListener('click', () => {
  modalCelebra.classList.add('hidden');
  cambiarTab('completados');
});

// ── Eliminar ───────────────────────────────────────────────────────────────────
async function pedirEliminar(retoId) {
  if (!confirm('¿Eliminar este reto? Esta acción no se puede deshacer.')) return;
  await eliminarReto(currentUser.uid, retoId);
}

// ── Close modals on backdrop click ────────────────────────────────────────────
[modalCrear, modalConfirmar, modalCelebra].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});
