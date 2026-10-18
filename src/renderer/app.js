'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ---------- Icônes ----------
const P = {
  wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M19 12.86a10 10 0 0 0-2-1.52"/><path d="M2 8.82a15 15 0 0 1 4.18-2.64"/><path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/>',
  bt: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  btOff: '<path d="m17 17-5 5V12l-5 5"/><path d="m2 2 20 20"/><path d="M14.5 9.5 17 7l-5-5v4.5"/>',
  vol2: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  vol1: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  volX: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 17.5a5.5 5.5 0 0 0 0-11z" fill="currentColor"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  lock: '<rect width="16" height="10" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
  keyboard: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>',
  phone: '<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M12 18h.01"/>',
  speaker: '<rect width="14" height="20" x="5" y="2" rx="2"/><circle cx="12" cy="14" r="3.5"/><path d="M12 6h.01"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  gamepad: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><rect width="20" height="12" x="2" y="6" rx="6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  mixer: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>',
  micOff: '<path d="m2 2 20 20"/><path d="M18.89 13.23A7 7 0 0 0 19 11v-1"/><path d="M5 10v1a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v2a3 3 0 0 0 5.12 2.12"/><path d="M12 18v4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  extern: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.67-.8a1 1 0 0 1 1.4.9v10.54a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.53"/>',
  pause2: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  screen: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M7 12a5 5 0 0 1 5-5"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  play2: '<path d="M7 4.5v15l12.5-7.5z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.45-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.97a4 4 0 0 1 3.3 1.7l.53.83"/><path d="M22 18h-6.04a4 4 0 0 1-3.3-1.8l-.36-.45"/>',
  star: '<path d="M11.48 3.5a.6.6 0 0 1 1.04 0l2.3 4.67 5.15.75a.6.6 0 0 1 .33 1.02l-3.73 3.63.88 5.13a.6.6 0 0 1-.87.63L12 16.9l-4.6 2.42a.6.6 0 0 1-.86-.63l.88-5.13-3.73-3.63a.6.6 0 0 1 .33-1.02l5.15-.75z"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  restart: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  ram: '<path d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3M8 11V9M16 11V9M12 11V9"/><rect width="20" height="10" x="2" y="6" rx="2"/>',
  disk: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01M10 16h.01"/>',
  net: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  battery: '<rect width="16" height="10" x="2" y="7" rx="2"/><path d="M22 11v2"/>',
  pinMap: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  cloudSun: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  cloudMoon: '<path d="M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6Z"/><path d="M10.1 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6 6 6 0 0 1-3 5.02"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  fog: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 17H7M17 21H9"/>',
  drizzle: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>',
  rain: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  snow: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>',
};
// Icône Wi-Fi avec le nombre de barres de signal (0 à 4)
const wifiBars = (n) => {
  const arcs = ['M8.5 16.43a5 5 0 0 1 7 0', 'M5 12.86a10 10 0 0 1 14 0', 'M2 8.82a15 15 0 0 1 20 0'];
  const lit = n >= 4 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h.01"/>${arcs.map((d, i) => `<path d="${d}" opacity="${i < lit ? 1 : 0.28}"/>`).join('')}</svg>`;
};
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5z"/>',
  pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/>',
  next: '<path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8.6-5.8a1 1 0 0 0 0-1.66l-8.6-5.8A1 1 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.6" height="14" rx="1.3"/>',
  prev: '<path d="M19 6.2v11.6a1 1 0 0 1-1.55.83l-8.6-5.8a1 1 0 0 1 0-1.66l8.6-5.8A1 1 0 0 1 19 6.2z"/><rect x="4.9" y="5" width="2.6" height="14" rx="1.3"/>',
};
const icon = (n) => P[n]
  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`
  : `<svg viewBox="0 0 24 24" fill="currentColor">${F[n]}</svg>`;
const setIcon = (el, n) => { if (el && el.dataset.cur !== n) { el.innerHTML = icon(n); el.dataset.cur = n; } };

// ---------- Pont vers Windows (ou démo dans un navigateur) ----------
const api = window.hub || createMock();

// ---------- Etat ----------
const wrap = $('#wrap');
let state = 'pill';
let sys = { wifi: null, wifiName: null, bt: null, volume: null, mute: false, output: null, dark: null, night: null };
let media = { active: false };
let base = { pos: 0, at: 0 };
const locks = {};
const locked = (k) => locks[k] && locks[k] > Date.now();
const lock = (k, ms = 2500) => { locks[k] = Date.now() + ms; };
let booted = false;

// ---------- Cartes du lecteur (aperçu + panneau) ----------
let cardId = 0;
function makeCard(host) {
  host.appendChild($('#cardTpl').content.cloneNode(true));
  const root = host.querySelector('.mcard');
  $$('[data-icon]', root).forEach((el) => setIcon(el, el.dataset.icon));
  const id = `clip${cardId++}`;
  const svg = $('.wave', root);
  svg.innerHTML =
    `<defs><clipPath id="${id}"><rect class="clip" x="0" y="-4" height="24" width="0"/></clipPath></defs>` +
    `<line class="rest" x1="0" y1="8" x2="0" y2="8"/>` +
    `<g clip-path="url(#${id})"><g class="amp"><path class="sine"/></g></g>` +
    `<rect class="thumb" y="1" width="3" height="14" rx="1.5"/>`;
  const c = {
    root, svg, w: 0,
    cover: $('.m-cover', root), img: $('.m-cover img', root),
    title: $('.m-title', root), artist: $('.m-artist', root),
    device: $('.m-device-name', root), play: $('.play', root),
    pos: $('.m-pos', root), dur: $('.m-dur', root),
    clip: $('.clip', root), rest: $('.rest', root), thumb: $('.thumb', root), sine: $('.sine', root),
    openBtn: $('.m-open', root), coverIc: $('.m-cover [data-icon]', root),
  };
  c.openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (musicApp) api.feat('apps:launch', { key: musicApp.key });
  });
  new ResizeObserver(() => buildWave(c)).observe(svg);
  root.addEventListener('click', onMediaClick);
  $('.m-bar', root).addEventListener('pointerdown', (e) => seekFrom(e, c));
  return c;
}

function buildWave(c) {
  const w = c.svg.clientWidth;
  if (!w || w === c.w) return;
  c.w = w;
  c.svg.setAttribute('viewBox', `0 0 ${w} 16`);
  const WL = 18, A = 3.2;
  let d = '';
  for (let x = -WL * 2; x <= w + 2; x += 1.5) {
    const y = 8 + A * Math.sin((2 * Math.PI * x) / WL);
    d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(2);
  }
  c.sine.setAttribute('d', d);
  c.rest.setAttribute('x2', w);
  drawProgress();
}

const cards = [makeCard($('#peekCard')), makeCard($('#openCard'))];
$$('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon));

// ---------- Taille et états de l'îlot ----------
// Titres trop longs dans la pilule : ils défilent doucement au lieu d'être coupés
function marquee() {
  $$('.layer-pill .mq').forEach((m) => {
    const inner = m.firstElementChild;
    if (!inner) return;
    const over = inner.scrollWidth - m.clientWidth;
    if (over > 3) {
      m.classList.add('run');
      m.style.setProperty('--mq', `${-over}px`);
      m.style.setProperty('--mqd', `${(6 + over / 22).toFixed(1)}s`);
    } else m.classList.remove('run');
  });
}
function size() {
  let w, h;
  if (state === 'pill') {
    // la pilule prend la largeur de son contenu (musique / heure + étiquettes)
    const row = $('.pill-row');
    w = Math.max(media.active ? 250 : 170, Math.min(560, (row ? row.offsetWidth : 200) + 30));
    h = 38;
  } else {
    const el = $(state === 'peek' ? '.peek-inner' : state === 'notif' ? '.notif-inner' : '.open-inner');
    w = el.offsetWidth; h = el.offsetHeight;
  }
  if (state === 'pill') requestAnimationFrame(marquee);
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  // zone occupée (sert, en jeu, à savoir si le curseur est sur la pilule)
  const pos = document.body.dataset.pos || 'top';
  const x = pos === 'tb-left' ? 0 : pos === 'tb-right' ? window.innerWidth - w : (window.innerWidth - w) / 2;
  const y = pos === 'top' ? 0 : window.innerHeight - h;
  if (api.rect) api.rect({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
}

// ---------- Apparence (réglée dans Paramètres) ----------
let ui = { accent: '#b5dca5', bg: '#1f171b', opacity: 100, openOn: 'click', peek: true, hiddenTabs: [], display: 'primary', notifs: true, notifsInGame: false, pillEvent: true, position: 'top', offset: 12 };
let musicApp = null;
const hexRgb = (h) => { const m = String(h).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? m.slice(1).map((x) => parseInt(x, 16)) : [31, 23, 27]; };
function inkFor(hex) {
  const [h] = rgbToHsl(...hexRgb(hex));
  return `hsl(${Math.round(h * 360)} 45% 13%)`;
}
function applyUi(next) {
  ui = { ...ui, ...(next || {}) };
  const st = document.documentElement.style;
  const [r, g, b] = hexRgb(ui.bg);
  const a = Math.max(0.6, Math.min(1, ui.opacity / 100));
  const pos = ['tb-left', 'tb-right'].includes(ui.position) ? ui.position : 'top';
  if (document.body.dataset.pos !== pos) { document.body.dataset.pos = pos; requestAnimationFrame(size); }
  st.setProperty('--on', ui.accent);
  st.setProperty('--on-ink', inkFor(ui.accent));
  st.setProperty('--bg', `rgba(${r}, ${g}, ${b}, ${a})`);
  st.setProperty('--bg-hover', `rgba(${Math.min(255, r + 11)}, ${Math.min(255, g + 9)}, ${Math.min(255, b + 11)}, ${a})`);
  $$('.tab').forEach((t) => { t.hidden = (ui.hiddenTabs || []).includes(t.dataset.tab); });
  if ((ui.hiddenTabs || []).includes(currentTab)) showTab('controls');
  followIndicator(200);
  if (typeof loadNextEvent === 'function') loadNextEvent();
  try { localStorage.setItem('hub.ui', JSON.stringify(ui)); } catch {}
}
async function loadMusicApp() {
  try { const r = await api.feat('music:app'); musicApp = r && r.ok ? r.data : null; } catch { musicApp = null; }
  renderMedia();
}

// ---------- Onglets ----------
const TABS = {};            // rempli par tabs.js : { show(), hide() }
let currentTab = 'controls';
function showTab(name) {
  if (!$(`.pane[data-pane="${name}"]`)) return;
  const order = $$('.tab').map((t) => t.dataset.tab);
  const dir = order.indexOf(name) >= order.indexOf(currentTab) ? 1 : -1;
  const changed = name !== currentTab;
  if (changed && TABS[currentTab] && TABS[currentTab].hide) TABS[currentTab].hide();
  currentTab = name;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
  if (state === 'open' && TABS[name] && TABS[name].show) TABS[name].show();
  if (changed) animatePane(dir);
  followIndicator();
  size();
}

// ---------- Animations ----------
// L'indicateur suit l'onglet actif pendant que son nom se déplie
let indT = null;
function followIndicator(ms = 520) {
  const ind = $('.tab-ind');
  const end = performance.now() + ms;
  cancelAnimationFrame(indT);
  const step = () => {
    const t = $('.tab.active');
    if (t && ind) { ind.style.width = t.offsetWidth + 'px'; ind.style.transform = `translateX(${t.offsetLeft}px)`; }
    if (performance.now() < end) indT = requestAnimationFrame(step);
  };
  step();
}
// Le contenu glisse dans le sens de l'onglet choisi, puis les cartes apparaissent en cascade
const STAGGER = '.grid > *, #openCard, .view-detail > *, .today-grid > *, .stats-grid > *, .bar, .clip, .apps-grid > .app, .wall, .power-btn, .power-info, .set-body > .card, .timer-body > *';
function animatePane(dir = 0) {
  const pane = $('.pane.active');
  if (!pane || wrap.classList.contains('game')) return;
  pane.style.setProperty('--dir', dir);
  pane.classList.remove('anim');
  $$(STAGGER, pane).slice(0, 24).forEach((el, i) => el.style.setProperty('--i', i));
  void pane.offsetWidth; // relance l'animation
  pane.classList.add('anim');
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
// molette sur la barre d'onglets : passer d'un onglet à l'autre
$('.tabs').addEventListener('wheel', (e) => {
  const names = $$('.tab').map((t) => t.dataset.tab);
  const i = names.indexOf(currentTab) + (e.deltaY > 0 ? 1 : -1);
  if (i >= 0 && i < names.length) showTab(names[i]);
}, { passive: true });

function setState(s) {
  if (s === state) return;
  if (s !== 'open') openedByShortcut = false;
  if (s !== 'open') {
    closeDetail(true);
    setTyping(false);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (TABS[currentTab] && TABS[currentTab].hide) TABS[currentTab].hide();
  }
  const wasOpen = state === 'open';
  state = s;
  wrap.dataset.state = s;
  size();
  kickProgress();
  api.panelOpen(s === 'open');
  if (s === 'open' && !wasOpen && TABS[currentTab] && TABS[currentTab].show) TABS[currentTab].show();
  if (s === 'open' && !wasOpen) { animatePane(0); followIndicator(); }
  if (s === 'pill' && notifQueue.length && !notifCur) setTimeout(nextNotif, 300);
}

// Taper dans un champ : la fenêtre doit pouvoir recevoir le clavier
document.addEventListener('pointerdown', (e) => {
  const f = e.target.closest('input, textarea');
  if (!f) return;
  setTyping(true);
  setTimeout(() => f.focus(), 40);
});
document.addEventListener('focusout', () => {
  setTimeout(() => {
    const a = document.activeElement;
    if (!a || !a.matches('input, textarea')) setTyping(false);
  }, 200);
});

let hovering = false, dragging = false, typing = false;
let openT, closeT, peekT, autoT;

let game = false;
wrap.addEventListener('mouseenter', () => {
  if (game && state !== 'open') return; // en jeu : la pilule laisse passer la souris
  hovering = true;
  clearTimeout(closeT); clearTimeout(peekT); clearTimeout(autoT);
  if (state === 'notif') { clearTimeout(notifT); return; } // on garde la notification tant qu'elle est survolée
  // option « Ouvrir au survol » (Paramètres)
  if (ui.openOn === 'hover' && state !== 'open' && !game) openT = setTimeout(() => setState('open'), state === 'peek' ? 60 : 220);
});
// Le panneau s'ouvre au CLIC sur la pilule (plus au simple survol)
wrap.addEventListener('click', (e) => {
  if (state === 'notif') { notifClick(e); return; }
  if (state === 'open' || (game && state !== 'open')) return;
  setState('open');
});
function leave() {
  hovering = false;
  clearTimeout(openT);
  clearTimeout(closeT);
  // notification survolée : elle repart 2 s après que la souris s'en va
  if (state === 'notif') { if (notifCur && !notifCur.sticky) { clearTimeout(notifT); notifT = setTimeout(nextNotif, 2000); } return; }
  // pendant une saisie, on laisse plus de temps avant de refermer
  closeT = setTimeout(() => { if (!dragging && !hovering) setState('pill'); }, typing ? 2500 : 420);
}
wrap.addEventListener('mouseleave', leave);
document.addEventListener('mouseleave', () => { setInteractive(false); if (hovering) leave(); });

// La fenêtre laisse passer les clics partout sauf sur l'îlot.
let interactive = false;
function setInteractive(v) { if (v !== interactive) { interactive = v; api.setInteractive(v); } }
document.addEventListener('mousemove', (e) => {
  const canUse = !game || state === 'open';
  setInteractive(dragging || typing || (canUse && wrap.contains(e.target)));
});

// g = { game, lock } : en jeu, la pilule n'est verrouillée que si la souris est cachée (en pleine partie)
api.on('ui:game', (g) => {
  const info = typeof g === 'object' && g ? g : { game: !!g, lock: !!g };
  game = !!info.lock;
  wrap.classList.toggle('game', !!info.game);
  if (game) {
    if (!dragging && !typing) setInteractive(false);
    // le curseur a quitté le panneau pendant le jeu : on referme (sauf ouverture au raccourci clavier)
    if (state === 'open' && !openedByShortcut) setState('pill');
  }
});

function peek() {
  if (!ui.peek || state !== 'pill' || hovering || notifQueue.length) return;
  setState('peek');
  clearTimeout(peekT);
  peekT = setTimeout(() => { if (state === 'peek' && !hovering) setState('pill'); }, 4200);
}

let openedByShortcut = false;
api.on('ui:toggle', () => {
  clearTimeout(autoT);
  if (state === 'open') { setState('pill'); return; }
  openedByShortcut = true;
  setState('open');
  autoT = setTimeout(() => { if (!hovering && state === 'open') setState('pill'); }, 6000);
});

// ---------- Contrôles système ----------
const tiles = Object.fromEntries($$('.tile').map((t) => [t.dataset.key, t]));

function renderTile(key, { on, unavailable, sub, ic }) {
  const t = tiles[key];
  t.classList.toggle('on', !!on);
  t.classList.toggle('unavailable', !!unavailable);
  $('small', t).textContent = sub;
  if (ic) setIcon($('.ic', t), ic);
}

function renderSys() {
  const s = sys;
  renderTile('wifi', {
    on: s.wifi === true, unavailable: s.wifi === null, ic: s.wifi ? 'wifi' : 'wifiOff',
    sub: s.wifi === null ? 'Indisponible' : s.wifi ? (s.wifiName || 'Activé') : 'Désactivé',
  });
  renderTile('bt', {
    on: s.bt === true, unavailable: s.bt === null, ic: s.bt ? 'bt' : 'btOff',
    sub: s.bt === null ? 'Indisponible' : s.bt ? 'Activé' : 'Désactivé',
  });
  renderTile('audio', {
    on: !s.mute, ic: s.mute ? 'volX' : 'vol2',
    sub: s.mute ? 'Muet' : (s.output || 'Sortie audio'),
  });
  renderTile('night', {
    on: s.night === true, unavailable: s.night === null,
    sub: s.night === null ? 'Indisponible' : s.night ? 'Activé' : 'Désactivé',
  });
  renderTile('dark', {
    on: s.dark === true, unavailable: s.dark === null,
    sub: s.dark === null ? 'Indisponible' : s.dark ? 'Activé' : 'Désactivé',
  });
  renderVolume();
  if (detail) renderDetailHead();
  cards.forEach((c) => { c.device.textContent = s.output || 'Sortie audio'; });
}

function renderVolume() {
  const v = sys.volume == null ? 0 : sys.volume;
  const slider = $('#volSlider');
  $('.fill', slider).style.width = v + '%';
  slider.classList.toggle('muted', !!sys.mute);
  $('#volPct b').textContent = sys.volume == null ? '–' : v + '%';
  setIcon($('.fill .ic', slider), sys.mute || v === 0 ? 'volX' : v < 34 ? 'vol1' : 'vol2');
}

function applySys(s) {
  for (const k of Object.keys(s)) if (!locked(k)) sys[k] = s[k];
  renderSys();
  saveSnap();
}

// Dernier état connu gardé en mémoire locale : au démarrage tout s'affiche avant même que Windows réponde.
let snapT = null;
function saveSnap() {
  clearTimeout(snapT);
  snapT = setTimeout(() => {
    try {
      localStorage.setItem('hub.sys', JSON.stringify(sys));
      localStorage.setItem('hub.media', JSON.stringify(media.active ? { active: true, title: media.title, artist: media.artist, duration: media.duration, position: currentPos(), status: 'Paused' } : { active: false }));
    } catch {}
  }, 1500);
}
function restoreSnap() {
  try {
    const s = JSON.parse(localStorage.getItem('hub.sys') || 'null');
    if (s) Object.assign(sys, s);
    const m = JSON.parse(localStorage.getItem('hub.media') || 'null');
    if (m && m.active) { media = m; base = { pos: m.position || 0, at: Date.now() }; }
    const c = localStorage.getItem('hub.cover');
    if (c && m && m.active) setCover(c);
  } catch {}
}

const OK = ['ok', 'Allowed', true];
async function toggle(key) {
  if (key === 'audio') {
    sys.mute = !sys.mute; lock('mute'); renderSys();
    await api.sys('mute', sys.mute);
    return;
  }
  const cur = sys[key];
  if (cur === null) { api.openSettings(key); return; }
  sys[key] = !cur; lock(key); renderSys();
  const r = await api.sys(key, !cur);
  if (!OK.includes(r)) {
    sys[key] = cur; locks[key] = 0; renderSys();
    if (r === 'unsupported') api.openSettings(key);
  }
}

Object.entries(tiles).forEach(([key, t]) => {
  $('.tile-main', t).addEventListener('click', () => toggle(key));
  const more = $('.tile-more', t);
  if (more) more.addEventListener('click', () => openDetail(key));
});

// Glisser pour le volume, molette pour ajuster
const slider = $('#volSlider');
function volFromEvent(e) {
  const r = slider.getBoundingClientRect();
  return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
}
let lastSend = 0, sendT;
function setVolume(v) {
  sys.volume = v;
  if (sys.mute && v > 0) { sys.mute = false; lock('mute'); api.sys('mute', false); }
  lock('volume', 1800);
  renderSys();
  const now = Date.now();
  clearTimeout(sendT);
  if (now - lastSend > 45) { lastSend = now; api.volume(v); }
  else sendT = setTimeout(() => { lastSend = Date.now(); api.volume(v); }, 45);
}
slider.addEventListener('pointerdown', (e) => {
  dragging = true;
  slider.setPointerCapture(e.pointerId);
  slider.classList.add('dragging');
  setVolume(volFromEvent(e));
});
slider.addEventListener('pointermove', (e) => { if (dragging) setVolume(volFromEvent(e)); });
const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  slider.classList.remove('dragging');
  if (!hovering) leave();
};
slider.addEventListener('pointerup', endDrag);
slider.addEventListener('pointercancel', endDrag);
const wheelVol = (e) => {
  e.preventDefault();
  setVolume(Math.max(0, Math.min(100, (sys.volume || 0) + (e.deltaY < 0 ? 2 : -2))));
};
slider.addEventListener('wheel', wheelVol, { passive: false });
tiles.audio.addEventListener('wheel', wheelVol, { passive: false });
$('#volPct').addEventListener('click', () => openDetail('mixer'));

// ---------- Sous-fenêtres : Wi-Fi / Bluetooth / Son ----------
let detail = null;          // 'wifi' | 'bt' | 'audio' | null
let dItems = [];
let dLoading = false;
let dRefreshT = null;
let dOpenKey = null;        // élément déplié (mot de passe, déconnexion)
const dBusy = new Set();
const dErr = {};
const dBody = $('.d-body');
const dSwitch = $('.view-detail .switch');
const TITLES = { wifi: 'Wi-Fi', bt: 'Bluetooth', audio: 'Son', mixer: 'Mélangeur' };

function openDetail(key) {
  detail = key;
  dItems = []; dOpenKey = null; dBusy.clear();
  for (const k in dErr) delete dErr[k];
  wrap.classList.add('detail');
  renderDetailHead();
  loadDetail();
  size();
}

function closeDetail(silent) {
  if (!detail) return;
  detail = null;
  clearTimeout(dRefreshT);
  setTyping(false);
  wrap.classList.remove('detail');
  if (!silent) size();
}

function radioOn() {
  return detail === 'wifi' ? sys.wifi === true : detail === 'bt' ? sys.bt === true : !sys.mute;
}

function renderDetailHead() {
  $('.d-title').textContent = TITLES[detail] || '';
  let sub = '';
  if (detail === 'wifi') sub = sys.wifi ? (sys.wifiName ? `Connecté à ${sys.wifiName}` : 'Non connecté') : 'Désactivé';
  if (detail === 'bt') {
    const n = dItems.filter((d) => d.connected).length;
    sub = sys.bt ? (n ? `${n} appareil${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}` : 'Aucun appareil connecté') : 'Désactivé';
  }
  if (detail === 'audio') sub = sys.mute ? 'Muet' : `Sortie : ${sys.output || '—'}`;
  if (detail === 'mixer') sub = `Volume de chaque appli · ${sys.output || 'sortie par défaut'}`;
  $('.d-sub').textContent = sub;
  dSwitch.classList.toggle('on', radioOn());
  dSwitch.hidden = (detail === 'wifi' && sys.wifi === null) || (detail === 'bt' && sys.bt === null) || detail === 'mixer';
  $('.d-refresh').classList.toggle('spin', dLoading);
}

async function loadDetail(quiet) {
  const key = detail;
  clearTimeout(dRefreshT);
  if (!key) return;
  if ((key === 'wifi' && sys.wifi === false) || (key === 'bt' && sys.bt === false)) {
    dItems = []; renderDetail(); return;
  }
  dLoading = true;
  renderDetailHead();
  if (!quiet && !dItems.length) renderDetail();
  const cmd = { wifi: 'wifi:list', bt: 'bt:list', audio: 'audio:list', mixer: 'mix:list' }[key];
  let r = null;
  try {
    if (key === 'mixer') { const f = await api.feat(cmd); r = f && f.ok ? f.data : null; }
    else r = await api.list(cmd);
  } catch { r = null; }
  if (detail !== key) return;
  dLoading = false;
  // pendant qu'on règle un curseur, on n'écrase pas l'affichage
  if (key === 'mixer' && mixDrag) { later2(key); return; }
  if (r && r.ok) { dItems = Array.isArray(r.items) ? r.items : r.items ? [r.items] : []; dFail = null; if (key === 'mixer') dMic = r.mic || null; }
  else dFail = (r && r.reason) || 'error';
  renderDetailHead();
  renderDetail();
  // actualisation automatique tant que la fenêtre est ouverte
  later2(key);
}
function later2(key) {
  const every = { wifi: 12000, bt: 4000, audio: 4000, mixer: 2500 }[key];
  clearTimeout(dRefreshT);
  dRefreshT = setTimeout(() => {
    if (detail !== key) return;
    if (dOpenKey || dBusy.size || mixDrag) later2(key); else loadDetail(true);
  }, every);
}
let dFail = null;
let dMic = null;
let mixDrag = null;   // curseur du mélangeur en cours de réglage

function msg(text, button) {
  return `<div class="d-msg"><span>${text}</span>${button || ''}</div>`;
}

function renderDetail() {
  const key = detail;
  if (!key) return;
  let html = '';
  if (key === 'wifi' && sys.wifi === false) html = msg('Le Wi-Fi est désactivé.');
  else if (key === 'bt' && sys.bt === false) html = msg('Le Bluetooth est désactivé.');
  else if (!dItems.length && dLoading) html = msg(key === 'wifi' ? 'Recherche des réseaux…' : 'Chargement…');
  else if (dFail === 'location') html = msg('Windows ne laisse voir les réseaux Wi-Fi qu\'aux applis qui ont accès à la localisation.', '<button class="pill-btn" data-act="location">Autoriser la localisation</button>');
  else if (dFail === 'noadapter') html = msg('Aucune carte Wi-Fi trouvée sur ce PC.');
  else if (dFail) html = msg('Impossible de charger la liste.', '<button class="pill-btn ghost" data-act="retry">Réessayer</button>');
  else if (key === 'mixer') html = mixerHtml();
  else if (!dItems.length) html = msg(key === 'bt' ? 'Aucun appareil associé. Associe-le une première fois depuis Windows.' : 'Rien à afficher.', key === 'bt' ? '<button class="pill-btn ghost" data-act="pair">Associer un appareil</button>' : '');
  else html = dItems.map((it) => itemHtml(key, it)).join('');
  if (key === 'audio' && dItems.length) html += `<button class="mx-out" data-act="mixer">${icon('mixer')}<span>Mélangeur : volume de chaque appli</span>${icon('chevron')}</button>`;
  dBody.innerHTML = html;
  const input = $('input', dBody);
  if (input) { setTyping(true); setTimeout(() => input.focus(), 30); } else setTyping(false);
  if (state === 'open') size();
}

function btIcon(d) {
  const n = (d.name || '').toLowerCase();
  if (/keyboard|clavier/.test(n)) return 'keyboard';
  if (/mouse|souris/.test(n)) return 'mouse';
  if (/controller|manette|xbox|dualsense|gamepad/.test(n)) return 'gamepad';
  if (/speaker|enceinte|partybox|boom|flip|charge|soundlink|sonos/.test(n)) return 'speaker';
  if (d.kind === 'AudioVideo' || /buds|airpods|headphone|headset|casque|écouteur|ecouteur/.test(n)) return 'headphones';
  if (d.kind === 'Phone') return 'phone';
  if (d.kind === 'Computer') return 'monitor';
  if (d.kind === 'Peripheral') return 'mouse';
  return 'bt';
}

function audioIcon(o) {
  const n = (o.name || '').toLowerCase();
  if (/headphone|headset|casque|écouteur|ecouteur|buds|airpods/.test(n)) return 'headphones';
  if (/hdmi|display|monitor|écran|nvidia|amd high definition/.test(n)) return 'monitor';
  if (/partybox|enceinte|speaker.*bt|bluetooth/.test(n)) return 'speaker';
  return 'vol2';
}

function itemHtml(key, it) {
  if (key === 'wifi') {
    const id = 'w:' + it.ssid;
    const busy = dBusy.has(id), open = dOpenKey === id;
    const sub = it.connected ? 'Connecté' : busy ? 'Connexion…' : it.known ? 'Enregistré' : it.secure ? 'Sécurisé' : 'Ouvert';
    let extra = '';
    if (open && it.connected) extra = `<button class="pill-btn" data-act="wifi-off">Se déconnecter</button>`;
    else if (open) extra = `<input type="password" placeholder="Mot de passe" data-ssid="${esc(it.ssid)}" autocomplete="off"><button class="pill-btn" data-act="wifi-pass">Se connecter</button>`;
    const err = dErr[id] ? `<div class="it-extra" style="display:flex"><span class="err">${esc(dErr[id])}</span></div>` : '';
    return `<div class="item ${it.connected ? 'active' : ''} ${busy ? 'busy' : ''} ${open ? 'open' : ''}" data-id="${esc(id)}">
      <button class="it-main" data-act="wifi"><span class="it-ic">${wifiBars(it.bars)}</span>
        <span class="it-tx"><b>${esc(it.ssid)}</b><small>${sub}</small></span>
        <span class="it-end">${it.secure ? icon('lock') : ''}</span></button>
      <div class="it-extra">${extra}</div>${err}</div>`;
  }
  if (key === 'bt') {
    const id = 'b:' + it.addr;
    const busy = dBusy.has(id);
    const sub = busy ? (it.connected ? 'Déconnexion…' : 'Connexion…') : it.connected ? 'Connecté' : it.audio ? 'Cliquer pour connecter' : 'Non connecté';
    const err = dErr[id] ? `<div class="it-extra" style="display:flex"><span class="err">${esc(dErr[id])}</span></div>` : '';
    return `<div class="item ${it.connected ? 'active' : ''} ${busy ? 'busy' : ''} ${it.audio ? '' : 'static'}" data-id="${esc(id)}">
      <button class="it-main" data-act="${it.audio ? 'bt' : ''}" title="${it.audio ? '' : 'Windows gère la connexion de cet appareil'}"><span class="it-ic">${icon(btIcon(it))}</span>
        <span class="it-tx"><b>${esc(it.name)}</b><small>${sub}</small></span>
        <span class="it-end"></span></button>${err}</div>`;
  }
  const id = 'a:' + it.id;
  const busy = dBusy.has(id);
  return `<div class="item ${it.current ? 'active' : ''} ${busy ? 'busy' : ''}" data-id="${esc(id)}">
    <button class="it-main" data-act="audio"><span class="it-ic">${icon(audioIcon(it))}</span>
      <span class="it-tx"><b>${esc(it.name)}</b><small>${it.current ? 'Sortie actuelle' : 'Utiliser cette sortie'}</small></span>
      <span class="it-end">${it.current ? icon('check') : ''}</span></button></div>`;
}

// ---------- Mélangeur ----------
function mixRowHtml(a) {
  const id = 'm:' + a.key;
  return `<div class="item mx ${a.mute ? 'muted' : ''}" data-id="${esc(id)}">
    <span class="mx-ic">${a.icon ? `<img src="${a.icon}" alt="">` : icon(a.key === 'system' ? 'bell' : 'vol2')}</span>
    <div class="mx-mid">
      <div class="mx-top"><b>${esc(a.name)}</b>${a.active && !a.mute ? '<i class="mx-live" title="Joue du son"></i>' : ''}<span class="mx-pct">${a.mute ? 'Muet' : a.vol + ' %'}</span></div>
      <div class="mx-slider" data-act="mix-vol"><div class="mx-fill" style="width:${a.vol}%"></div></div>
    </div>
    <button class="mx-mute" data-act="mix-mute" title="${a.mute ? 'Remettre le son' : 'Couper le son'}">${icon(a.mute ? 'volX' : 'vol2')}</button>
  </div>`;
}
function mixerHtml() {
  let h = '';
  if (dMic) {
    h += `<div class="item mx-mic ${dMic.mute ? 'off' : ''}" data-id="mic">
      <button class="it-main" data-act="mic"><span class="it-ic">${icon(dMic.mute ? 'micOff' : 'mic')}</span>
        <span class="it-tx"><b>Micro ${dMic.mute ? 'coupé' : 'actif'}</b><small>${esc(dMic.name || 'Micro par défaut')}</small></span>
        <span class="it-end"><span class="switch ${dMic.mute ? '' : 'on'}"><i></i></span></span></button></div>`;
  }
  if (!dItems.length) h += msg(dLoading ? 'Chargement…' : 'Aucune appli ne joue de son pour l\'instant.');
  else h += dItems.map(mixRowHtml).join('');
  h += `<button class="mx-out" data-act="outputs">${icon('headphones')}<span>Changer de sortie audio</span>${icon('chevron')}</button>`;
  return h;
}
function mixSet(row, e) {
  const key = row.dataset.id.slice(2);
  const a = dItems.find((x) => x.key === key);
  if (!a) return;
  const r = $('.mx-slider', row).getBoundingClientRect();
  const v = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
  mixApply(row, a, v);
}
function mixApply(row, a, v) {
  a.vol = v;
  if (a.mute && v > 0) { a.mute = false; row.classList.remove('muted'); $('.mx-mute', row).innerHTML = icon('vol2'); api.feat('mix:mute', { key: a.key, mute: false }); }
  $('.mx-fill', row).style.width = v + '%';
  $('.mx-pct', row).textContent = v + ' %';
  api.feat('mix:volume', { key: a.key, vol: v });
}
dBody.addEventListener('pointerdown', (e) => {
  const sl = e.target.closest('.mx-slider');
  if (!sl || detail !== 'mixer') return;
  const row = sl.closest('.item');
  mixDrag = row; dragging = true;
  sl.setPointerCapture(e.pointerId);
  row.classList.add('dragging');
  mixSet(row, e);
});
dBody.addEventListener('pointermove', (e) => { if (mixDrag && e.target.closest('.mx-slider')) mixSet(mixDrag, e); });
const mixEnd = () => {
  if (!mixDrag) return;
  mixDrag.classList.remove('dragging');
  mixDrag = null; dragging = false;
  if (!hovering) leave();
};
dBody.addEventListener('pointerup', mixEnd);
dBody.addEventListener('pointercancel', mixEnd);
dBody.addEventListener('wheel', (e) => {
  const row = e.target.closest('.item.mx');
  if (!row || detail !== 'mixer') return;
  e.preventDefault();
  const a = dItems.find((x) => x.key === row.dataset.id.slice(2));
  if (a) mixApply(row, a, Math.max(0, Math.min(100, a.vol + (e.deltaY < 0 ? 4 : -4))));
}, { passive: false });

function itemOf(el) {
  const box = el.closest('.item');
  if (!box) return null;
  const id = box.dataset.id;
  const it = dItems.find((x) => (detail === 'wifi' ? 'w:' + x.ssid : detail === 'bt' ? 'b:' + x.addr : 'a:' + x.id) === id);
  return it ? { id, it } : null;
}

async function wifiConnect(id, it, password) {
  delete dErr[id];
  dBusy.add(id); dOpenKey = null; renderDetail();
  const r = await api.list('wifi:connect', { ssid: it.ssid, password });
  dBusy.delete(id);
  if (r !== 'ok') {
    dErr[id] = r === 'InvalidCredential' ? 'Mot de passe incorrect.' : 'Connexion impossible' + (typeof r === 'string' ? ` (${r})` : '') + '.';
    if (it.secure && !it.known) dOpenKey = id;
  }
  renderDetail();
  setTimeout(() => loadDetail(true), 1500);
}

dBody.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !b.dataset.act) return;
  const act = b.dataset.act;
  if (act === 'location') { api.openSettings('location'); return; }
  if (act === 'pair') { api.openSettings('bt'); return; }
  if (act === 'retry') { loadDetail(); return; }
  if (act === 'outputs') { openDetail('audio'); return; }
  if (act === 'mixer') { openDetail('mixer'); return; }
  if (act === 'mic' && dMic) {
    dMic.mute = !dMic.mute; renderDetail();
    await api.feat('mic:mute', { mute: dMic.mute });
    return;
  }
  if (act === 'mix-mute') {
    const row = b.closest('.item'), a = dItems.find((x) => 'm:' + x.key === row.dataset.id);
    if (!a) return;
    a.mute = !a.mute; renderDetail();
    await api.feat('mix:mute', { key: a.key, mute: a.mute });
    return;
  }
  if (act === 'mix-vol') return;
  const found = itemOf(b);
  if (!found) return;
  const { id, it } = found;
  if (dBusy.has(id)) return;

  if (act === 'wifi') {
    if (it.connected || (it.secure && !it.known)) { dOpenKey = dOpenKey === id ? null : id; delete dErr[id]; renderDetail(); return; }
    wifiConnect(id, it, '');
  } else if (act === 'wifi-pass') {
    const input = $('input', b.closest('.item'));
    if (!input.value) { input.focus(); return; }
    wifiConnect(id, it, input.value);
  } else if (act === 'wifi-off') {
    dBusy.add(id); dOpenKey = null; renderDetail();
    await api.list('wifi:disconnect');
    dBusy.delete(id);
    setTimeout(() => loadDetail(true), 1200);
  } else if (act === 'bt') {
    delete dErr[id];
    dBusy.add(id); renderDetail();
    const r = await api.list('bt:connect', { addr: it.addr, connect: !it.connected });
    if (r !== 'ok') { dBusy.delete(id); dErr[id] = 'Windows a refusé l\'action sur cet appareil.'; renderDetail(); return; }
    // la (dé)connexion prend quelques secondes : on actualise jusqu'à voir le changement
    const want = !it.connected;
    for (let i = 0; i < 6 && detail === 'bt'; i++) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const l = await api.list('bt:list');
      if (l && l.ok) {
        dItems = l.items || [];
        const now = dItems.find((x) => x.addr === it.addr);
        if (now && now.connected === want) break;
      }
    }
    dBusy.delete(id);
    if (detail === 'bt') { renderDetailHead(); renderDetail(); }
  } else if (act === 'audio') {
    if (it.current) return;
    dBusy.add(id); renderDetail();
    await api.list('audio:set', { id: it.id });
    dBusy.delete(id);
    loadDetail(true);
  }
});

dBody.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('input')) $('[data-act="wifi-pass"]', e.target.closest('.item')).click();
  if (e.key === 'Escape') { dOpenKey = null; renderDetail(); }
});

$('.d-back').addEventListener('click', () => closeDetail());
$('.d-refresh').addEventListener('click', () => loadDetail());
dSwitch.addEventListener('click', async () => {
  const key = detail;
  await toggle(key === 'audio' ? 'audio' : key);
  if (detail === key) setTimeout(() => loadDetail(), key === 'audio' ? 0 : 1800);
  renderDetailHead();
  renderDetail();
});

// Pour taper un mot de passe, la fenêtre doit pouvoir recevoir le clavier.
function setTyping(on) {
  if (on === typing) return;
  typing = on;
  if (api.focus) api.focus(on);
  if (on) setInteractive(true);
}


// =====================================================================
// Notifications dans la pilule (Windows, agenda, minuteur)
// =====================================================================
const notifQueue = [];
let notifCur = null, notifT = null;
const nEl = (s) => $(s, $('.layer-notif'));
function notify(n) {
  // n = { app, title, body, icon (data:URL), glyph (nom d'icône), accent, ms, sticky, onClick }
  notifQueue.push(n);
  if (!notifCur) nextNotif();
}
function nextNotif() {
  clearTimeout(notifT);
  notifCur = notifQueue.shift() || null;
  if (!notifCur) { if (state === 'notif') setState('pill'); return; }
  if (state === 'open') { notifQueue.unshift(notifCur); notifCur = null; return; } // panneau ouvert : on attend
  const n = notifCur;
  const ic = nEl('.notif-ic');
  ic.classList.toggle('accent', !!n.accent);
  ic.innerHTML = n.icon ? `<img src="${n.icon}" alt="">` : icon(n.glyph || 'bell');
  nEl('.notif-app').textContent = n.app || '';
  nEl('.notif-title').textContent = n.title || '';
  nEl('.notif-body').textContent = n.body || '';
  nEl('.notif-body').hidden = !n.body;
  setState('notif');
  if (!n.sticky) notifT = setTimeout(nextNotif, n.ms || 5500);
}
function notifClick(e) {
  const n = notifCur;
  if (n && n.onClick && !e.target.closest('.notif-x')) n.onClick();
  nextNotif();
}
// panneau refermé : on affiche les notifications en attente
setInterval(() => { if (!notifCur && notifQueue.length && state === 'pill') nextNotif(); }, 1000);
api.on('notif', (n) => {
  if (n.action === 'update') {
    notify({ app: n.app, title: n.title, body: n.body, glyph: 'download', accent: true, ms: 10000, onClick: () => api.feat('update:install') });
    return;
  }
  notify({ app: n.app, title: n.title || n.app, body: n.body, icon: n.icon, glyph: 'bell' });
});

// petit son (aucun fichier : généré à la volée)
let audioCtx = null;
function beep(times = 3) {
  try {
    audioCtx = audioCtx || new AudioContext();
    for (let i = 0; i < times; i++) {
      const t = audioCtx.currentTime + i * 0.32;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(i % 2 ? 784 : 988, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.3);
    }
  } catch {}
}

// =====================================================================
// Minuteur / chrono (partagés entre la pilule et l'onglet Minuteur)
// =====================================================================
const clock = {
  timer: { duration: 5 * 60e3, endAt: 0, remaining: 5 * 60e3, running: false, done: false },
  sw: { startAt: 0, elapsed: 0, running: false, laps: [] },
};
try { const c = JSON.parse(localStorage.getItem('hub.clock') || 'null'); if (c) Object.assign(clock, c); } catch {}
const saveClock = () => { try { localStorage.setItem('hub.clock', JSON.stringify(clock)); } catch {} };
const timerLeft = () => (clock.timer.running ? Math.max(0, clock.timer.endAt - Date.now()) : clock.timer.remaining);
const swElapsed = () => clock.sw.elapsed + (clock.sw.running ? Date.now() - clock.sw.startAt : 0);
function fmtClock(ms, cs = false) {
  const t = Math.max(0, ms);
  const h = Math.floor(t / 3600e3), m = Math.floor((t % 3600e3) / 60e3), s = Math.floor((t % 60e3) / 1e3);
  const base = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return cs ? base + '.' + String(Math.floor((t % 1e3) / 10)).padStart(2, '0') : base;
}
function timerDone() {
  clock.timer.running = false; clock.timer.remaining = 0; clock.timer.done = true; saveClock();
  beep(4); setTimeout(() => beep(4), 1600);
  notify({ app: 'Minuteur', title: 'Temps écoulé !', body: `Minuteur de ${fmtClock(clock.timer.duration)} terminé`, glyph: 'timer', accent: true, sticky: true,
    onClick: () => { clock.timer.done = false; clock.timer.remaining = clock.timer.duration; saveClock(); renderChips(); } });
  renderChips();
}
// une seule horloge pour tout : 4 fois par seconde si quelque chose tourne, sinon presque rien
setInterval(() => {
  if (clock.timer.running && timerLeft() <= 0) timerDone();
  if (clock.timer.running || clock.sw.running) { renderChips(); if (TABS.timer && currentTab === 'timer' && state === 'open') TABS.timer.tick(); }
}, 250);

// =====================================================================
// Prochain événement (Google Agenda) dans la pilule + rappel 10 min avant
// =====================================================================
let nextEvent = null;
const reminded = new Set();
async function loadNextEvent() {
  if (!ui.pillEvent) { nextEvent = null; renderChips(); return; }
  try { const r = await api.feat('cal:next'); nextEvent = r && r.ok ? r.data : null; } catch { nextEvent = null; }
  renderChips();
}
setInterval(loadNextEvent, 60e3);
setTimeout(loadNextEvent, 1500);

function renderChips() {
  const box = $('.pill-chips');
  if (!box) return;
  let html = '';
  const now = Date.now();
  if (nextEvent && ui.pillEvent) {
    const e = nextEvent;
    const mins = Math.round((e.start - now) / 60e3);
    let cls = '', when;
    if (e.start <= now) { cls = 'now'; when = 'En cours'; }
    else if (e.allDay) when = new Date(e.start).toDateString() === new Date().toDateString() ? "Aujourd'hui" : 'Demain';
    else if (mins <= 60) { cls = mins <= 15 ? 'soon' : ''; when = `dans ${mins} min`; }
    else when = new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    html += `<span class="pchip ev ${cls}" title="${esc(e.title)}">${icon('calendar')}<span data-t>${esc(when)}</span><span class="mq"><span data-t>· ${esc(e.title)}</span></span></span>`;
    const key = e.start + '|' + e.title;
    if (!e.allDay && e.start > now && e.start - now <= 10 * 60e3 && !reminded.has(key)) {
      reminded.add(key);
      notify({ app: 'Agenda', title: e.title, body: `Dans ${Math.max(1, mins)} min · ${new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${e.location ? ' · ' + e.location : ''}`, glyph: 'calendar', accent: true, ms: 9000 });
    }
  }
  if (clock.timer.running || clock.timer.done) html += `<span class="pchip timer ${clock.timer.done ? 'done' : ''}">${icon('timer')}<span data-t>${clock.timer.done ? 'Terminé' : fmtClock(timerLeft())}</span></span>`;
  else if (clock.sw.running) html += `<span class="pchip timer">${icon('flag')}<span data-t>${fmtClock(swElapsed())}</span></span>`;
  if (box.innerHTML !== html) {
    // on ne remplace que si ça change (évite de relancer les animations)
    const keys = html.replace(/<span data-t>[^<]*<\/span>/g, '');
    if (box.dataset.keys === keys) { const spans = $$('[data-t]', box), tmp = document.createElement('div'); tmp.innerHTML = html; $$('[data-t]', tmp).forEach((x, i) => { if (spans[i] && spans[i].textContent !== x.textContent) spans[i].textContent = x.textContent; }); }
    else box.innerHTML = html;
    box.dataset.keys = keys;
    if (state === 'pill') size();
  }
}
// rafraîchit le « dans X min » chaque minute
setInterval(renderChips, 30e3);

// ---------- Lecteur ----------
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const playing = () => media.active && media.status === 'Playing';

function currentPos() {
  let p = base.pos + (playing() ? Date.now() - base.at : 0);
  if (media.duration > 0) p = Math.min(p, media.duration);
  return Math.max(0, p);
}

function applyMedia(d) {
  if (d.thumbChanged) setCover(d.thumb || null);
  if (d.partial) return;
  const prevTitle = media.title;
  const wasActive = media.active;
  if (locked('status') && d.active) d.status = media.status;
  media = d;
  if (d.active && !locked('seek')) {
    let pos = d.position || 0;
    const age = d.now - d.updated;
    if (d.status === 'Playing' && d.updated > 0 && age > 0 && age < 6 * 3600e3) pos += age;
    base = { pos, at: Date.now() };
  }
  renderMedia();
  saveSnap();
  if (booted && d.active && d.title && (d.title !== prevTitle || !wasActive)) peek();
  if (state === 'pill') requestAnimationFrame(size);
}

function renderMedia() {
  const on = media.active;
  const isPlaying = playing();
  wrap.classList.toggle('has-media', on);
  wrap.classList.toggle('playing', isPlaying);
  const pt = $('.pill-title'), ptText = on ? [media.title, media.artist].filter(Boolean).join(' · ') : '';
  if (pt.textContent !== ptText) { pt.classList.add('mq'); pt.innerHTML = `<span>${esc(ptText)}</span>`; }
  cards.forEach((c) => {
    c.root.classList.toggle('idle', !on);
    c.root.classList.toggle('playing', isPlaying);
    c.root.classList.toggle('no-time', on && !(media.duration > 0));
    c.title.textContent = on ? (media.title || 'Sans titre') : 'Aucune musique';
    c.artist.textContent = on ? (media.artist || '') : musicApp ? `Lance ${musicApp.name} : le morceau s'affichera ici` : "Lance ta musique : elle s'affichera ici";
    setIcon(c.coverIc, on ? 'note' : 'disc');
    c.openBtn.hidden = on || !musicApp;
    if (!on && musicApp) c.openBtn.innerHTML = `${icon('play2')}Ouvrir ${esc(musicApp.name)}`;
    c.play.classList.toggle('playing', isPlaying);
    setIcon(c.play, isPlaying ? 'pause' : 'play');
  });
  drawProgress();
  kickProgress();
}

function drawProgress() {
  const dur = media.duration || 0;
  const pos = currentPos();
  const p = dur > 0 ? pos / dur : 0;
  cards.forEach((c) => {
    if (!c.w) return;
    const x = p * c.w;
    c.clip.setAttribute('width', Math.max(0, x - 4));
    c.rest.setAttribute('x1', Math.min(c.w, x + 5));
    c.rest.style.opacity = x + 5 >= c.w ? 0 : 1;
    c.thumb.setAttribute('x', x - 1.5);
    c.pos.textContent = fmt(pos);
    c.dur.textContent = fmt(dur);
  });
}

// La barre de progression n'est mise à jour (4 fois par seconde) que si elle est visible et que ça joue.
let progT = null;
function kickProgress() {
  const need = state !== 'pill' && playing();
  if (need && !progT) progT = setInterval(drawProgress, 250);
  else if (!need && progT) { clearInterval(progT); progT = null; }
}

async function onMediaClick(e) {
  const b = e.target.closest('[data-m]');
  if (!b) return;
  const cmd = b.dataset.m;
  if (cmd === 'toggle' && media.active) {
    base = { pos: currentPos(), at: Date.now() };
    media.status = playing() ? 'Paused' : 'Playing';
    lock('status', 1500);
    renderMedia();
  }
  await api.media(cmd);
}

function seekFrom(e, c) {
  if (!media.active || !(media.duration > 0)) return;
  const r = c.svg.getBoundingClientRect();
  const ms = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * media.duration);
  base = { pos: ms, at: Date.now() };
  lock('seek', 1500);
  drawProgress();
  api.media('seek', ms);
}

// Pochette + couleurs du lecteur tirées de la pochette
function setCover(src) {
  try { if (src) localStorage.setItem('hub.cover', src); else localStorage.removeItem('hub.cover'); } catch {}
  const targets = [...cards.map((c) => [c.cover, c.img]), [$('.pill-cover'), $('.pill-cover img')]];
  targets.forEach(([box, img]) => {
    box.classList.toggle('has-img', !!src);
    if (src) img.src = src; else img.removeAttribute('src');
  });
  if (!src) { resetColors(); return; }
  const probe = new Image();
  probe.onload = () => { try { applyColors(probe); } catch { resetColors(); } };
  probe.src = src;
}

function resetColors() {
  ['--m-bg', '--m-accent', '--m-ink'].forEach((v) => wrap.style.removeProperty(v));
}

function applyColors(img) {
  const N = 24;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, N);
  const px = ctx.getImageData(0, 0, N, N).data;
  let r = 0, g = 0, b = 0, wsum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const [, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    const w = s * s * Math.max(0.05, 1 - Math.abs(l - 0.5) * 1.7) + 0.002;
    r += px[i] * w; g += px[i + 1] * w; b += px[i + 2] * w; wsum += w;
  }
  const [h, s] = rgbToHsl(r / wsum, g / wsum, b / wsum);
  const H = Math.round(h * 360);
  if (s < 0.12) {
    wrap.style.setProperty('--m-bg', `hsl(${H} 6% 15%)`);
    wrap.style.setProperty('--m-accent', `hsl(${H} 18% 84%)`);
    wrap.style.setProperty('--m-ink', `hsl(${H} 10% 12%)`);
    return;
  }
  wrap.style.setProperty('--m-bg', `hsl(${H} ${Math.round(Math.min(58, 22 + s * 40))}% 14%)`);
  wrap.style.setProperty('--m-accent', `hsl(${H} ${Math.round(Math.max(62, s * 100))}% 73%)`);
  wrap.style.setProperty('--m-ink', `hsl(${H} 55% 11%)`);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

// ---------- Horloge de la pilule ----------
function tick() {
  const d = new Date();
  $('.clock-t').textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('.clock-d').textContent = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
// l'heure de la pilule n'a besoin d'être redessinée qu'une fois par minute
(function minuteClock() {
  tick();
  setTimeout(minuteClock, 60000 - (Date.now() % 60000) + 50);
})();

// Le panneau suit la taille de son contenu (images qui se chargent, listes qui changent…)
new ResizeObserver(() => { if (state === 'open') size(); }).observe($('.open-inner'));
new ResizeObserver(() => { if (state === 'peek') size(); }).observe($('.peek-inner'));

// ---------- Démarrage ----------
api.on('sys:state', applySys);
api.on('media:state', applyMedia);
try { const u = JSON.parse(localStorage.getItem('hub.ui') || 'null'); if (u) applyUi(u); } catch {}
api.feat('settings:get').then((r) => { if (r && r.ok) applyUi(r.data.ui); }).catch(() => {});
loadMusicApp();
if (window.hub) restoreSnap();
renderSys();
renderMedia();
size();
api.ready();
setTimeout(() => { booted = true; }, 2500);

// ---------- Mode démo (ouverture dans un navigateur, sans Electron) ----------
function createMock() {
  const listeners = {};
  const emit = (ch, d) => (listeners[ch] || []).forEach((cb) => cb(d));
  const s = { wifi: true, wifiName: 'Freebox-Celyan', bt: true, volume: 64, mute: false, output: 'Headphones (Bluff Partybox 165)', dark: true, night: false };
  const cover = 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="35%" cy="35%" r="80%"><stop offset="0" stop-color="#ff5a4e"/><stop offset=".55" stop-color="#c41f2c"/><stop offset="1" stop-color="#4a0710"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="68" cy="62" r="22" fill="#2a0408" opacity=".55"/><path d="M10 80 Q40 50 90 70" stroke="#ffd2c4" stroke-width="3" fill="none" opacity=".7"/></svg>'
  );
  const m = { active: true, title: 'KICK BACK', artist: 'Kenshi Yonezu', status: 'Playing', position: 54000, duration: 193000, updated: Date.now(), now: Date.now(), thumbChanged: true, thumb: cover };
  setTimeout(() => {
    emit('sys:state', { ...s });
    emit('media:state', { ...m });
    const q = new URLSearchParams(location.search);
    const st = q.get('state');
    if (st) { setState(st); }
    if (q.get('detail')) openDetail(q.get('detail'));
    if (q.get('tab')) showTab(q.get('tab'));
  }, 80);
  return {
    on: (ch, cb) => (listeners[ch] = listeners[ch] || []).push(cb),
    ready() {}, setInteractive() {}, panelOpen() {},
    async sys(type, v) { if (type === 'mute') s.mute = v; else s[type] = v; return 'ok'; },
    volume(v) { s.volume = v; },
    async media(cmd) { if (cmd === 'toggle') m.status = m.status === 'Playing' ? 'Paused' : 'Playing'; return true; },
    openSettings(k) { console.log('paramètres', k); },
    focus() {},
    async feat(name, args) {
      const ok = (data) => ({ ok: true, data });
      const sw = (c, w, h) => 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${c} 45% 55%)"/><stop offset="1" stop-color="hsl(${c + 40} 50% 22%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${h * 0.18}" fill="hsl(${c + 20} 70% 80%)" opacity=".7"/></svg>`);
      const d = new Date();
      const day = (i) => new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10);
      switch (name) {
        case 'today:weather': return ok({ stale: false, data: { city: 'Dourdan', now: { temp: 14.2, feels: 12.6, code: 2, day: true, wind: 11, humidity: 70 },
          days: [[2, 9, 16], [61, 8, 13], [3, 7, 12], [0, 5, 15], [80, 9, 14]].map(([code, min, max], i) => ({ date: day(i), code, min, max })) } });
        case 'today:notes': return ok('Scrim 21h avec la team\nRevoir les compos Ascent');
        case 'stats:start':
          clearInterval(this._st);
          this._st = setInterval(() => emit('feat:event', { type: 'stats', data: { cpu: 18 + Math.round(Math.random() * 30), cpuName: 'AMD Ryzen 7 7800X3D 8-Core Processor', cores: 16, ramTotal: 32 * 2 ** 30, ramFree: 17.3 * 2 ** 30, gpu: 40 + Math.round(Math.random() * 40), gpuName: 'NVIDIA GeForce RTX 4070', disk: { total: 931 * 2 ** 30, free: 284 * 2 ** 30 }, down: Math.random() * 3e6, up: Math.random() * 4e5, uptime: 3 * 3600 + 720 } }), 300);
          return ok(true);
        case 'stats:stop': clearInterval(this._st); return ok(true);
        case 'clip:list': return ok({ paused: false, items: [
          { id: '1', type: 'text', text: 'https://www.vlr.gg/team/prizm-esport', t: Date.now() - 20000, pinned: true },
          { id: '2', type: 'image', thumb: sw(260, 280, 158), w: 1920, h: 1080, t: Date.now() - 120000 },
          { id: '3', type: 'text', text: 'Comp Ascent : Jett, Sova, KAY/O, Killjoy, Omen', t: Date.now() - 600000 },
          { id: '4', type: 'text', text: 'git commit -m "fix: pochette deezer"', t: Date.now() - 7200000 },
        ] });
        case 'apps:mine': return ok(this._mine || (this._mine = [['val', 'VALORANT'], ['dis', 'Discord'], ['dz', 'Deezer'], ['obs', 'OBS Studio']].map(([id, name]) => ({ id, name, key: 'id:' + id }))));
        case 'apps:installed': return ok([['val', 'VALORANT'], ['riot', 'Riot Client'], ['dis', 'Discord'], ['dz', 'Deezer'], ['chr', 'Google Chrome'], ['obs', 'OBS Studio'], ['st', 'Steam'], ['vs', 'Visual Studio Code'], ['fig', 'Figma']].map(([id, name]) => ({ id, name })));
        case 'apps:icons': return ok({});
        case 'apps:add': this._mine.push({ id: args.id, name: args.name, key: 'id:' + args.id }); return ok(this._mine);
        case 'apps:remove': this._mine = this._mine.filter((a) => a.key !== args.key); return ok(this._mine);
        case 'wall:list': return ok({ folder: 'C:\\Users\\Celyan\\Pictures\\Fonds', folderName: 'Fonds', current: 'w2', items: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ path: 'w' + i, name: 'fond' + i + '.jpg' })) });
        case 'wall:thumbs': return ok(Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['w' + i, sw(i * 45, 320, 200)])));
        case 'power:info': return ok({ uptime: 3 * 3600 + 720 });
        case 'settings:get': return ok({ ui: this._ui || (this._ui = { accent: '#b5dca5', bg: '#1f171b', opacity: 100, openOn: 'click', peek: true, hiddenTabs: [], display: 'primary', notifs: true, notifsInGame: false, pillEvent: true }), gameMode: true, login: false, calConnected: !!this._cal, city: '', autoCity: 'Dourdan', clipMax: 50, musicApp: '', apps: [{ key: 'id:dz', name: 'Deezer' }, { key: 'id:val', name: 'VALORANT' }], screens: [{ id: '1', name: 'LG', size: '2560×1440', primary: true }, { id: '2', name: 'Dell', size: '1920×1080', primary: false }] });
        case 'settings:set': if (args.key === 'ui') this._ui = args.value; return ok(true);
        case 'music:app': return ok({ key: 'id:dz', name: 'Deezer' });
        case 'mix:list': return ok({ ok: true, mic: { name: 'Micro (HyperX QuadCast)', mute: false }, items: [
          { key: 'discord', name: 'Discord', vol: 80, mute: false, active: true, icon: null },
          { key: 'valorant', name: 'VALORANT', vol: 65, mute: false, active: true, icon: null },
          { key: 'deezer', name: 'Deezer', vol: 35, mute: false, active: true, icon: null },
          { key: 'chrome', name: 'Google Chrome', vol: 100, mute: true, active: false, icon: null },
          { key: 'system', name: 'Sons système', vol: 50, mute: false, active: false, icon: null },
        ] });
        case 'mix:volume': case 'mix:mute': case 'mic:mute': return ok(true);
        case 'update:status': return ok({ state: 'ready', current: '1.2.1', latest: '1.3.0', repo: 'FroseFox/WindowsHub', packaged: true });
        case 'update:check': return ok({ state: 'uptodate', current: '1.3.0', latest: '1.3.0', repo: 'FroseFox/WindowsHub', packaged: true });
        case 'valo:data': {
          if (new URLSearchParams(location.search).get('valo') === 'setup') return ok({ setup: { name: '', tag: '', region: 'eu', hasKey: false } });
          const H = 3600e3, n = Date.now();
          const ms = [['Ascent', 21], ['Bind', -16], ['Lotus', 19], ['Sunset', 23], ['Haven', -18], ['Split', 17], ['Abyss', -15], ['Pearl', 20]];
          return ok({ setup: { name: 'Celyan', tag: 'PRZM', region: 'eu', hasKey: true }, at: n - 60e3, data: {
            name: 'Celyan', tag: 'PRZM', region: 'eu', tierId: 21, tier: 'Ascendant 1', rr: 47, rankImg: null,
            today: { rr: 47, w: 3, l: 1 },
            matches: ms.map(([map, c], i) => ({ id: 'm' + i, map, t: n - (i + 1) * 1.4 * H, change: c, rr: 47, tier: i < 3 ? 'Ascendant 1' : 'Diamant 3', mapImg: null })),
          } });
        }
        case 'cal:next': { const x = new Date(); x.setMinutes(x.getMinutes() + 12); return ok({ start: x.getTime(), end: x.getTime() + 3600e3, title: (new URLSearchParams(location.search).get('evt') || 'Scrim vs Team Nova'), allDay: false }); }
        case 'notif:status': return ok('Allowed');
        case 'cal:set': this._cal = !!args.url; return ok({ ok: true, count: 4 });
        case 'cal:events': {
          if (!this._cal && !new URLSearchParams(location.search).get('cal')) return ok({ configured: false, events: [] });
          const at = (dd, h, m) => { const x = new Date(); x.setDate(x.getDate() + dd); x.setHours(h, m, 0, 0); return x.getTime(); };
          return ok({ configured: true, events: [
            { start: at(0, 14, 0), end: at(0, 15, 30), title: 'Review des VODs', location: 'Discord PRIZM' },
            { start: at(0, 21, 0), end: at(0, 23, 0), title: (new URLSearchParams(location.search).get('evt') || 'Scrim vs Team Nova'), location: '' },
            { start: at(2, 0, 0), end: at(3, 0, 0), allDay: true, title: 'Anniversaire Lucas', location: '' },
            { start: at(5, 18, 0), end: at(5, 20, 0), title: 'Tournoi qualifs', location: '' },
          ] });
        }
        default: return ok(true);
      }
    },
    async list(cmd) {
      await new Promise((r) => setTimeout(r, 400));
      if (cmd === 'wifi:list') return { ok: true, items: [
        { ssid: 'Freebox-Celyan', bars: 4, secure: true, known: true, connected: true },
        { ssid: 'Livebox-7A21', bars: 3, secure: true, known: false, connected: false },
        { ssid: 'SFR_WiFi_FON', bars: 2, secure: false, known: false, connected: false },
        { ssid: 'Bbox-Voisin', bars: 1, secure: true, known: false, connected: false },
      ] };
      if (cmd === 'bt:list') return { ok: true, items: [
        { addr: '1', name: 'Bluff Partybox 165', connected: true, kind: 'AudioVideo', audio: true },
        { addr: '2', name: 'Galaxy Buds2', connected: false, kind: 'AudioVideo', audio: true },
        { addr: '3', name: 'Souris MX', connected: true, kind: 'LowEnergy', audio: false },
      ] };
      if (cmd === 'audio:list') return { ok: true, items: [
        { id: 'a', name: 'Headphones (Bluff Partybox 165)', current: true },
        { id: 'b', name: 'Haut-parleurs (Realtek(R) Audio)', current: false },
        { id: 'c', name: 'LG ULTRAGEAR (NVIDIA High Definition Audio)', current: false },
      ] };
      return 'ok';
    },
  };
}
