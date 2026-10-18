// Fonctions des onglets Aujourd'hui, Stats, Presse-papier, Apps, Fond d'écran et Énergie (côté Windows).
const { app, clipboard, nativeImage, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { eventsBetween } = require('./ical');

const b64 = (s) => Buffer.from(String(s ?? ''), 'utf8').toString('base64');
const hash = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function setup(ctx) {
  // ctx = { send, prefs, savePrefs, worker }  (worker = PowerShell lancé à la demande)
  const handlers = {};
  const on = (name, fn) => { handlers[name] = fn; };

  // =====================================================================
  // Aujourd'hui : météo (Open-Meteo, gratuit sans clé) + notes
  // =====================================================================
  // La météo est gardée sur le disque : l'onglet s'affiche tout de suite, puis se met à jour si besoin.
  const FRESH = 20 * 60e3;
  const timeout = (ms) => AbortSignal.timeout(ms);

  async function locate() {
    if (ctx.prefs.city && ctx.prefs.city.lat != null) return ctx.prefs.city;
    const a = ctx.prefs.autoLoc;
    if (a && Date.now() - a.at < 24 * 3600e3) return a;
    const r = await fetch('https://ipwho.is/?fields=success,city,latitude,longitude', { signal: timeout(5000) });
    const j = await r.json();
    if (!j.success) throw new Error('localisation impossible');
    ctx.prefs.autoLoc = { name: j.city, lat: j.latitude, lon: j.longitude, at: Date.now() };
    ctx.savePrefs();
    return ctx.prefs.autoLoc;
  }

  let weatherLoading = null;
  async function fetchWeather() {
    const loc = await locate();
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${loc.lat}&longitude=${loc.lon}`
      + '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
      + '&timezone=auto&forecast_days=5';
    const j = await (await fetch(url, { signal: timeout(6000) })).json();
    if (!j.current) throw new Error('météo indisponible');
    const data = {
      city: loc.name,
      now: {
        temp: j.current.temperature_2m, feels: j.current.apparent_temperature,
        code: j.current.weather_code, day: !!j.current.is_day,
        wind: j.current.wind_speed_10m, humidity: j.current.relative_humidity_2m,
      },
      days: j.daily.time.map((t, i) => ({
        date: t, code: j.daily.weather_code[i],
        max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
        rain: j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[i] : null,
      })),
      sunrise: j.daily.sunrise[0], sunset: j.daily.sunset[0],
    };
    ctx.prefs.weather = { at: Date.now(), data };
    ctx.savePrefs();
    return data;
  }
  const refreshWeather = () => (weatherLoading = weatherLoading || fetchWeather().finally(() => { weatherLoading = null; }));

  // { data, stale } : data = dernière météo connue (immédiate), stale = une mise à jour est conseillée
  on('today:weather', async ({ force } = {}) => {
    const c = ctx.prefs.weather;
    if (!force && c) return { data: c.data, stale: Date.now() - c.at > FRESH };
    return { data: await refreshWeather(), stale: false };
  });
  // préchargée au démarrage : l'onglet Aujourd'hui s'ouvre directement avec la météo
  setTimeout(() => { const c = ctx.prefs.weather; if (!c || Date.now() - c.at > FRESH) refreshWeather().catch(() => {}); }, 15000);

  on('today:city', async ({ name }) => {
    if (!name || !name.trim()) { delete ctx.prefs.city; delete ctx.prefs.weather; ctx.savePrefs(); return { ok: true }; }
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=${encodeURIComponent(name.trim())}`);
    const j = await r.json();
    const hit = j.results && j.results[0];
    if (!hit) return { ok: false };
    ctx.prefs.city = { name: hit.name, lat: hit.latitude, lon: hit.longitude };
    delete ctx.prefs.weather;
    ctx.savePrefs();
    return { ok: true };
  });

  on('today:notes', async ({ text } = {}) => {
    if (typeof text === 'string') { ctx.prefs.notes = text.slice(0, 5000); ctx.savePrefs(); }
    return ctx.prefs.notes || '';
  });

  // =====================================================================
  // Stats : CPU / RAM / disque (Node) + réseau / GPU (PowerShell)
  // =====================================================================
  let prevCpu = null;
  setTimeout(() => cpuLoad(), 0); // premier relevé dès le démarrage : la 1re valeur s'affiche tout de suite
  let prevNet = null;
  let statsTimer = null;
  let statsBusy = false;

  function cpuLoad() {
    let idle = 0, total = 0;
    for (const c of os.cpus()) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; }
    const prev = prevCpu;
    prevCpu = { idle, total };
    if (!prev || total === prev.total) return null;
    return Math.round(100 * (1 - (idle - prev.idle) / (total - prev.total)));
  }

  function disk() {
    try {
      const s = fs.statfsSync(process.platform === 'win32' ? 'C:\\' : '/');
      return { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
    } catch { return null; }
  }

  // Les valeurs lues par Node (CPU, RAM, disque) partent tout de suite ;
  // celles de PowerShell (réseau, GPU) sont ajoutées dès qu'elles arrivent, sans jamais bloquer l'affichage.
  let lastPs = {};
  function statsTick() {
    const data = {
      cpu: cpuLoad(), cpuName: (os.cpus()[0] || {}).model, cores: os.cpus().length,
      ramTotal: os.totalmem(), ramFree: os.freemem(),
      disk: disk(), uptime: os.uptime(),
      gpuName: ctx.prefs.gpuName || null,
      ...lastPs,
    };
    ctx.send('feat:event', { type: 'stats', data });
    if (statsBusy) return;
    statsBusy = true;
    ctx.worker.run('Get-Stats', 8000).then((s) => {
      if (!s) return;
      const now = Date.now();
      const ps = { gpu: s.gpu };
      if (prevNet) {
        const dt = (now - prevNet.at) / 1000;
        ps.down = Math.max(0, (s.rx - prevNet.rx) / dt);
        ps.up = Math.max(0, (s.tx - prevNet.tx) / dt);
      }
      prevNet = { rx: s.rx, tx: s.tx, at: now };
      lastPs = ps;
    }).catch((e) => console.error('[stats]', e.message)).finally(() => { statsBusy = false; });
    // nom de la carte graphique : demandé une seule fois, puis gardé
    if (!ctx.prefs.gpuName && !gpuNameAsked) {
      gpuNameAsked = true;
      ctx.worker.run('Get-GpuName', 20000).then((n) => { if (n) { ctx.prefs.gpuName = n; ctx.savePrefs(); } }).catch(() => {});
    }
  }
  let gpuNameAsked = false;

  // Préchauffage : lance PowerShell dès l'ouverture du panneau, pour que les onglets répondent tout de suite
  function warmup() { ctx.worker.run('Get-NetBytes', 20000).catch(() => {}); }

  on('stats:start', async () => {
    if (statsTimer) return true;
    ctx.worker.hold();
    statsTick();
    statsTimer = setInterval(statsTick, 1000);
    return true;
  });
  on('stats:stop', async () => {
    if (statsTimer) ctx.worker.release();
    clearInterval(statsTimer); statsTimer = null; prevNet = null; lastPs = {};
    return true;
  });

  // =====================================================================
  // Presse-papier : historique (texte + images)
  // =====================================================================
  const clipDir = path.join(app.getPath('userData'), 'clips');
  const clipIndex = path.join(clipDir, 'index.json');
  const maxClips = () => [25, 50, 100, 200].includes(ctx.prefs.clipMax) ? ctx.prefs.clipMax : 50;
  let clips = [];
  let lastSig = null;
  let saveT = null;
  try { fs.mkdirSync(clipDir, { recursive: true }); clips = JSON.parse(fs.readFileSync(clipIndex, 'utf8')); } catch { clips = []; }

  const saveClips = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { fs.writeFileSync(clipIndex, JSON.stringify(clips)); } catch {} }, 600);
  };
  // on signale juste "ça a changé" : l'interface ne recharge la liste que si l'onglet est affiché
  const pushClips = () => ctx.send('feat:event', { type: 'clips' });

  function removeFile(c) { if (c.file) { try { fs.unlinkSync(path.join(clipDir, c.file)); } catch {} } }

  function addClip(item) {
    const same = clips.findIndex((c) => c.sig === item.sig);
    if (same !== -1) {
      const [old] = clips.splice(same, 1);
      old.t = Date.now();
      clips.unshift(old);
    } else {
      clips.unshift(item);
      // on garde les éléments épinglés + les 50 derniers
      let unpinned = 0;
      clips = clips.filter((c) => {
        if (c.pinned) return true;
        unpinned++;
        if (unpinned > maxClips()) { removeFile(c); return false; }
        return true;
      });
    }
    saveClips();
    pushClips();
  }

  // Diagnostic affiché dans l'onglet (pour comprendre si quelque chose bloque)
  const diag = { events: 0, added: 0, lastEvent: 0, lastAdd: 0, error: '' };
  const logClip = (m) => console.log('[presse-papier] ' + m);

  function addText(text, how) {
    if (!text || !text.trim()) return false;
    const sig = 'txt:' + hash(text);
    if (sig === lastSig) return true;
    lastSig = sig;
    addClip({ id: crypto.randomUUID(), sig, type: 'text', text: text.slice(0, 20000), t: Date.now(), pinned: false });
    diag.added++; diag.lastAdd = Date.now(); diag.error = '';
    logClip(`texte ajouté (${text.length} caractères, ${how})`);
    return true;
  }
  function addImage(img, how) {
    if (!img || img.isEmpty()) return false;
    const size = img.getSize();
    const sig = `img:${size.width}x${size.height}:` + hash(img.resize({ width: 32 }).toBitmap());
    if (sig === lastSig) return true;
    lastSig = sig;
    const id = crypto.randomUUID();
    const file = id + '.png';
    fs.writeFileSync(path.join(clipDir, file), img.toPNG());
    const thumb = img.resize(size.width > size.height ? { width: 280 } : { height: 160 }).toDataURL();
    addClip({ id, sig, type: 'image', file, thumb, w: size.width, h: size.height, t: Date.now(), pinned: false });
    diag.added++; diag.lastAdd = Date.now(); diag.error = '';
    logClip(`image ajoutée (${size.width}×${size.height}, ${how})`);
    return true;
  }

  // Lecture par le hub lui-même (Electron). Renvoie true si quelque chose a été lu.
  function readElectron() {
    try {
      const text = clipboard.readText();
      if (addText(text, 'hub')) return true;
      const formats = clipboard.availableFormats();
      if (formats.some((f) => f.startsWith('image/'))) return addImage(clipboard.readImage(), 'hub');
    } catch (e) { diag.error = 'lecture : ' + e.message; }
    return false;
  }

  // Image que le hub n'arrive pas à lire : PowerShell l'enregistre en PNG, et on la récupère
  async function imageViaPs() {
    const tmp = path.join(clipDir, 'pending.png');
    try {
      const ok = await ctx.host.run(`Save-ClipImage '${b64(tmp)}'`, 8000);
      if (ok === true || ok === 'True') { addImage(nativeImage.createFromPath(tmp), 'powershell'); }
    } catch (e) { diag.error = 'image : ' + e.message; }
    try { fs.unlinkSync(tmp); } catch {}
  }

  // Appelé à chaque copie. ev = ce que PowerShell a lu ({ text, img, err }).
  function onClipboardChange(ev) {
    diag.events++; diag.lastEvent = Date.now();
    if (ctx.prefs.clipPaused) return;
    ev = ev || {};
    if (ev.err) diag.error = 'Windows : ' + ev.err;
    if (typeof ev.text === 'string' && addText(ev.text, 'powershell')) return;
    // pas de texte côté PowerShell : on essaie nous-mêmes (avec 3 nouvelles tentatives si le contenu n'est pas prêt)
    let tries = 0;
    const attempt = () => {
      if (readElectron()) return;
      if (++tries < 4) { setTimeout(attempt, tries * 150); return; }
      if (ev.img) imageViaPs();
    };
    setTimeout(attempt, 30);
  }
  // Contrôle léger toutes les 3 s : rattrape une copie manquée (si la surveillance Windows était en pause, etc.)
  setInterval(() => { if (!ctx.prefs.clipPaused) readElectron(); }, 3000);
  setTimeout(() => {
    // au démarrage : on mémorise le contenu actuel sans l'ajouter (évite de re-ajouter la même chose)
    try { const t = clipboard.readText(); if (t) lastSig = 'txt:' + hash(t); } catch {}
  }, 0);

  on('clip:list', async () => ({ items: clips, paused: !!ctx.prefs.clipPaused, diag: { ...diag, now: Date.now() } }));
  on('clip:copy', async ({ id }) => {
    const c = clips.find((x) => x.id === id);
    if (!c) return false;
    if (c.type === 'text') clipboard.writeText(c.text);
    else clipboard.writeImage(nativeImage.createFromPath(path.join(clipDir, c.file)));
    lastSig = c.sig;
    addClip(c);
    return true;
  });
  on('clip:pin', async ({ id }) => {
    const c = clips.find((x) => x.id === id);
    if (c) { c.pinned = !c.pinned; saveClips(); pushClips(); }
    return true;
  });
  on('clip:delete', async ({ id }) => {
    const c = clips.find((x) => x.id === id);
    if (c) { removeFile(c); clips = clips.filter((x) => x !== c); saveClips(); pushClips(); }
    return true;
  });
  on('clip:clear', async () => {
    clips.filter((c) => !c.pinned).forEach(removeFile);
    clips = clips.filter((c) => c.pinned);
    saveClips(); pushClips();
    return true;
  });
  on('clip:pause', async ({ paused }) => { ctx.prefs.clipPaused = !!paused; ctx.savePrefs(); return !!paused; });

  // =====================================================================
  // Apps : uniquement celles que tu ajoutes
  // =====================================================================
  // v2 : l'ancien cache pouvait contenir des icônes vides (transparentes) -> on repart de zéro
  const iconFile = path.join(app.getPath('userData'), 'icons-v2.json');
  try { fs.unlinkSync(path.join(app.getPath('userData'), 'icons.json')); } catch {}
  let iconCache = {};
  try { iconCache = JSON.parse(fs.readFileSync(iconFile, 'utf8')); } catch {}
  for (const k of Object.keys(iconCache)) if (!iconCache[k]) delete iconCache[k];
  let iconSaveT = null;
  const saveIcons = () => { clearTimeout(iconSaveT); iconSaveT = setTimeout(() => { try { fs.writeFileSync(iconFile, JSON.stringify(iconCache)); } catch {} }, 1000); };

  let installed = null; // { at, items }
  let lnkMap = null;
  const mine = () => (Array.isArray(ctx.prefs.myApps) ? ctx.prefs.myApps : (ctx.prefs.myApps = []));

  const KNOWN_FOLDERS = {
    '{6D809377-6AF0-444B-8957-A3773F02200E}': process.env.ProgramW6432 || process.env.ProgramFiles,
    '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': process.env['ProgramFiles(x86)'],
    '{F38BF404-1D43-42F2-9305-67DE0B28FC23}': process.env.SystemRoot,
    '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32'),
    '{D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27}': process.env.SystemRoot && path.join(process.env.SystemRoot, 'SysWOW64'),
    '{F1B32785-6FBA-4FCF-9D55-7B8E7F157091}': process.env.LOCALAPPDATA,
    '{3EB685DB-65F9-4CF6-A03A-E3EF65729F3D}': process.env.APPDATA,
    // menus Démarrer (raccourcis .lnk / .url, dont les jeux Steam)
    '{A77F5D77-2E2B-44C3-A6A2-ABA601054A51}': process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    '{0139D44E-6AFE-49F2-8690-3DAFCAE6FFB8}': process.env.ProgramData && path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  };

  function buildLnkMap() {
    const map = new Map();
    const roots = [
      process.env.ProgramData && path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      app.getPath('desktop'),
      process.env.PUBLIC && path.join(process.env.PUBLIC, 'Desktop'),
    ].filter(Boolean);
    const walk = (dir, depth) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory() && depth < 3) walk(p, depth + 1);
        else if (/\.(lnk|url)$/i.test(e.name)) {
          const k = e.name.replace(/\.(lnk|url)$/i, '').toLowerCase();
          if (!map.has(k)) map.set(k, p);
        }
      }
    };
    roots.forEach((r) => walk(r, 0));
    return map;
  }

  // "%ProgramData%\Riot Games\..." -> "C:\ProgramData\Riot Games\..."
  const expand = (p) => String(p || '').replace(/%([^%]+)%/g, (m, v) => process.env[v] || process.env[v.toUpperCase()] || m).replace(/^"|"$/g, '').replace(/,-?\d+$/, '');

  // Toutes les pistes possibles pour trouver l'icône d'une appli, de la plus fiable à la moins fiable
  function iconSources(a) {
    const out = [];
    const add = (p) => { p = expand(p); if (p && !out.includes(p)) out.push(p); };
    let p = a.path || '';
    if (!p && a.id) {
      p = a.id;
      const kf = p.match(/^(\{[0-9A-F-]+\})\\(.*)$/i);
      if (kf && KNOWN_FOLDERS[kf[1].toUpperCase()]) p = path.join(KNOWN_FOLDERS[kf[1].toUpperCase()], kf[2]);
      if (!/^[a-z]:\\/i.test(p) || !fs.existsSync(p)) p = '';
    }
    if (!p) {
      if (!lnkMap) lnkMap = buildLnkMap();
      const n = (a.name || '').toLowerCase();
      p = lnkMap.get(n) || '';
      if (!p && n.length > 3) for (const [k, v] of lnkMap) { if (k.startsWith(n) || n.startsWith(k)) { p = v; break; } }
    }
    if (!p) return out;
    if (/\.lnk$/i.test(p)) {
      try {
        const l = shell.readShortcutLink(p);
        if (l.icon) add(l.icon);
        // raccourcis Riot (Valorant, LoL) : ils lancent le Riot Client, l'icône du jeu est rangée à part
        const rp = (l.args || '').match(/--launch-product=([\w-]+).*?--launch-patchline=([\w-]+)/i);
        if (rp && process.env.ProgramData) add(path.join(process.env.ProgramData, 'Riot Games', 'Metadata', `${rp[1]}.${rp[2]}`, `${rp[1]}.${rp[2]}.ico`));
        add(p); // l'icône du raccourci lui-même, telle que Windows l'affiche
        if (l.target) add(l.target);
      } catch {}
    }
    if (/\.url$/i.test(p)) {
      // raccourci internet (jeux Steam, Epic...) : l'icône est indiquée dans le fichier
      try {
        const m = fs.readFileSync(p, 'utf8').match(/^IconFile=(.+)$/mi);
        if (m) add(m[1].trim());
      } catch {}
    }
    add(p);
    return out;
  }

  async function fileIcon(src) {
    if (!src || !fs.existsSync(src)) return null;
    try {
      let img = /\.(ico|png)$/i.test(src) ? nativeImage.createFromPath(src) : null;
      // certains .ico ne se lisent pas directement : on demande alors à Windows de les dessiner
      if (!img || img.isEmpty()) img = await app.getFileIcon(src, { size: 'large' });
      if (!img || img.isEmpty()) return null;
      const sz = img.getSize();
      if (sz.width > 64) img = img.resize({ width: 64, quality: 'best' });
      const data = img.toDataURL();
      return data.length > 300 ? data : null;
    } catch { return null; }
  }

  // une icône entièrement transparente (ou presque) ne sert à rien : on la refuse
  function isBlank(dataUrl) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img.isEmpty()) return true;
      const px = img.toBitmap();
      let visible = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 24) visible++;
      return visible < (px.length / 4) * 0.04; // moins de 4 % de pixels visibles
    } catch { return false; }
  }
  const good = (d) => typeof d === 'string' && d.startsWith('data:image') && !isBlank(d);

  const iconMiss = new Set(); // échecs gardés seulement pendant cette session (on réessaie au prochain lancement)
  async function iconOf(a) {
    const k = a.id || a.path;
    if (iconCache[k]) return iconCache[k];
    if (iconMiss.has(k)) return null;
    let data = null;
    // 1) on demande l'icône à Windows, exactement comme le menu Démarrer l'affiche (marche pour presque tout)
    const shellName = a.path ? a.path : 'shell:AppsFolder\\' + a.id;
    try { data = await ctx.worker.run(`Get-AppIcon '${b64(shellName)}'`, 15000); } catch {}
    let how = 'Windows';
    if (!good(data)) data = null;
    // 2) appli du Microsoft Store : son logo est dans son dossier d'installation
    if (!data && a.id && a.id.includes('!')) {
      try { data = await ctx.worker.run(`Get-UwpIcon '${b64(a.id)}'`, 20000); } catch {}
      if (!good(data)) data = null; else how = 'Microsoft Store';
    }
    // 3) fichiers : raccourci, .ico, programme visé...
    const tried = [];
    if (!data) for (const src of iconSources(a)) {
      tried.push(src);
      data = await fileIcon(src);
      if (data && !good(data)) data = null;
      if (data) { how = src; break; }
    }
    if (data) { iconCache[k] = data; saveIcons(); console.log(`[icône] « ${a.name} » trouvée (${how})`); }
    else { iconMiss.add(k); console.log(`[icône] introuvable pour « ${a.name} » (id: ${a.id || a.path}) — essayé : ${tried.join(' | ') || 'aucun fichier trouvé'}`); }
    return data;
  }

  async function installedApps() {
    if (installed && Date.now() - installed.at < 30 * 60e3) return installed.items;
    const r = await ctx.worker.run('Get-AppsList', 30000);
    const items = r && r.items ? (Array.isArray(r.items) ? r.items : [r.items]) : [];
    installed = { at: Date.now(), items };
    lnkMap = null;
    return items;
  }

  const appKey = (a) => (a.id ? 'id:' + a.id : 'path:' + a.path);

  on('apps:mine', async () => mine());
  on('apps:installed', async () => installedApps());
  on('apps:add', async ({ id, name, path: p }) => {
    const list = mine();
    const entry = id ? { id, name } : { path: p, name: name || path.basename(p).replace(/\.(lnk|url|exe|bat|cmd)$/i, '') };
    if (!entry.id && !entry.path) return list;
    entry.key = appKey(entry);
    if (!list.some((a) => a.key === entry.key)) list.push(entry);
    ctx.savePrefs();
    return list;
  });
  on('apps:pick', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Ajouter une appli ou un jeu',
      defaultPath: process.env.ProgramFiles || undefined,
      properties: ['openFile'],
      filters: [{ name: 'Applis et raccourcis', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return handlers['apps:add']({ path: r.filePaths[0] });
  });
  on('apps:remove', async ({ key }) => {
    ctx.prefs.myApps = mine().filter((a) => a.key !== key);
    ctx.savePrefs();
    return ctx.prefs.myApps;
  });
  on('apps:move', async ({ key, to }) => {
    const list = mine();
    const i = list.findIndex((a) => a.key === key);
    if (i === -1) return list;
    const [a] = list.splice(i, 1);
    list.splice(Math.max(0, Math.min(list.length, to)), 0, a);
    ctx.savePrefs();
    return list;
  });
  on('apps:icons', async ({ items }) => {
    const out = {};
    for (const a of (items || []).slice(0, 40)) out[a.id || a.path] = await iconOf(a);
    return out;
  });
  on('apps:launch', async ({ key }) => {
    const a = mine().find((x) => x.key === key);
    if (!a) return false;
    if (a.path) { const err = await shell.openPath(a.path); return !err; }
    spawn('explorer.exe', ['shell:AppsFolder\\' + a.id], { detached: true, stdio: 'ignore' }).unref();
    return true;
  });


  // =====================================================================
  // Agenda : Google Agenda via son « adresse secrète au format iCal »
  // =====================================================================
  const calFile = path.join(app.getPath('userData'), 'calendar.ics');
  let calText = null;
  let calAt = 0;
  try { calText = fs.readFileSync(calFile, 'utf8'); calAt = fs.statSync(calFile).mtimeMs; } catch {}
  let calLoading = null;

  async function downloadCal(url) {
    const res = await fetch(url.trim().replace(/^webcal:/i, 'https:'), { signal: timeout(12000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const txt = await res.text();
    if (!/BEGIN:VCALENDAR/.test(txt)) throw new Error("ce n'est pas une adresse d'agenda iCal");
    return txt;
  }
  async function refreshCal() {
    if (!ctx.prefs.calUrl) return;
    calLoading = calLoading || downloadCal(ctx.prefs.calUrl).then((txt) => {
      calText = txt; calAt = Date.now();
      fs.promises.writeFile(calFile, txt).catch(() => {});
    }).finally(() => { calLoading = null; });
    return calLoading;
  }

  // { configured, events, stale } — affiche tout de suite la version en cache
  on('cal:events', async ({ from, to, force } = {}) => {
    if (!ctx.prefs.calUrl) return { configured: false, events: [] };
    if (force || !calText) { try { await refreshCal(); } catch (e) { if (!calText) return { configured: true, error: e.message, events: [] }; } }
    const events = calText ? eventsBetween(calText, from, to) : [];
    return { configured: true, events, stale: Date.now() - calAt > 10 * 60e3, tzWarn: calTzWarning() };
  });
  // Google Agenda réglé sur un autre fuseau horaire que le PC (ex. « UTC » au lieu de Paris) :
  // les événements tapés à 20h dans Google sont alors réellement à 22h chez toi.
  function tzOffset(tz, at) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(at).map((x) => [x.type, x.value]));
      return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 60e3) * 60e3) / 60e3);
    } catch { return null; }
  }
  function calTzWarning() {
    const m = calText && calText.match(/^X-WR-TIMEZONE:(.+)$/m);
    if (!m) return null;
    const tz = m[1].trim(), now = Date.now();
    const off = tzOffset(tz, now), mine = -new Date(now).getTimezoneOffset();
    if (off === null || off === mine) return null;
    const diff = (mine - off) / 60;
    return { calTz: tz, pcTz: Intl.DateTimeFormat().resolvedOptions().timeZone, hours: diff };
  }
  on('cal:tzfix', async () => { await shell.openExternal('https://calendar.google.com/calendar/r/settings'); return true; });
  on('cal:set', async ({ url }) => {
    if (!url || !url.trim()) {
      delete ctx.prefs.calUrl; calText = null; ctx.savePrefs();
      try { fs.unlinkSync(calFile); } catch {}
      return { ok: true, removed: true };
    }
    try {
      const txt = await downloadCal(url);
      ctx.prefs.calUrl = url.trim(); ctx.savePrefs();
      calText = txt; calAt = Date.now();
      fs.promises.writeFile(calFile, txt).catch(() => {});
      const n = (txt.match(/BEGIN:VEVENT/g) || []).length;
      return { ok: true, count: n };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  // mise à jour en arrière-plan toutes les 15 minutes (un seul petit téléchargement)
  setInterval(() => { if (ctx.prefs.calUrl) refreshCal().catch(() => {}); }, 15 * 60e3);

  // Prochain événement (pour la pilule) : en cours, ou à venir dans les 24 h. Calcul gardé 5 min en cache.
  let nextCache = { at: 0, src: null, list: [] };
  on('cal:next', async () => {
    if (!ctx.prefs.calUrl || !calText) return null;
    const now = Date.now();
    if (nextCache.src !== calText || now - nextCache.at > 5 * 60e3) {
      nextCache = { at: now, src: calText, list: eventsBetween(calText, now - 864e5, now + 2 * 864e5) };
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cand = nextCache.list.filter((e) => (e.allDay ? e.end > now && e.start < today.getTime() + 2 * 864e5 : e.end > now && e.start < now + 24 * 3600e3));
    // priorité : événement à heure fixe (en cours ou à venir), sinon journée entière
    return cand.find((e) => !e.allDay) || cand[0] || null;
  });

  // ouvrir Google Agenda (jour donné, ou nouvel événement) dans le navigateur
  on('cal:open', async ({ date, create, title }) => {
    const d = new Date(date || Date.now());
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const url = create
      ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || '')}&dates=${ymd}T180000/${ymd}T190000&ctz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
      : `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    await shell.openExternal(url);
    return true;
  });

  // =====================================================================
  // Paramètres
  // =====================================================================
  const UI_DEFAULTS = { accent: '#b5dca5', bg: '#1f171b', opacity: 100, openOn: 'click', peek: true, hiddenTabs: [], display: 'primary', notifs: true, notifsInGame: false, pillEvent: true, position: 'top', offset: 12 };
  const ui = () => ({ ...UI_DEFAULTS, ...(ctx.prefs.ui || {}) });

  on('notif:status', async () => {
    try { return await ctx.host.run(`Set-Notif $${ui().notifs !== false}`, 20000); } catch (e) { return 'error: ' + e.message; }
  });
  on('notif:open', async () => { await shell.openExternal('ms-settings:privacy-notifications'); return true; });

  on('settings:get', async () => ({
    ui: ui(),
    gameMode: ctx.prefs.gameMode !== false,
    login: ctx.getLogin(),
    calConnected: !!ctx.prefs.calUrl,
    city: ctx.prefs.city ? ctx.prefs.city.name : '',
    autoCity: ctx.prefs.autoLoc ? ctx.prefs.autoLoc.name : '',
    clipMax: maxClips(),
    musicApp: ctx.prefs.musicApp || '',
    apps: mine().map((a) => ({ key: a.key, name: a.name })),
    screens: ctx.listScreens(),
    engine: ctx.prefs.engine === 'powershell' ? 'powershell' : 'auto',
    engineNow: ctx.host ? ctx.host.engine : 'powershell',
  }));
  on('settings:set', async ({ key, value }) => {
    switch (key) {
      case 'ui': ctx.prefs.ui = { ...ui(), ...(value || {}) }; ctx.savePrefs(); ctx.onUiChange(); return true;
      case 'gameMode': ctx.prefs.gameMode = !!value; ctx.onGameModeChange(); break;
      case 'login': ctx.setLogin(!!value); break;
      case 'clipMax': ctx.prefs.clipMax = +value; break;
      case 'musicApp': ctx.prefs.musicApp = value || ''; break;
      case 'engine': ctx.prefs.engine = value === 'powershell' ? 'powershell' : 'auto'; break; // pris en compte au prochain lancement
      default: return false;
    }
    ctx.savePrefs();
    return true;
  });

  // Appli de musique (bouton « Ouvrir … » quand rien ne joue) : choisie dans les paramètres, sinon devinée
  on('music:app', async () => {
    const list = mine();
    let a = list.find((x) => x.key === ctx.prefs.musicApp);
    if (!a) a = list.find((x) => /deezer|spotify|apple music|tidal|youtube music|soundcloud/i.test(x.name));
    return a ? { key: a.key, name: a.name } : null;
  });

  // =====================================================================
  // Valorant : rang, RR et derniers matchs classés (API HenrikDev, clé gratuite)
  // =====================================================================
  const valoDir = path.join(app.getPath('userData'), 'valorant');
  const valoLast = path.join(valoDir, 'last.json');
  const REGIONS = ['eu', 'na', 'ap', 'kr', 'latam', 'br'];
  const TIERS_FR = { Unrated: 'Non classé', Iron: 'Fer', Bronze: 'Bronze', Silver: 'Argent', Gold: 'Or', Platinum: 'Platine', Diamond: 'Diamant', Ascendant: 'Ascendant', Immortal: 'Immortel', Radiant: 'Radiant' };
  const tierFr = (n) => String(n || '').replace(/^[A-Za-z]+/, (w) => TIERS_FR[w] || w);
  const valo = () => ctx.prefs.valo || (ctx.prefs.valo = { region: 'eu' });
  let valoCache = null;
  try { valoCache = JSON.parse(fs.readFileSync(valoLast, 'utf8')); } catch {}

  // Images (rang, maps) : téléchargées une fois puis gardées sur le disque
  const imgMem = new Map();
  async function imgData(url) {
    if (!url) return null;
    if (imgMem.has(url)) return imgMem.get(url);
    const file = path.join(valoDir, hash(url) + '.txt');
    try { const d = fs.readFileSync(file, 'utf8'); imgMem.set(url, d); return d; } catch {}
    try {
      const r = await fetch(url, { signal: timeout(6000) });
      if (!r.ok) return null;
      const d = `data:${r.headers.get('content-type') || 'image/png'};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
      imgMem.set(url, d);
      fs.mkdirSync(valoDir, { recursive: true }); fs.writeFileSync(file, d);
      return d;
    } catch { return null; }
  }
  // Jeu d'icônes de rang de l'épisode en cours (valorant-api.com)
  async function tierSet() {
    const c = ctx.prefs.valoTierSet;
    if (c && Date.now() - c.at < 7 * 864e5) return c.uuid;
    try {
      const j = await (await fetch('https://valorant-api.com/v1/competitivetiers', { signal: timeout(6000) })).json();
      const uuid = j.data[j.data.length - 1].uuid;
      ctx.prefs.valoTierSet = { uuid, at: Date.now() }; ctx.savePrefs();
      return uuid;
    } catch { return (c && c.uuid) || '03621f52-342b-cf4e-4f86-9350a49c6d04'; }
  }

  // Client Riot ouvert sur ce PC : on lit ton Riot ID (pseudo#tag) pour ne pas avoir à le taper
  function riotLocal(pathname) {
    return new Promise((resolve, reject) => {
      let port, pass;
      try {
        const lf = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Config', 'lockfile');
        [, , port, pass] = fs.readFileSync(lf, 'utf8').split(':');
      } catch { reject(new Error('client Riot fermé')); return; }
      const req = https.get({
        host: '127.0.0.1', port: +port, path: pathname, rejectUnauthorized: false, timeout: 3000,
        headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pass).toString('base64') },
      }, (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('délai dépassé')));
    });
  }
  async function detectRiotId() {
    try {
      const s = await riotLocal('/chat/v1/session');
      if (s && s.game_name && s.game_tag) return { name: s.game_name, tag: s.game_tag };
    } catch {}
    return null;
  }

  on('valo:detect', async () => detectRiotId());
  on('valo:set', async ({ riotId, region, key }) => {
    const v = valo();
    if (riotId !== undefined) {
      const m = String(riotId).trim().match(/^(.+?)\s*#\s*([^#\s]{2,6})$/);
      if (!m) return { ok: false, error: 'Écris ton Riot ID comme ceci : Pseudo#TAG' };
      v.name = m[1]; v.tag = m[2];
    }
    if (region && REGIONS.includes(region)) v.region = region;
    if (key !== undefined) v.key = String(key).trim();
    ctx.savePrefs();
    return { ok: true };
  });
  on('valo:open', async ({ id } = {}) => {
    const v = valo();
    if (id) await shell.openExternal(`https://tracker.gg/valorant/match/${encodeURIComponent(id)}`);
    else if (v.name) await shell.openExternal(`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(v.name + '#' + v.tag)}/overview`);
    return true;
  });
  on('valo:keypage', async () => { await shell.openExternal('https://api.henrikdev.xyz/dashboard/'); return true; });

  // ajoute les images au résultat (elles ne sont pas gardées dans last.json)
  async function withImages(d) {
    const set = await tierSet();
    const [rankImg, ...maps] = await Promise.all([
      imgData(`https://media.valorant-api.com/competitivetiers/${set}/${d.tierId}/largeicon.png`),
      ...d.matches.map((m) => (m.mapId ? imgData(`https://media.valorant-api.com/maps/${m.mapId}/listviewicon.png`) : null)),
    ]);
    return { ...d, rankImg, matches: d.matches.map((m, i) => ({ ...m, mapImg: maps[i] })) };
  }

  on('valo:data', async ({ force } = {}) => {
    const v = valo();
    if (!v.name) {
      const id = await detectRiotId();
      if (id) { Object.assign(v, id); ctx.savePrefs(); }
    }
    const setup = { name: v.name || '', tag: v.tag || '', region: v.region || 'eu', hasKey: !!v.key };
    if (!v.key || !v.name) return { setup };
    const who = `${v.region}/${v.name}#${v.tag}`.toLowerCase();
    const cached = valoCache && valoCache.who === who ? valoCache : null;
    if (!force && cached && Date.now() - cached.at < 120e3) return { setup, data: await withImages(cached.data), at: cached.at };

    let res;
    try {
      res = await fetch(`https://api.henrikdev.xyz/valorant/v2/mmr-history/${v.region}/pc/${encodeURIComponent(v.name)}/${encodeURIComponent(v.tag)}`,
        { headers: { Authorization: v.key }, signal: timeout(10000) });
    } catch (e) {
      return { setup, error: 'Pas de connexion à l\'API Valorant', data: cached ? await withImages(cached.data) : null, at: cached && cached.at };
    }
    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403 ? 'Clé API refusée : vérifie-la dans les réglages de l\'onglet'
        : res.status === 404 ? `Joueur « ${v.name}#${v.tag} » introuvable sur la région ${v.region.toUpperCase()}`
          : res.status === 429 ? 'Trop de demandes : réessaie dans une minute'
            : `L'API Valorant ne répond pas (erreur ${res.status})`;
      console.log('[valorant]', res.status, msg);
      return { setup, error: msg, badKey: res.status === 401 || res.status === 403, data: cached ? await withImages(cached.data) : null, at: cached && cached.at };
    }
    const j = await res.json();
    const hist = ((j.data && j.data.history) || []).map((h) => ({ ...h, t: Date.parse(h.date) })).sort((a, b) => b.t - a.t);
    const cur = hist[0];
    const sod = new Date(); sod.setHours(0, 0, 0, 0);
    const today = hist.filter((h) => h.t >= sod.getTime());
    const data = {
      name: (j.data.account && j.data.account.name) || v.name,
      tag: (j.data.account && j.data.account.tag) || v.tag,
      region: v.region,
      tierId: cur ? cur.tier.id : 0,
      tier: cur ? tierFr(cur.tier.name) : 'Non classé',
      rr: cur ? cur.rr : 0,
      today: { rr: today.reduce((a, h) => a + (h.last_change || 0), 0), w: today.filter((h) => h.last_change > 0).length, l: today.filter((h) => h.last_change < 0).length },
      matches: hist.slice(0, 10).map((h) => ({
        id: h.match_id, map: (h.map && h.map.name) || '?', mapId: h.map && h.map.id, t: h.t,
        change: h.last_change || 0, rr: h.rr, tierId: h.tier && h.tier.id, tier: tierFr(h.tier && h.tier.name),
      })),
    };
    valoCache = { who, at: Date.now(), data };
    fs.promises.mkdir(valoDir, { recursive: true }).then(() => fs.promises.writeFile(valoLast, JSON.stringify(valoCache))).catch(() => {});
    return { setup, data: await withImages(data), at: valoCache.at };
  });

  // =====================================================================
  // Fond d'écran
  // =====================================================================
  const thumbCache = new Map();
  const wallFolder = () => ctx.prefs.wallFolder || app.getPath('pictures');

  on('wall:list', async () => {
    const folder = wallFolder();
    let items = [];
    try {
      items = fs.readdirSync(folder, { withFileTypes: true })
        .filter((e) => e.isFile() && /\.(jpe?g|png|bmp)$/i.test(e.name))
        .map((e) => { const p = path.join(folder, e.name); let t = 0; try { t = fs.statSync(p).mtimeMs; } catch {} return { path: p, name: e.name, t }; })
        .sort((a, b) => b.t - a.t)
        .slice(0, 80);
    } catch {}
    let current = null;
    try { current = await ctx.worker.run('Get-Wallpaper'); } catch {}
    return { folder, folderName: path.basename(folder) || folder, items, current };
  });

  on('wall:thumbs', async ({ paths }) => {
    const out = {};
    for (const p of (paths || []).slice(0, 24)) {
      if (thumbCache.has(p)) { out[p] = thumbCache.get(p); continue; }
      let data = null;
      try { data = (await nativeImage.createThumbnailFromPath(p, { width: 320, height: 200 })).toDataURL(); }
      catch {
        try { const img = nativeImage.createFromPath(p); if (!img.isEmpty()) data = img.resize({ width: 320 }).toDataURL({ scaleFactor: 1 }); } catch {}
      }
      thumbCache.set(p, data);
      out[p] = data;
    }
    return out;
  });

  on('wall:set', async ({ path: p }) => {
    if (!p || !fs.existsSync(p)) return 'notfound';
    return ctx.worker.run(`Set-Wallpaper '${b64(p)}'`);
  });

  on('wall:folder', async () => {
    const r = await dialog.showOpenDialog({ title: 'Dossier de fonds d\'écran', defaultPath: wallFolder(), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return false;
    ctx.prefs.wallFolder = r.filePaths[0];
    ctx.savePrefs();
    return true;
  });

  // =====================================================================
  // Énergie
  // =====================================================================
  const run = (cmd, args) => spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  on('power:info', async () => ({ uptime: os.uptime() }));
  on('power:do', async ({ action }) => {
    switch (action) {
      case 'lock': run('rundll32.exe', ['user32.dll,LockWorkStation']); return true;
      case 'sleep': ctx.worker.run('Invoke-Sleep').catch(() => {}); return true;
      case 'logoff': run('shutdown.exe', ['/l']); return true;
      case 'restart': run('shutdown.exe', ['/r', '/t', '0']); return true;
      case 'shutdown': run('shutdown.exe', ['/s', '/t', '0']); return true;
      default: return false;
    }
  });

  // ---------- Mélangeur de son ----------
  const mixIcons = new Map();
  async function exeIcon(p) {
    if (!p) return null;
    if (mixIcons.has(p)) return mixIcons.get(p);
    let d = null;
    try { const img = await app.getFileIcon(p, { size: 'normal' }); if (!img.isEmpty()) d = img.toDataURL(); } catch {}
    mixIcons.set(p, d);
    return d;
  }
  on('mix:list', async () => {
    const r = await ctx.host.run('Get-Mixer', 8000);
    if (!r || !r.ok) return { ok: false };
    const items = Array.isArray(r.items) ? r.items : r.items ? [r.items] : [];
    // les applis qui jouent du son d'abord, puis par nom ; « Sons système » à la fin
    items.sort((a, b) => (a.key === 'system') - (b.key === 'system') || (b.active - a.active) || a.name.localeCompare(b.name));
    await Promise.all(items.map(async (it) => { it.icon = await exeIcon(it.path); }));
    return { ok: true, items, mic: r.mic || null };
  });
  // volume pendant qu'on glisse : on n'envoie que la dernière valeur
  const mixPending = new Map();
  let mixBusy = false;
  async function mixFlush() {
    if (mixBusy) return;
    mixBusy = true;
    while (mixPending.size) {
      const [key, v] = mixPending.entries().next().value;
      mixPending.delete(key);
      try { await ctx.host.run(`Set-MixerVolume '${b64(key)}' ${(v / 100).toFixed(3)}`, 4000); } catch {}
    }
    mixBusy = false;
  }
  on('mix:volume', async ({ key, vol }) => { mixPending.set(String(key), Math.max(0, Math.min(100, +vol || 0))); mixFlush(); return true; });
  on('mix:mute', async ({ key, mute }) => ctx.host.run(`Set-MixerMute '${b64(key)}' $${!!mute}`, 4000));
  on('mic:mute', async ({ mute }) => ctx.host.run(`Set-MicMute $${!!mute}`, 4000));

  // ---------- Mises à jour ----------
  on('update:status', async () => (ctx.updater ? ctx.updater.status() : { state: 'norepo' }));
  on('update:check', async () => (ctx.updater ? ctx.updater.check(true) : { state: 'norepo' }));
  on('update:install', async () => (ctx.updater ? ctx.updater.install() : { ok: false }));

  // ---------- point d'entrée unique ----------
  async function call(name, args) {
    const fn = handlers[name];
    if (!fn) throw new Error('fonction inconnue : ' + name);
    return fn(args || {});
  }
  return { call, onClipboardChange, warmup };
}

module.exports = { setup };
