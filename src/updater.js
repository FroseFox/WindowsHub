// Mise à jour automatique : regarde la dernière Release du dépôt GitHub, télécharge Hub-Setup-x.y.z.exe
// et l'installe en silence quand tu le demandes (aucune fenêtre « Windows a protégé votre ordinateur » :
// le fichier ne passe pas par le navigateur).
const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');
const REPO = pkg.updateRepo || '';

const newer = (a, b) => {
  // a > b ?  (versions "1.2.10")
  const pa = String(a).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

function create({ onReady, isBusy }) {
  const dir = path.join(app.getPath('userData'), 'update');
  // state : idle | checking | uptodate | downloading | ready | error | private | norepo
  let st = { state: REPO ? 'idle' : 'norepo', current: app.getVersion(), latest: null, file: null, error: '', checkedAt: 0, progress: 0 };
  let busy = null;

  const status = () => ({ ...st, repo: REPO, packaged: app.isPackaged });

  async function check(manual) {
    if (!REPO) return status();
    if (busy) return busy;
    busy = (async () => {
      if (st.state !== 'ready') st = { ...st, state: 'checking', error: '' };
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { 'User-Agent': 'Hub-updater', Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(10000),
        });
        st.checkedAt = Date.now();
        if (r.status === 404) { st.state = 'private'; return status(); } // dépôt privé ou aucune release
        if (!r.ok) throw new Error(`GitHub a répondu ${r.status}`);
        const rel = await r.json();
        const latest = String(rel.tag_name || '').replace(/^v/i, '');
        st.latest = latest;
        if (!newer(latest, st.current)) { st.state = 'uptodate'; return status(); }
        const asset = (rel.assets || []).find((a) => /\.exe$/i.test(a.name));
        if (!asset) { st.state = 'error'; st.error = `la version ${latest} n'a pas encore de .exe (construction en cours ?)`; return status(); }
        const file = path.join(dir, asset.name);
        if (st.state === 'ready' && st.file === file) return status();
        // déjà téléchargé ?
        try { if (fs.statSync(file).size === asset.size) { st = { ...st, state: 'ready', file }; onReady && onReady(status(), manual); return status(); } } catch {}
        st.state = 'downloading'; st.progress = 0;
        fs.mkdirSync(dir, { recursive: true });
        for (const f of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} } // anciennes versions
        const d = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Hub-updater' }, signal: AbortSignal.timeout(10 * 60e3) });
        if (!d.ok) throw new Error(`téléchargement refusé (${d.status})`);
        const tmp = file + '.part';
        const out = fs.createWriteStream(tmp);
        let got = 0;
        for await (const chunk of d.body) {
          got += chunk.length;
          st.progress = asset.size ? Math.round((got / asset.size) * 100) : 0;
          if (!out.write(chunk)) await new Promise((res) => out.once('drain', res));
        }
        await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
        if (asset.size && fs.statSync(tmp).size !== asset.size) throw new Error('fichier incomplet');
        fs.renameSync(tmp, file);
        st = { ...st, state: 'ready', file, progress: 100 };
        console.log(`[mise à jour] version ${latest} téléchargée`);
        onReady && onReady(status(), manual);
      } catch (e) {
        st.state = 'error'; st.error = e.message;
        console.log('[mise à jour] échec :', e.message);
      }
      return status();
    })().finally(() => { busy = null; });
    return busy;
  }

  // Lance l'installateur en silence puis quitte : il remplace le hub et le relance tout seul.
  function install() {
    if (st.state !== 'ready' || !st.file) return { ok: false, error: 'aucune mise à jour prête' };
    if (!app.isPackaged) return { ok: false, error: 'mode développement (npm start) : installe le .exe à la main' };
    console.log('[mise à jour] installation de', st.latest);
    spawn(st.file, ['/S', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  }

  // 1re vérification 40 s après le démarrage, puis toutes les 6 h (jamais en pleine partie)
  if (REPO) {
    setTimeout(() => { if (!isBusy()) check(false); }, 40e3);
    setInterval(() => { if (!isBusy()) check(false); }, 6 * 3600e3);
  }

  return { check, install, status };
}

module.exports = { create, newer };
