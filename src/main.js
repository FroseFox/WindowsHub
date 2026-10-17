const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PSHost } = require('./bridge');
const features = require('./features');

const WIN_W = 760;
const WIN_H = 600;
const SHORTCUT = 'Control+Alt+Space';

// ---------- Économie de ressources ----------
// Rendu sans carte graphique : moins de mémoire, et aucune concurrence avec tes jeux.
app.disableHardwareAcceleration();
// Fonctions de Chromium inutiles ici (touches multimédia, suivi des fenêtres masquées...)
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService,CalculateNativeWinOcclusion,SpareRendererForSitePerProcess');

if (!app.requestSingleInstanceLock()) app.quit();

// ---------- Journal ----------
// Les messages du hub sont aussi écrits dans %APPDATA%\Hub\hub.log (clic droit sur l'icône → « Ouvrir le journal »).
const logFile = () => path.join(app.getPath('userData'), 'hub.log');
(function setupLog() {
  try { if (fs.statSync(logFile()).size > 512 * 1024) fs.unlinkSync(logFile()); } catch {}
  const write = (lvl, args) => {
    const line = `${new Date().toLocaleString('fr-FR')} ${lvl}${args.map((a) => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}\n`;
    fs.appendFile(logFile(), line, () => {});
  };
  for (const [k, lvl] of [['log', ''], ['warn', '[!] '], ['error', '[erreur] ']]) {
    const orig = console[k].bind(console);
    console[k] = (...args) => { try { orig(...args); } catch {} write(lvl, args); };
  }
  process.on('uncaughtException', (e) => console.error(e));
})();

let win = null;
let tray = null;
let host = null;      // PowerShell principal (commandes + surveillance)
let worker = null;    // PowerShell lancé à la demande (listes, stats, applis...)
let feats = null;
let panelOpen = false;
let inGame = false;        // un jeu est au premier plan
let gameMode = false;      // = inGame ET option "Mode jeu" activée
let cursorShown = true;    // en jeu : souris visible (menus) ou cachée (en pleine partie)
let lastApp = '';          // dernier programme au premier plan (pour le menu de l'icône)

// Les scripts PowerShell doivent être hors de l'archive .asar une fois l'appli empaquetée
const psScript = path.join(__dirname, 'ps', 'host.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

// ---------- Préférences ----------
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
let prefs = { gameMode: true };
function loadPrefs() { try { prefs = { ...prefs, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) }; } catch {} }
let prefsT = null;
function savePrefs() {
  clearTimeout(prefsT);
  prefsT = setTimeout(() => { try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs)); } catch {} }, 400);
}

// ---------- Fenêtre et écrans ----------
// prefs.ui.display : 'primary' (écran principal), 'mouse' (suit la souris) ou l'identifiant d'un écran
let currentDisplayId = null;
function targetDisplay() {
  const want = (prefs.ui && prefs.ui.display) || 'primary';
  if (want === 'mouse') return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  if (want !== 'primary') {
    const d = screen.getAllDisplays().find((x) => String(x.id) === String(want));
    if (d) return d;
  }
  return screen.getPrimaryDisplay();
}
// prefs.ui.position : 'top' (en haut au centre), 'tb-left' / 'tb-right' (dans la barre des tâches, à gauche / à droite)
// prefs.ui.offset : décalage depuis le bord de l'écran en mode barre des tâches
const PILL_H = 38;
const uiPos = () => { const p = prefs.ui && prefs.ui.position; return p === 'tb-left' || p === 'tb-right' ? p : 'top'; };
function windowBounds(d) {
  const pos = uiPos();
  const b = d.bounds;
  if (pos === 'top') return { x: Math.round(b.x + (b.width - WIN_W) / 2), y: b.y, width: WIN_W, height: WIN_H };
  // hauteur de la barre des tâches = ce que Windows retire en bas de l'écran (48 px si elle est masquée automatiquement)
  const gap = b.y + b.height - (d.workArea.y + d.workArea.height);
  const tbH = gap >= 24 ? gap : 48;
  const off = Math.max(0, Math.min(b.width - 200, Number(prefs.ui.offset) || 12));
  const y = b.y + b.height - WIN_H - Math.max(0, Math.round((tbH - PILL_H) / 2));
  const x = pos === 'tb-left' ? b.x + off : b.x + b.width - WIN_W - off;
  return { x: Math.round(x), y: Math.round(y), width: WIN_W, height: WIN_H };
}
function placeWindow(force) {
  if (!win) return;
  const d = targetDisplay();
  if (!force && d.id === currentDisplayId) return;
  currentDisplayId = d.id;
  win.setBounds(windowBounds(d));
  pushRaise();
}
// Dans la barre des tâches : quand on clique dessus, Windows la remet devant tout.
// PowerShell repasse le hub devant elle chaque seconde, sans jamais déplacer la fenêtre.
function pushRaise() {
  if (!host || !win || win.isDestroyed()) return;
  const h = uiPos() === 'top' ? 0 : (() => { const buf = win.getNativeWindowHandle(); return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0); })();
  host.run(`Set-Raise ${h}`).catch(() => {});
}
// si Windows a déplacé la fenêtre (changement d'échelle, barre des tâches…), on la remet à sa place
setInterval(() => {
  if (!win || win.isDestroyed() || gameMode || panelOpen || mouseOnHub || uiPos() === 'top') return;
  const want = windowBounds(targetDisplay());
  const cur = win.getBounds();
  if (Math.abs(cur.x - want.x) > 1 || Math.abs(cur.y - want.y) > 1) win.setBounds(want);
}, 2000);
let mouseOnHub = false;
function listScreens() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    name: d.label || `Écran ${i + 1}`,
    size: `${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}`,
    primary: d.id === primary,
  }));
}
// Mode « suit la souris » : la pilule passe sur l'écran où se trouve la souris (vérifié 2 fois par seconde, très léger)
setInterval(() => {
  if (!win || panelOpen || gameMode || !prefs.ui || prefs.ui.display !== 'mouse') return;
  placeWindow(false);
}, 500);

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      enableWebSQL: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  placeWindow(true);
  // Les erreurs de l'interface s'affichent dans le terminal (pratique pour déboguer).
  win.webContents.on('console-message', (e, level, message) => {
    const msg = e && e.message !== undefined ? e.message : message;
    const lvl = e && e.level !== undefined ? e.level : level;
    if (lvl === 'error' || lvl === 3 || lvl === 'warning' || lvl === 2) console.log('[interface]', msg);
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
}

const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

// ---------- Événements envoyés par PowerShell ----------
function watchMode() {
  const m = gameMode ? 'game' : panelOpen ? 'open' : 'closed';
  if (host) host.run(`Set-WatchMode '${m}'`).catch(() => {});
}

// Notifications Windows : lues par PowerShell seulement si l'option est activée
function pushNotif() {
  const on = !prefs.ui || prefs.ui.notifs !== false;
  if (host) host.run(`Set-Notif $${on}`, 20000).then((st) => { if (on) console.log('[notification] accès :', st); }).catch(() => {});
}

// Choix perso : « c'est un jeu » / « ce n'est pas un jeu »
function pushGameLists() {
  const yes = (prefs.games || []).join('|');
  const no = (prefs.notGames || []).join('|');
  if (host) host.run(`Set-GameLists '${b64(yes)}' '${b64(no)}'`).catch(() => {});
}
const SHELL_APPS = /^(explorer|shellexperiencehost|searchhost|startmenuexperiencehost|searchapp|lockapp|textinputhost|applicationframehost|electron|hub)\.exe$/i;

// En jeu, on ne peut pas se fier aux mouvements de souris transmis à la fenêtre, ni à la visibilité
// du curseur (beaucoup de jeux dessinent leur propre curseur dans les menus). On regarde donc directement
// OÙ est le curseur : en pleine partie il reste bloqué au centre de l'écran ; s'il arrive sur la pilule,
// c'est que tu es dans un menu -> la pilule devient cliquable.
let pillRect = null;      // zone de la pilule / du panneau, relative à la fenêtre
let overPill = false;
let overTicks = 0;
let gameTimer = null;
function checkCursorOverPill() {
  if (!win || !pillRect) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const m = 6;
  const top = b.y + (pillRect.y || 0);
  const inside = p.x >= b.x + pillRect.x - m && p.x <= b.x + pillRect.x + pillRect.w + m && p.y >= top - m && p.y <= top + pillRect.h + m;
  if (inside) {
    overTicks++;
    if (overTicks >= 2 && !overPill) { overPill = true; win.setIgnoreMouseEvents(false); sendGame(); }
  } else {
    overTicks = 0;
    if (overPill) { overPill = false; win.setIgnoreMouseEvents(true, { forward: true }); sendGame(); }
  }
}
function sendGame() {
  // lock = la pilule laisse passer les clics (en jeu, quand le curseur n'est pas sur la pilule)
  send('ui:game', { game: gameMode, lock: gameMode && !overPill });
}
function setGame() {
  const g = inGame && prefs.gameMode;
  const changed = g !== gameMode;
  gameMode = g;
  if (g && !gameTimer) gameTimer = setInterval(checkCursorOverPill, 100);
  if (!g && gameTimer) { clearInterval(gameTimer); gameTimer = null; overPill = false; overTicks = 0; }
  sendGame();
  if (changed) watchMode();
}

let lastSys = null;
let lastMedia = null;
function onHostEvent(ev) {
  switch (ev.type) {
    case 'sys': lastSys = ev.data; send('sys:state', ev.data); break;
    case 'media': handleMedia(ev); break;
    case 'game':
      inGame = !!ev.game;
      cursorShown = ev.cursor !== false;
      if (ev.exe && !SHELL_APPS.test(ev.exe)) lastApp = ev.exe;
      setGame();
      break;
    case 'clip': if (feats) feats.onClipboardChange(ev); break;
    case 'notif': {
      const u = prefs.ui || {};
      if (u.notifs === false) break;
      if (gameMode && !u.notifsInGame) break; // en jeu : pas de notifications (sauf si activé)
      console.log(`[notification] ${ev.app} — ${ev.title || ''}`);
      send('notif', ev);
      break;
    }
  }
}

// ---------- Musique + pochette ----------
let lastThumb = null;
let coverKey = null;
let coverFromWindows = false;
const coverMem = new Map();
const coverDir = () => path.join(app.getPath('userData'), 'covers');
const coverFile = (key) => path.join(coverDir(), crypto.createHash('md5').update(key).digest('hex') + '.txt');

function cachedCover(key) {
  if (!key) return null;
  if (coverMem.has(key)) return coverMem.get(key);
  try { const d = fs.readFileSync(coverFile(key), 'utf8'); coverMem.set(key, d); return d; } catch { return null; }
}
function storeCover(key, data) {
  coverMem.set(key, data);
  if (coverMem.size > 30) coverMem.delete(coverMem.keys().next().value);
  fs.promises.mkdir(coverDir(), { recursive: true }).then(() => fs.promises.writeFile(coverFile(key), data)).catch(() => {});
}
function pruneCovers() {
  // garde les 150 pochettes les plus récentes sur le disque
  fs.promises.readdir(coverDir()).then(async (names) => {
    if (names.length <= 150) return;
    const stats = await Promise.all(names.map(async (n) => ({ n, t: (await fs.promises.stat(path.join(coverDir(), n))).mtimeMs })));
    stats.sort((a, b) => b.t - a.t).slice(150).forEach(({ n }) => fs.promises.unlink(path.join(coverDir(), n)).catch(() => {}));
  }).catch(() => {});
}

function handleMedia(m) {
  const key = m.active && m.title ? `${m.title}|${m.artist || ''}` : null;
  if (key !== coverKey) {
    coverKey = key;
    coverFromWindows = false;
    if (key) {
      // pochette déjà connue : affichée immédiatement, sinon on la cherche tout de suite sur Deezer
      const cached = !m.thumb && cachedCover(key);
      if (cached) { m.thumb = cached; m.thumbChanged = true; }
      else if (!m.thumb) fetchCover(key, m.title, m.artist || '');
    }
  }
  if (m.thumbChanged) {
    if (m.thumb && m.thumb !== cachedCover(key)) { coverFromWindows = true; if (key) storeCover(key, m.thumb); }
    lastThumb = m.thumb || null;
  }
  lastMedia = { ...m, thumb: undefined, thumbChanged: false };
  send('media:state', m);
}

async function findCoverUrl(title, artist) {
  const clean = (s) => s.replace(/\s*[([].*?(feat|ft\.|with|remaster|version|edit|live).*?[)\]]/gi, '').trim();
  const queries = [`artist:"${clean(artist)}" track:"${clean(title)}"`, `${clean(artist)} ${clean(title)}`];
  for (const q of queries) {
    const res = await fetch(`https://api.deezer.com/search?limit=1&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) continue;
    const j = await res.json();
    const hit = j && j.data && j.data[0];
    if (hit && hit.album) return hit.album.cover_medium || hit.album.cover_big;
  }
  return null;
}

async function fetchCover(key, title, artist) {
  try {
    const url = await findCoverUrl(title, artist);
    if (!url || key !== coverKey || coverFromWindows) return;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const type = res.headers.get('content-type') || 'image/jpeg';
    const data = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    storeCover(key, data);
    if (key !== coverKey || coverFromWindows) return;
    lastThumb = data;
    send('media:state', { thumbChanged: true, thumb: data, partial: true });
  } catch (e) { console.error('[pochette]', e.message); }
}

// ---------- Actions ----------
const b64 = (s) => Buffer.from(String(s ?? ''), 'utf8').toString('base64');

const SYS_ACTIONS = {
  wifi: (v) => `Set-Radio 'WiFi' $${!!v}`,
  bt: (v) => `Set-Radio 'Bluetooth' $${!!v}`,
  mute: (v) => `[HubNative.Audio]::SetMute($${!!v}); 'ok'`,
  dark: (v) => `Set-DarkMode $${!!v}`,
  night: (v) => `Set-NightLight $${!!v}`,
};

const LIST_CMDS = {
  'wifi:list': () => 'Get-WifiNetworks',
  'wifi:connect': (a) => `Connect-Wifi '${b64(a.ssid)}' '${a.password ? b64(a.password) : ''}'`,
  'wifi:disconnect': () => 'Disconnect-Wifi',
  'bt:list': () => 'Get-BtDevices',
  'bt:connect': (a) => `Set-BtAudio '${String(a.addr).replace(/\D/g, '')}' $${!!a.connect}`,
  'audio:list': () => 'Get-AudioOutputs',
  'audio:set': (a) => `Set-AudioOutput '${b64(a.id)}'`,
};

const SETTINGS = {
  wifi: 'ms-settings:network-wifi',
  bt: 'ms-settings:bluetooth',
  audio: 'ms-settings:sound',
  night: 'ms-settings:nightlight',
  dark: 'ms-settings:colors',
  location: 'ms-settings:privacy-location',
};

// Le volume bouge vite quand on glisse : on n'envoie que la dernière valeur.
let volBusy = false;
let volPending = null;
async function flushVolume() {
  if (volBusy || volPending === null) return;
  volBusy = true;
  const v = Math.max(0, Math.min(100, Number(volPending) || 0));
  volPending = null;
  try { await host.run(`[HubNative.Audio]::SetVolume(${(v / 100).toFixed(3)}); 'ok'`); } catch (e) { console.error('[vol]', e.message); }
  volBusy = false;
  flushVolume();
}

function setupIpc() {
  ipcMain.on('ui:interactive', (_e, on) => {
    if (!win) return;
    mouseOnHub = !!on;
    if (gameMode && overPill) return; // en jeu, c'est la surveillance du curseur qui décide
    win.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on('ui:rect', (_e, r) => { if (r && typeof r.w === 'number') pillRect = r; });

  // Rend la fenêtre capable de recevoir le clavier le temps d'une saisie.
  ipcMain.on('ui:focus', (_e, on) => {
    if (!win) return;
    win.setFocusable(!!on);
    if (on) { win.setIgnoreMouseEvents(false); win.focus(); win.webContents.focus(); }
  });

  ipcMain.on('ui:panel', (_e, open) => {
    if (panelOpen === !!open) return;
    panelOpen = !!open;
    watchMode();
    if (panelOpen && feats) feats.warmup();
  });

  ipcMain.on('ui:ready', () => {
    // l'interface vient de (re)charger : on lui renvoie tout de suite le dernier état connu
    if (lastSys) send('sys:state', lastSys);
    if (lastMedia) send('media:state', lastMedia);
    host.run('Force-Emit').catch(() => {});
    if (lastThumb) send('media:state', { thumbChanged: true, thumb: lastThumb, partial: true });
    sendGame();
  });

  ipcMain.handle('sys:action', async (_e, { type, value }) => {
    const build = SYS_ACTIONS[type];
    if (!build) return 'unknown';
    try {
      const r = await host.run(build(value));
      host.run('Force-Emit').catch(() => {});
      return r;
    } catch (e) {
      console.error('[action]', type, e.message);
      return 'error';
    }
  });

  ipcMain.on('sys:volume', (_e, v) => { volPending = v; flushVolume(); });

  ipcMain.handle('feat:call', async (_e, { name, args }) => {
    try { return { ok: true, data: await feats.call(name, args) }; }
    catch (e) { console.error('[onglet]', name, e.message); return { ok: false, error: e.message }; }
  });

  ipcMain.handle('list:run', async (_e, { cmd, args }) => {
    const build = LIST_CMDS[cmd];
    if (!build) return { ok: false, reason: 'unknown' };
    try {
      return await worker.run(build(args || {}), 30000);
    } catch (e) {
      console.error('[liste]', cmd, e.message);
      return { ok: false, reason: 'error', message: e.message };
    }
  });

  ipcMain.handle('media:action', async (_e, { cmd, arg }) => {
    if (!['toggle', 'next', 'prev', 'seek'].includes(cmd)) return false;
    try { return await host.run(`Invoke-Media '${cmd}' ${Number(arg) || 0}`); } catch { return false; }
  });

  ipcMain.on('ui:settings', (_e, key) => { if (SETTINGS[key]) shell.openExternal(SETTINGS[key]); });
}

// ---------- Icône dans la zone de notification ----------
function loginSettings(open) {
  const opts = { openAtLogin: open };
  if (!app.isPackaged) { opts.path = process.execPath; opts.args = [app.getAppPath()]; }
  return opts;
}

function buildTrayMenu() {
  const auto = app.getLoginItemSettings(loginSettings(false)).openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'Ouvrir le panneau   (Ctrl+Alt+Espace)', click: () => send('ui:toggle') },
    { type: 'separator' },
    {
      label: 'Lancer au démarrage de Windows', type: 'checkbox', checked: auto,
      click: (item) => { app.setLoginItemSettings(loginSettings(item.checked)); },
    },
    {
      label: 'Mode jeu (en partie, la pilule laisse passer les clics)', type: 'checkbox', checked: prefs.gameMode,
      click: (item) => { prefs.gameMode = item.checked; savePrefs(); setGame(); },
    },
    ...gameMenuItems(),
    { label: 'Recharger', click: () => { if (win) win.reload(); } },
    { label: 'Ouvrir le journal', click: () => shell.openPath(logFile()) },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]);
}

function gameMenuItems() {
  const items = [];
  const name = lastApp;
  if (name) {
    const low = name.toLowerCase();
    const isYes = (prefs.games || []).includes(low);
    const isNo = (prefs.notGames || []).includes(low);
    const toggle = (listName, other) => {
      prefs[listName] = (prefs[listName] || []).includes(low) ? prefs[listName].filter((x) => x !== low) : [...(prefs[listName] || []), low];
      prefs[other] = (prefs[other] || []).filter((x) => x !== low);
      savePrefs();
      pushGameLists();
    };
    items.push({
      label: `« ${name} »`, submenu: [
        { label: 'C\'est un jeu', type: 'checkbox', checked: isYes, click: () => toggle('games', 'notGames') },
        { label: 'Ce n\'est pas un jeu', type: 'checkbox', checked: isNo, click: () => toggle('notGames', 'games') },
      ],
    });
  }
  return items;
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png')));
  tray.setToolTip('Hub');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => send('ui:toggle'));
  tray.on('right-click', () => tray.setContextMenu(buildTrayMenu()));
}

// ---------- Démarrage ----------
app.whenReady().then(() => {
  loadPrefs();
  const env = { HUB_CACHE: path.join(app.getPath('userData'), 'pscache') };
  host = new PSHost('hub', { script: psScript, mode: 'main', env, onEvent: onHostEvent });
  host.onReady = () => { watchMode(); pushGameLists(); pushNotif(); pushRaise(); };
  worker = new PSHost('worker', { script: psScript, mode: 'worker', env, idleMs: 60000 });

  feats = features.setup({
    send, prefs, savePrefs, worker,
    getLogin: () => app.getLoginItemSettings(loginSettings(false)).openAtLogin,
    setLogin: (v) => app.setLoginItemSettings(loginSettings(v)),
    onGameModeChange: () => setGame(),
    listScreens,
    host,
    onUiChange: () => { placeWindow(true); pushNotif(); },
  });

  setupIpc();
  createWindow();
  createTray();
  globalShortcut.register(SHORTCUT, () => send('ui:toggle'));

  screen.on('display-metrics-changed', () => placeWindow(true));
  screen.on('display-added', () => placeWindow(true));
  screen.on('display-removed', () => placeWindow(true));
  setTimeout(pruneCovers, 30000);
});

app.on('second-instance', () => send('ui:toggle'));
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (host) host.stop();
  if (worker) worker.stop();
  clearTimeout(prefsT);
  try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs)); } catch {}
});
