// Pont vers PowerShell (src/ps/host.ps1).
// - commandes : run(script) -> Promise du résultat
// - événements : onEvent(obj) appelé quand PowerShell signale un changement (mode "main")
// - idleMs : arrête le processus après un temps sans commande (relancé tout seul au besoin)
const { spawn } = require('child_process');

class PSHost {
  constructor(name, { script, mode = 'main', env = {}, idleMs = 0, onEvent = null } = {}) {
    this.name = name;
    this.script = script;
    this.mode = mode;
    this.env = env;
    this.idleMs = idleMs;
    this.onEvent = onEvent;
    this.onReady = null;
    this.jobs = new Map();
    this.nextId = 1;
    this.holds = 0;
    this.proc = null;
    this.stopped = false;
    this.idleTimer = null;
    if (!idleMs) this._start();
  }

  _start() {
    this.buffer = '';
    this.ready = false;
    const proc = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', this.script, '-Mode', this.mode],
      { windowsHide: true, env: { ...process.env, ...this.env } }
    );
    this.proc = proc;
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d) => this._data(d));
    // la même erreur n'est écrite qu'une fois toutes les 10 minutes (évite de remplir le journal)
    const seen = new Map();
    proc.stderr.on('data', (d) => {
      for (const msg of d.toString().split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
        const t = seen.get(msg);
        if (t && Date.now() - t < 10 * 60e3) continue;
        seen.set(msg, Date.now());
        if (seen.size > 200) seen.delete(seen.keys().next().value);
        console.error(`[ps:${this.name}]`, msg);
      }
    });
    proc.stdin.on('error', () => {});
    proc.on('error', (e) => console.error(`[ps:${this.name}] impossible de lancer PowerShell`, e.message));
    proc.on('exit', () => {
      if (this.proc !== proc) return;
      this.proc = null;
      for (const [, job] of this.jobs) { clearTimeout(job.timer); job.reject(new Error('PowerShell fermé')); }
      this.jobs.clear();
      // le processus principal redémarre tout seul ; le worker attendra la prochaine commande
      if (!this.stopped && !this.idleMs) setTimeout(() => { if (!this.stopped) this._start(); }, 1500);
    });
  }

  _data(chunk) {
    this.buffer += chunk;
    let i;
    while ((i = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, i).replace(/\r$/, '').replace(/^﻿/, '');
      this.buffer = this.buffer.slice(i + 1);
      this._line(line);
    }
  }

  _line(line) {
    if (line.startsWith('@E ')) {
      let ev = null;
      try { ev = JSON.parse(line.slice(3)); } catch { return; }
      if (this.onEvent) this.onEvent(ev);
    } else if (line.startsWith('@R ')) {
      const sp = line.indexOf(' ', 3);
      const id = line.slice(3, sp);
      const job = this.jobs.get(id);
      if (!job) return;
      this.jobs.delete(id);
      clearTimeout(job.timer);
      let r = null;
      try { r = JSON.parse(line.slice(sp + 1)); } catch {}
      if (r && typeof r === 'object' && r.__error) job.reject(new Error(r.__error));
      else job.resolve(r);
      this._armIdle();
    } else if (line === '@READY') {
      this.ready = true;
      if (this.onReady) this.onReady();
    } else if (line.trim()) {
      console.log(`[ps:${this.name}]`, line);
    }
  }

  run(script, timeout = 15000) {
    if (this.stopped) return Promise.reject(new Error('arrêté'));
    if (!this.proc) this._start();
    clearTimeout(this.idleTimer);
    return new Promise((resolve, reject) => {
      const id = String(this.nextId++);
      const job = { resolve, reject };
      job.timer = setTimeout(() => {
        this.jobs.delete(id);
        reject(new Error('délai dépassé'));
        // une commande bloquée empêcherait tout le reste : on relance PowerShell
        if (this.proc) this.proc.kill();
      }, timeout);
      this.jobs.set(id, job);
      this.proc.stdin.write(`${id} ${Buffer.from(script, 'utf8').toString('base64')}\n`);
    });
  }

  // Garder le processus en vie (ex. onglet Stats ouvert)
  hold() { this.holds++; clearTimeout(this.idleTimer); }
  release() { this.holds = Math.max(0, this.holds - 1); this._armIdle(); }

  _armIdle() {
    if (!this.idleMs) return;
    clearTimeout(this.idleTimer);
    if (this.jobs.size || this.holds) return;
    this.idleTimer = setTimeout(() => {
      if (this.jobs.size || this.holds || !this.proc) return;
      const p = this.proc;
      this.proc = null;
      try { p.stdin.end(); } catch {}
      setTimeout(() => { try { p.kill(); } catch {} }, 1000);
    }, this.idleMs);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.idleTimer);
    if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch {} }
  }
}

module.exports = { PSHost };
