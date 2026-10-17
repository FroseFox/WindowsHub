'use strict';
// Onglets Aujourd'hui, Stats, Presse-papier, Apps, Fond d'écran, Énergie.
// Utilise les outils de app.js : $, $$, api, icon, setIcon, esc, size, TABS, setState.

const feat = async (name, args) => {
  const r = await api.feat(name, args);
  if (!r || !r.ok) throw new Error((r && r.error) || 'erreur');
  return r.data;
};
const featEvents = {};
api.on('feat:event', (e) => { if (e && featEvents[e.type]) featEvents[e.type](e.data); });
const resize = () => { if (state === 'open') size(); };

function fmtBytes(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i >= 3 ? dec : 0).replace('.', ',')} ${u[i]}`;
}
function fmtRate(n) { return n == null ? '—' : fmtBytes(n, 1) + '/s'; }
function fmtUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} j ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  return `${m} min`;
}
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
const hue = (str) => { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

// =====================================================================
// Aujourd'hui
// =====================================================================
(function today() {
  const pane = $('[data-pane="today"]');
  const notes = $('textarea', pane);
  let clockT = null;
  let notesLoaded = false;
  let saveT = null;

  const WMO = (c, day = true) => {
    if (c === 0) return [day ? 'sun' : 'moon', 'Ciel dégagé'];
    if (c <= 2) return [day ? 'cloudSun' : 'cloudMoon', c === 1 ? 'Plutôt dégagé' : 'Éclaircies'];
    if (c === 3) return ['cloud', 'Couvert'];
    if (c === 45 || c === 48) return ['fog', 'Brouillard'];
    if (c >= 51 && c <= 57) return ['drizzle', 'Bruine'];
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ['rain', c >= 80 ? 'Averses' : 'Pluie'];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ['snow', 'Neige'];
    if (c >= 95) return ['storm', 'Orages'];
    return ['cloud', '—'];
  };

  function tickClock() {
    const d = new Date();
    $('.t-clock', pane).innerHTML = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}<span>${String(d.getSeconds()).padStart(2, '0')}</span>`;
    $('.t-date', pane).textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---------- Calendrier + agenda (Google Agenda) ----------
  const DAYMS = 864e5;
  const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  let view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0);
  let selected = sod(Date.now());
  let cal = { configured: false, events: [] };
  let side = 'agenda';

  const eventsOn = (day) => cal.events.filter((e) => e.start < day + DAYMS && Math.max(e.end, e.start + 1) > day);

  function renderCal() {
    const now = new Date();
    const y = view.getFullYear(), m = view.getMonth();
    const start = (new Date(y, m, 1).getDay() + 6) % 7; // lundi = 0
    const total = Math.ceil((start + new Date(y, m + 1, 0).getDate()) / 7) * 7;
    let html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('');
    for (let i = 0; i < total; i++) {
      const d = new Date(y, m, i - start + 1);
      const t = d.getTime();
      const cls = [d.getMonth() !== m ? 'out' : '', i % 7 >= 5 ? 'we' : '', t === sod(now) ? 'today' : '', t === selected ? 'sel' : ''].filter(Boolean).join(' ');
      const n = cal.configured ? Math.min(3, eventsOn(t).length) : 0;
      html += `<span class="${cls}" data-day="${t}">${d.getDate()}${n ? `<em class="dots">${'<i></i>'.repeat(n)}</em>` : ''}</span>`;
    }
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    $('.t-cal', pane).innerHTML = `<div class="cal-head"><b>${view.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>
      <div class="cal-nav">${isCurrent ? '' : '<button class="cal-today-btn" data-cal="today">Aujourd\'hui</button>'}
      <button data-cal="prev" title="Mois précédent">${icon('chevL')}</button><button data-cal="next" title="Mois suivant">${icon('chevron')}</button></div></div>
      <div class="cal-grid">${html}</div>`;
  }

  function dayLabel(t) {
    const today = sod(Date.now());
    if (t === today) return "Aujourd'hui";
    if (t === today + DAYMS) return 'Demain';
    if (t === today - DAYMS) return 'Hier';
    return new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  function renderAgenda() {
    const box = $('.t-agenda', pane);
    $('.t-add', pane).hidden = !cal.configured || side !== 'agenda';
    if (!cal.configured) {
      box.innerHTML = `<div class="ag-empty"><b>Connecte ton Google Agenda</b><br>pour voir tes événements ici et sur le calendrier.
        <br><button class="pill-btn" data-ag="setup">Connecter</button></div>`;
      return;
    }
    if (cal.error && !cal.events.length) {
      box.innerHTML = `<div class="ag-empty"><b>Agenda injoignable</b><br>${esc(cal.error)}<br><button class="pill-btn ghost" data-ag="retry">Réessayer</button></div>`;
      return;
    }
    const list = eventsOn(selected);
    const now = Date.now();
    let html = `<div class="ag-day">${dayLabel(selected)}</div>`;
    if (!list.length) {
      const next = cal.events.find((e) => e.start >= selected + DAYMS);
      html += `<div class="ag-empty">Rien de prévu.${next ? `<br>Prochain : <b>${esc(next.title)}</b> · ${dayLabel(sod(next.start)).toLowerCase()}${next.allDay ? '' : ' à ' + hm(next.start)}` : ''}</div>`;
    } else {
      html += list.map((e) => {
        const when = e.allDay ? 'Journée' : `${hm(e.start)} – ${hm(e.end)}`;
        const st = e.end < now ? 'past' : e.start <= now ? 'now' : '';
        return `<div class="ev ${st}" data-ev="${e.start}" title="Ouvrir dans Google Agenda"><span class="ev-t">${when}</span>
          <span class="ev-b"><b>${esc(e.title)}</b>${e.location ? `<small>${esc(e.location)}</small>` : ''}</span></div>`;
      }).join('');
    }
    box.innerHTML = html;
  }

  async function loadEvents(force) {
    const from = new Date(view.getFullYear(), view.getMonth() - 1, 1).getTime();
    const to = new Date(view.getFullYear(), view.getMonth() + 3, 1).getTime();
    try {
      const r = await feat('cal:events', { from, to, force });
      cal = { configured: r.configured, events: r.events || [], error: r.error };
      renderCal(); renderAgenda();
      if (r.stale && !force) loadEvents(true);
    } catch (e) { cal = { configured: true, events: [], error: e.message }; renderAgenda(); }
  }

  function setSide(name) {
    side = name;
    $$('.seg-b', pane).forEach((b) => b.classList.toggle('active', b.dataset.side === name));
    $('.t-agenda', pane).hidden = name !== 'agenda';
    notes.hidden = name !== 'notes';
    renderAgenda();
  }

  pane.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-cal]');
    if (nav) {
      const a = nav.dataset.cal;
      if (a === 'today') { view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0); selected = sod(Date.now()); }
      else view = new Date(view.getFullYear(), view.getMonth() + (a === 'next' ? 1 : -1), 1);
      renderCal(); renderAgenda(); loadEvents();
      return;
    }
    const day = e.target.closest('[data-day]');
    if (day) {
      selected = +day.dataset.day;
      const d = new Date(selected);
      if (d.getMonth() !== view.getMonth()) { view = new Date(d.getFullYear(), d.getMonth(), 1); loadEvents(); }
      setSide('agenda'); renderCal();
      return;
    }
    const seg = e.target.closest('[data-side]');
    if (seg) { setSide(seg.dataset.side); return; }
    const ev = e.target.closest('[data-ev]');
    if (ev) { feat('cal:open', { date: +ev.dataset.ev }).catch(() => {}); return; }
    if (e.target.closest('.t-add')) { feat('cal:open', { date: selected, create: true }).catch(() => {}); return; }
    const ag = e.target.closest('[data-ag]');
    if (ag) { if (ag.dataset.ag === 'setup') { showTab('settings'); setTimeout(() => { const el = $('#set-cal'); if (el) el.scrollIntoView({ block: 'center' }); }, 80); } else loadEvents(true); }
  });

  // affiche tout de suite la dernière météo connue, puis la met à jour si elle est trop ancienne
  async function loadWeather(force) {
    try {
      const r = await feat('today:weather', { force });
      showWeather(r.data);
      if (r.stale) { const f = await feat('today:weather', { force: true }); showWeather(f.data); }
    } catch (e) {
      if (!$('.w-temp', pane)) showWeather(null);
    }
  }

  function showWeather(w) {
    const box = $('.t-weather', pane);
    try {
      if (!w) throw new Error('vide');
      const [ic, label] = WMO(w.now.code, w.now.day);
      box.innerHTML = `<div class="w-ic">${icon(ic)}</div>
        <div class="w-temp">${Math.round(w.now.temp)}°</div>
        <div class="w-txt"><b>${label}</b>
          <span>Ressenti ${Math.round(w.now.feels)}° · vent ${Math.round(w.now.wind)} km/h</span>
          <span class="w-city" title="Changer de ville">${icon('pinMap')}${esc(w.city || 'Ma position')}</span></div>`;
      const all = w.days.flatMap((d) => [d.min, d.max]);
      const lo = Math.min(...all), hi = Math.max(...all), span = Math.max(1, hi - lo);
      $('.t-days', pane).innerHTML = w.days.map((d, i) => {
        const name = i === 0 ? 'Auj.' : new Date(d.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short' });
        const left = ((d.min - lo) / span) * 100, width = Math.max(6, ((d.max - d.min) / span) * 100);
        return `<div class="t-day ${i === 0 ? 'first' : ''}"><span class="d-name">${name}</span>${icon(WMO(d.code)[0])}
          <span class="mn">${Math.round(d.min)}°</span><div class="t-range"><i style="left:${left}%;width:${width}%"></i></div><span class="mx">${Math.round(d.max)}°</span></div>`;
      }).join('');
    } catch (e) {
      box.innerHTML = `<div class="w-txt"><b>Météo indisponible</b><span class="w-city">${icon('pinMap')}Choisir une ville</span></div>`;
      $('.t-days', pane).innerHTML = '<div class="empty">Pas de connexion à la météo pour le moment.</div>';
    }
    resize();
  }

  // cliquer sur la ville pour la changer
  pane.addEventListener('click', (e) => {
    const c = e.target.closest('.w-city');
    if (!c) return;
    c.outerHTML = '<input class="w-city-input" placeholder="Ville (vide = auto)">';
    const input = $('.w-city-input', pane);
    setTyping(true);
    setTimeout(() => input.focus(), 40);
    input.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Escape') loadWeather();
      if (ev.key !== 'Enter') return;
      const r = await feat('today:city', { name: input.value }).catch(() => null);
      if (r && !r.ok) { input.value = ''; input.placeholder = 'Ville introuvable'; return; }
      loadWeather(true);
    });
  });

  notes.addEventListener('input', () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => feat('today:notes', { text: notes.value }).catch(() => {}), 500);
  });

  TABS.today = {
    async show() {
      tickClock(); renderCal(); renderAgenda();
      clearInterval(clockT);
      clockT = setInterval(tickClock, 1000);
      loadEvents();
      loadWeather();
      if (!notesLoaded) { notes.value = await feat('today:notes').catch(() => ''); notesLoaded = true; }
    },
    hide() { clearInterval(clockT); },
    refreshCal() { loadEvents(true); },
  };
  tickClock(); renderCal();
})();

// =====================================================================
// Stats
// =====================================================================
(function stats() {
  const grid = $('.stats-grid');
  const hist = { cpu: [], ram: [], gpu: [], down: [], up: [] };
  const N = 40;
  let last = null;
  let battery = null;

  grid.innerHTML = `
    <div class="card stat" data-s="cpu"><div class="stat-top">${icon('cpu')}Processeur</div><div class="stat-val"></div><div class="stat-sub"></div><svg class="spark" preserveAspectRatio="none"></svg></div>
    <div class="card stat" data-s="ram"><div class="stat-top">${icon('ram')}Mémoire</div><div class="stat-val"></div><div class="stat-sub"></div><svg class="spark" preserveAspectRatio="none"></svg></div>
    <div class="card stat" data-s="gpu"><div class="stat-top">${icon('monitor')}Carte graphique</div><div class="stat-val"></div><div class="stat-sub"></div><svg class="spark" preserveAspectRatio="none"></svg></div>
    <div class="card stat" data-s="disk"><div class="stat-top">${icon('disk')}Disque C:</div><div class="stat-val"></div><div class="stat-sub"></div><div class="meter"><i></i></div></div>
    <div class="card stat" data-s="net"><div class="stat-top">${icon('net')}Réseau</div><div class="net-val"><span class="dn">${icon('down')}<em></em></span><span class="upv">${icon('up')}<em></em></span></div><div class="stat-sub"></div><svg class="spark" preserveAspectRatio="none"></svg></div>
    <div class="card stat" data-s="sys"><div class="stat-top">${icon('clock')}Allumé depuis</div><div class="stat-val"></div><div class="stat-sub"></div><div class="meter"><i></i></div></div>`;

  const push = (k, v) => { if (v == null) return; hist[k].push(v); if (hist[k].length > N) hist[k].shift(); };
  const card = (k) => $(`[data-s="${k}"]`, grid);

  function spark(svg, series, max) {
    const w = 200, h = 42;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // la courbe occupe toute la largeur dès les premières mesures
    const pts = (arr) => arr.map((v, i) => [(i / Math.max(1, arr.length - 1)) * w, h - 3 - (Math.min(v, max) / max) * (h - 8)]);
    let html = '';
    series.forEach((arr, idx) => {
      if (arr.length < 2) return;
      const p = pts(arr);
      const line = p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('');
      if (idx === 0) html += `<path class="area" d="${line}L${p[p.length - 1][0].toFixed(1)},${h}L${p[0][0].toFixed(1)},${h}Z"/>`;
      html += `<path class="${idx === 0 ? 'line' : 'line2'}" d="${line}"/>`;
    });
    svg.innerHTML = html;
  }
  const meter = (el, pct) => {
    const m = $('.meter', el);
    $('i', m).style.width = Math.max(2, Math.min(100, pct)) + '%';
    m.classList.toggle('warn', pct >= 75 && pct < 90);
    m.classList.toggle('bad', pct >= 90);
  };

  function render(d) {
    last = d;
    push('cpu', d.cpu);
    const ramUsed = d.ramTotal - d.ramFree;
    push('ram', (ramUsed / d.ramTotal) * 100);
    push('gpu', d.gpu);
    push('down', d.down); push('up', d.up);

    let c = card('cpu');
    $('.stat-val', c).innerHTML = d.cpu == null ? '…' : `${d.cpu}<small>%</small>`;
    $('.stat-sub', c).textContent = `${(d.cpuName || '').replace(/\(R\)|\(TM\)|CPU|Processor|\s+@.*$/gi, '').replace(/\s+/g, ' ').trim()} · ${d.cores} threads`;
    spark($('.spark', c), [hist.cpu], 100);

    c = card('ram');
    $('.stat-val', c).innerHTML = `${Math.round((ramUsed / d.ramTotal) * 100)}<small>%</small>`;
    $('.stat-sub', c).textContent = `${fmtBytes(ramUsed)} utilisés sur ${fmtBytes(d.ramTotal, 0)}`;
    spark($('.spark', c), [hist.ram], 100);

    c = card('gpu');
    $('.stat-val', c).innerHTML = d.gpu == null ? '—' : `${d.gpu}<small>%</small>`;
    $('.stat-sub', c).textContent = d.gpuName || 'Charge 3D';
    spark($('.spark', c), [hist.gpu], 100);

    c = card('disk');
    if (d.disk) {
      const used = d.disk.total - d.disk.free, pct = (used / d.disk.total) * 100;
      $('.stat-val', c).innerHTML = `${fmtBytes(d.disk.free, 0)}<small>libres</small>`;
      $('.stat-sub', c).textContent = `${fmtBytes(used, 0)} utilisés sur ${fmtBytes(d.disk.total, 0)}`;
      meter(c, pct);
    }

    c = card('net');
    $('.dn em', c).textContent = fmtRate(d.down);
    $('.upv em', c).textContent = fmtRate(d.up);
    $('.stat-sub', c).textContent = 'Réception · Envoi';
    const maxNet = Math.max(64 * 1024, ...hist.down, ...hist.up) * 1.1;
    spark($('.spark', c), [hist.down, hist.up], maxNet);

    c = card('sys');
    $('.stat-val', c).textContent = fmtUptime(d.uptime);
    if (battery) {
      $('.stat-top', c).innerHTML = `${icon('battery')}Batterie`;
      $('.stat-val', c).innerHTML = `${Math.round(battery.level * 100)}<small>%</small>`;
      $('.stat-sub', c).textContent = (battery.charging ? 'En charge · ' : '') + `allumé depuis ${fmtUptime(d.uptime)}`;
      meter(c, battery.level * 100);
    } else {
      $('.stat-sub', c).textContent = `Depuis le ${new Date(Date.now() - d.uptime * 1000).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}`;
      $('.meter', c).style.display = 'none';
    }
  }

  featEvents.stats = (d) => { if (currentTab === 'stats' && state === 'open') render(d); };

  TABS.stats = {
    async show() {
      if (!battery && navigator.getBattery) {
        try { const b = await navigator.getBattery(); if (b.level < 1 || !b.charging || b.dischargingTime !== Infinity) battery = b; } catch {}
      }
      if (last) render(last);
      feat('stats:start').catch(() => {});
    },
    hide() { feat('stats:stop').catch(() => {}); },
  };
})();

// =====================================================================
// Presse-papier
// =====================================================================
(function clipTab() {
  const pane = $('[data-pane="clip"]');
  const list = $('.clip-list', pane);
  const search = $('.search input', pane);
  let items = [];
  let paused = false;
  let flash = null;
  let diag = null;

  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = items
      .filter((c) => !q || (c.type === 'text' && c.text.toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned - a.pinned) || (b.t - a.t));
    $('.clip-pause', pane).textContent = paused ? 'Reprendre' : 'Pause';
    if (!shown.length) {
      let why = '';
      if (!q && !paused && diag) {
        why = !diag.events
          ? "Aucune copie détectée depuis le lancement du hub."
          : `${diag.events} copie${diag.events > 1 ? 's' : ''} détectée${diag.events > 1 ? 's' : ''}, mais rien n'a pu être lu${diag.error ? ' : ' + esc(diag.error) : '.'}`;
      }
      list.innerHTML = `<div class="empty">${q ? 'Aucun résultat.' : paused ? "L'historique est en pause." : 'Copie du texte ou une image (Ctrl+C), ça apparaîtra ici.'}${why ? `<small class="clip-diag">${why}</small>` : ''}</div>`;
      resize();
      return;
    }
    list.innerHTML = shown.slice(0, 60).map((c) => `
      <div class="clip ${c.pinned ? 'pinned' : ''} ${flash === c.id ? 'copied' : ''}" data-id="${esc(c.id)}" title="Cliquer pour copier">
        ${c.type === 'image'
          ? `<div class="clip-img"><img src="${c.thumb}" alt=""><span>Image ${c.w}×${c.h}</span></div>`
          : `<div class="clip-txt">${esc(c.text.slice(0, 400))}</div>`}
        <span class="clip-meta">${flash === c.id ? 'Copié !' : ago(c.t)}</span>
        <div class="clip-acts">
          <button class="act-pin" data-a="pin" title="${c.pinned ? 'Désépingler' : 'Épingler'}">${icon('pin')}</button>
          <button data-a="delete" title="Supprimer">${icon('trash')}</button>
        </div>
      </div>`).join('');
    resize();
  }

  list.addEventListener('click', async (e) => {
    const row = e.target.closest('.clip');
    if (!row) return;
    const id = row.dataset.id;
    const act = e.target.closest('[data-a]');
    if (act) { await feat('clip:' + act.dataset.a, { id }).catch(() => {}); return; }
    await feat('clip:copy', { id }).catch(() => {});
    flash = id;
    render();
    setTimeout(() => { flash = null; render(); }, 1100);
  });
  search.addEventListener('input', render);
  $('.clip-clear', pane).addEventListener('click', () => feat('clip:clear').catch(() => {}));
  $('.clip-pause', pane).addEventListener('click', async () => { paused = await feat('clip:pause', { paused: !paused }).catch(() => paused); render(); });
  // le hub signale juste un changement : on ne recharge la liste que si l'onglet est visible
  featEvents.clips = () => { if (currentTab === 'clip' && state === 'open') TABS.clip.show(); };

  TABS.clip = {
    async show() {
      try { const r = await feat('clip:list'); items = r.items || []; paused = r.paused; diag = r.diag || null; } catch (e) { diag = { events: 1, error: 'le hub ne répond pas (' + e.message + ')' }; }
      render();
    },
  };
})();

// =====================================================================
// Apps
// =====================================================================
(function appsTab() {
  // Onglet Apps : UNIQUEMENT les applis que tu ajoutes (bouton +).
  const pane = $('[data-pane="apps"]');
  const bar = $('.bar', pane);
  const body = $('.apps-body', pane);
  let mine = [];            // tes applis
  let installed = null;     // applis du menu Démarrer (chargées seulement en mode ajout)
  let adding = false;
  const icons = {};
  let dragKey = null;

  const ikey = (a) => a.id || a.path;
  function iconHtml(a) {
    const src = icons[ikey(a)];
    if (src) return `<img src="${src}" alt="">`;
    return `<span class="letter" style="background:hsl(${hue(a.name)} 45% 74%)">${esc((a.name.match(/[A-Za-z0-9À-ÿ]/) || ['?'])[0].toUpperCase())}</span>`;
  }

  async function loadIcons(list) {
    const todo = list.filter((a) => !(ikey(a) in icons)).slice(0, 30);
    if (!todo.length) return;
    todo.forEach((a) => { icons[ikey(a)] = null; });
    try {
      const got = await feat('apps:icons', { items: todo.map((a) => ({ id: a.id, path: a.path, name: a.name })) });
      Object.assign(icons, got);
      if (Object.values(got).some(Boolean)) render();
    } catch {}
  }

  function setBar() {
    bar.innerHTML = adding
      ? `<label class="search">${icon('search')}<input type="text" placeholder="Chercher une appli installée" spellcheck="false"></label>
         <button class="pill-btn ghost" data-a="browse">${icon('folder')}Fichier…</button>
         <button class="pill-btn" data-a="done">Terminé</button>`
      : `<label class="search">${icon('search')}<input type="text" placeholder="Rechercher dans mes applis" spellcheck="false"></label>
         <button class="pill-btn" data-a="add">${icon('plus')}Ajouter</button>`;
    $('input', bar).addEventListener('input', render);
    $('input', bar).addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.target.value = ''; render(); }
      if (e.key === 'Enter') { const first = $(adding ? '.add-row:not(.added)' : '.app', body); if (first) first.click(); }
    });
  }

  function render() {
    const q = ($('input', bar) || {}).value ? $('input', bar).value.trim().toLowerCase() : '';
    if (adding) {
      if (!installed) { body.innerHTML = '<div class="empty">Chargement des applis installées…</div>'; resize(); return; }
      const keys = new Set(mine.map((a) => a.key));
      const hits = installed.filter((a) => !q || a.name.toLowerCase().includes(q)).slice(0, 80);
      body.innerHTML = hits.length
        ? `<div class="apps-list">${hits.map((a) => {
            const added = keys.has('id:' + a.id);
            return `<div class="app add-row ${added ? 'added' : ''}" data-id="${esc(a.id)}" data-name="${esc(a.name)}">
              <div class="app-ic">${iconHtml(a)}</div><div class="app-name">${esc(a.name)}</div>
              <span class="add-state">${added ? icon('check') + 'Ajoutée' : icon('plus') + 'Ajouter'}</span></div>`;
          }).join('')}</div>`
        : '<div class="empty">Aucune appli trouvée. Utilise « Fichier… » pour choisir un .exe.</div>';
      resize();
      loadIcons(hits.slice(0, 16));
      return;
    }
    const shown = mine.filter((a) => !q || a.name.toLowerCase().includes(q));
    if (!mine.length) {
      body.innerHTML = `<div class="empty">Aucune appli pour l'instant.<br>Clique sur <b>Ajouter</b> pour choisir tes applis et tes jeux.</div>`;
      resize();
      return;
    }
    body.innerHTML = shown.length
      ? `<div class="apps-grid">${shown.map((a) => `<div class="app" draggable="${q ? 'false' : 'true'}" data-key="${esc(a.key)}" title="${esc(a.name)}">
          <div class="app-ic">${iconHtml(a)}</div><div class="app-name">${esc(a.name)}</div>
          <button class="app-x" data-x title="Retirer">${icon('x')}</button></div>`).join('')}</div>`
      : '<div class="empty">Aucune de tes applis ne correspond.</div>';
    resize();
    loadIcons(mine);
  }

  bar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'add') {
      adding = true; setBar(); render();
      if (!installed) { installed = await feat('apps:installed').catch(() => []); render(); }
    } else if (b.dataset.a === 'done') {
      adding = false; setBar(); render();
    } else if (b.dataset.a === 'browse') {
      const r = await feat('apps:pick').catch(() => null);
      if (r) { mine = r; adding = false; setBar(); render(); }
    }
  });

  body.addEventListener('click', async (e) => {
    const row = e.target.closest('.add-row');
    if (row) {
      if (row.classList.contains('added')) return;
      mine = await feat('apps:add', { id: row.dataset.id, name: row.dataset.name }).catch(() => mine);
      render();
      return;
    }
    const el = e.target.closest('.app');
    if (!el) return;
    const key = el.dataset.key;
    if (e.target.closest('[data-x]')) {
      mine = await feat('apps:remove', { key }).catch(() => mine);
      render();
      return;
    }
    el.style.opacity = '0.5';
    await feat('apps:launch', { key }).catch(() => {});
    setTimeout(() => setState('pill'), 200);
  });

  // en mode ajout, les icônes se chargent au fur et à mesure du défilement
  body.addEventListener('scroll', () => {
    if (!adding || !installed) return;
    clearTimeout(body._t);
    body._t = setTimeout(() => {
      const br = body.getBoundingClientRect();
      const ids = $$('.add-row', body).filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > br.top && r.top < br.bottom + 150; }).map((el) => el.dataset.id);
      loadIcons(installed.filter((a) => ids.includes(a.id)));
    }, 150);
  }, { passive: true });

  // glisser-déposer pour réorganiser
  body.addEventListener('dragstart', (e) => { const el = e.target.closest('.app[data-key]'); if (el) { dragKey = el.dataset.key; el.classList.add('dragging'); } });
  body.addEventListener('dragend', () => { dragKey = null; $$('.dragging', body).forEach((x) => x.classList.remove('dragging')); });
  body.addEventListener('dragover', (e) => { if (dragKey) e.preventDefault(); });
  body.addEventListener('drop', async (e) => {
    const el = e.target.closest('.app[data-key]');
    if (!dragKey || !el || el.dataset.key === dragKey) return;
    e.preventDefault();
    const to = mine.findIndex((a) => a.key === el.dataset.key);
    mine = await feat('apps:move', { key: dragKey, to }).catch(() => mine);
    render();
  });

  setBar();
  TABS.apps = {
    async show() {
      mine = await feat('apps:mine').catch(() => mine);
      render();
    },
    hide() { if (adding) { adding = false; setBar(); } },
  };
})();

// =====================================================================
// Fond d'écran
// =====================================================================
(function wallTab() {
  const pane = $('[data-pane="wall"]');
  const grid = $('.wall-grid', pane);
  let data = null;
  const thumbs = {};

  function norm(p) { return (p || '').toLowerCase().replace(/\//g, '\\'); }

  function render() {
    if (!data) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Chargement…</div>'; resize(); return; }
    $('.wall-folder b', pane).textContent = data.folderName;
    $('.wall-folder', pane).title = data.folder;
    if (!data.items.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Aucune image (JPG, PNG) dans ce dossier.<br>Choisis le dossier où tu ranges tes fonds d\'écran.</div>';
      resize();
      return;
    }
    grid.innerHTML = data.items.map((w) => `<div class="wall ${norm(w.path) === norm(data.current) ? 'current' : ''}" data-path="${esc(w.path)}" title="${esc(w.name)}">
      ${thumbs[w.path] ? `<img src="${thumbs[w.path]}" alt="">` : ''}</div>`).join('');
    resize();
  }

  async function loadThumbs() {
    const todo = data.items.map((w) => w.path).filter((p) => !(p in thumbs));
    for (let i = 0; i < todo.length; i += 12) {
      if (currentTab !== 'wall') return;
      const got = await feat('wall:thumbs', { paths: todo.slice(i, i + 12) }).catch(() => ({}));
      Object.assign(thumbs, got);
      for (const [p, src] of Object.entries(got)) {
        const el = grid.querySelector(`.wall[data-path="${CSS.escape(p)}"]`);
        if (el && src && !el.querySelector('img')) el.innerHTML = `<img src="${src}" alt="">`;
      }
    }
  }

  async function load() {
    try { data = await feat('wall:list'); } catch { data = { folder: '', folderName: '—', items: [] }; }
    render();
    loadThumbs();
  }

  async function apply(p) {
    const el = grid.querySelector(`.wall[data-path="${CSS.escape(p)}"]`);
    if (el) el.classList.add('busy');
    const r = await feat('wall:set', { path: p }).catch(() => 'error');
    if (r === 'ok') data.current = p;
    render();
  }

  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.wall');
    if (el) apply(el.dataset.path);
  });
  $('.wall-random', pane).addEventListener('click', () => {
    if (!data || !data.items.length) return;
    const pool = data.items.filter((w) => norm(w.path) !== norm(data.current));
    const pick = (pool.length ? pool : data.items)[Math.floor(Math.random() * (pool.length || data.items.length))];
    apply(pick.path);
  });
  $('.wall-change', pane).addEventListener('click', async () => {
    const changed = await feat('wall:folder').catch(() => false);
    if (changed) { data = null; render(); load(); }
  });

  TABS.wall = { show: load };
})();

// =====================================================================
// Énergie
// =====================================================================
(function powerTab() {
  const pane = $('[data-pane="power"]');
  const LABELS = { restart: 'Redémarrer', shutdown: 'Éteindre', logoff: 'Déconnexion' };
  let armed = null, armT = null;

  function disarm() {
    if (!armed) return;
    const b = $(`[data-power="${armed}"]`, pane);
    b.classList.remove('confirm');
    $('b', b).textContent = LABELS[armed];
    armed = null;
  }

  pane.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-power]');
    if (!b) return;
    const action = b.dataset.power;
    // Redémarrer / Éteindre / Déconnexion : il faut cliquer deux fois
    if (LABELS[action] && armed !== action) {
      disarm();
      armed = action;
      b.classList.add('confirm');
      $('b', b).textContent = 'Confirmer ?';
      clearTimeout(armT);
      armT = setTimeout(disarm, 3500);
      return;
    }
    disarm();
    setState('pill');
    feat('power:do', { action }).catch(() => {});
  });

  TABS.power = {
    async show() {
      $$('[data-icon]', pane).forEach((el) => setIcon(el, el.dataset.icon));
      let up = null;
      try { up = (await feat('power:info')).uptime; } catch {}
      let bat = '';
      if (navigator.getBattery) {
        try { const b = await navigator.getBattery(); if (b.dischargingTime !== Infinity || b.level < 1) bat = ` · Batterie <b>${Math.round(b.level * 100)} %</b>${b.charging ? ' (en charge)' : ''}`; } catch {}
      }
      $('.power-info', pane).innerHTML = `<span>${up != null ? `Allumé depuis <b>${fmtUptime(up)}</b>` : ''}${bat}</span>`;
      resize();
    },
    hide: disarm,
  };
})();

// =====================================================================
// Minuteur / Chrono
// =====================================================================
(function timerTab() {
  const body = $('.timer-body');
  const PRESETS = [1, 3, 5, 10, 15, 25, 45, 60];
  const R = 86, C = 2 * Math.PI * R;
  let mode = 'timer';
  const T = clock.timer, S = clock.sw;

  function render() {
    const isT = mode === 'timer';
    body.innerHTML = `
      <div class="tm-head"><div class="seg"><button class="seg-b ${isT ? 'active' : ''}" data-mode="timer">Minuteur</button><button class="seg-b ${isT ? '' : 'active'}" data-mode="sw">Chrono</button></div></div>
      <div class="tm-dial">
        <svg class="tm-ring" viewBox="0 0 196 196"><circle class="bgc" cx="98" cy="98" r="${R}"/><circle class="fgc" cx="98" cy="98" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="tm-time"><b></b><span></span></div>
      </div>
      <div class="tm-side">
        ${isT ? `
          <div><div class="tm-label">Durée</div><div class="tm-presets" style="margin-top:6px">${PRESETS.map((m) => `<button class="chip" data-preset="${m}">${m} min</button>`).join('')}</div></div>
          <div><div class="tm-label">Ajuster</div><div class="tm-adjust" style="margin-top:6px">
            <button class="chip" data-add="-60000">−1 min</button><button class="chip" data-add="-10000">−10 s</button>
            <button class="chip" data-add="10000">+10 s</button><button class="chip" data-add="60000">+1 min</button><button class="chip" data-add="300000">+5 min</button></div></div>
          <div class="tm-ctrls"><button class="tm-big" data-act="go"></button><button class="tm-sec" data-act="reset">${icon('refresh')}Réinitialiser</button></div>`
        : `
          <div class="tm-label">Tours</div>
          <div class="tm-laps"></div>
          <div class="tm-ctrls"><button class="tm-big" data-act="go"></button><button class="tm-sec" data-act="lap">${icon('flag')}Tour</button><button class="tm-sec" data-act="reset">${icon('refresh')}</button></div>`}
      </div>`;
    tick();
    resize();
  }

  // Chrono affiché : on suit l'écran image par image (centièmes fluides), seulement tant qu'il est visible et qu'il tourne
  let raf = null;
  function loop() {
    if (state === 'open' && currentTab === 'timer' && mode === 'sw' && S.running) { tick(); raf = requestAnimationFrame(loop); }
    else raf = null;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  let lastLaps = -1;
  function tick() {
    const ring = $('.tm-ring', body);
    if (!ring) return;
    const fg = $('.fgc', ring), time = $('.tm-time b', body), sub = $('.tm-time span', body), go = $('[data-act="go"]', body);
    if (mode === 'timer') {
      const left = timerLeft();
      const txt = fmtClock(left);
      time.innerHTML = txt;
      fg.setAttribute('stroke-dashoffset', String(C * (1 - (T.duration ? left / T.duration : 0))));
      ring.classList.toggle('done', !!T.done);
      sub.textContent = T.done ? 'Terminé !' : T.running ? `Fin à ${new Date(T.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : left < T.duration ? 'En pause' : `Sur ${fmtClock(T.duration)}`;
      go.innerHTML = T.running ? `${icon('pause2')}Pause` : `${icon('play2')}${left < T.duration && !T.done ? 'Reprendre' : 'Démarrer'}`;
      $$('[data-preset]', body).forEach((b) => b.classList.toggle('on', +b.dataset.preset * 60e3 === T.duration));
    } else {
      const el = swElapsed();
      const full = fmtClock(el, true);
      const cut = full.lastIndexOf('.');
      time.innerHTML = `${full.slice(0, cut)}<small>${full.slice(cut)}</small>`;
      fg.setAttribute('stroke-dashoffset', String(C * (1 - ((el % 60e3) / 60e3))));
      ring.classList.remove('done');
      ring.classList.add('sw');
      sub.textContent = S.running ? 'En cours' : el ? 'En pause' : 'Prêt';
      go.innerHTML = S.running ? `${icon('pause2')}Pause` : `${icon('play2')}${el ? 'Reprendre' : 'Démarrer'}`;
      if (lastLaps !== S.laps.length) renderLaps();
    }
  }

  function renderLaps() {
    lastLaps = S.laps.length;
    const box = $('.tm-laps', body);
    if (!box) return;
    if (!S.laps.length) { box.innerHTML = '<div class="ag-empty">Appuie sur « Tour » pendant que le chrono tourne.</div>'; return; }
    const diffs = S.laps.map((t, i) => t - (S.laps[i - 1] || 0));
    const best = S.laps.length >= 3 ? Math.min(...diffs) : -1, worst = S.laps.length >= 3 ? Math.max(...diffs) : -1;
    box.innerHTML = diffs.map((d, i) => ({ d, i })).reverse().map(({ d, i }) =>
      `<div class="tm-lap ${d === best ? 'best' : d === worst ? 'worst' : ''}"><span>Tour ${i + 1}</span><b>${fmtClock(d, true)}</b><span>${fmtClock(S.laps[i], true)}</span></div>`).join('');
  }

  body.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; lastLaps = -1; render(); animatePane(0); kick(); return; }
    const p = e.target.closest('[data-preset]');
    if (p) {
      T.duration = +p.dataset.preset * 60e3; T.done = false;
      if (T.running) T.endAt = Date.now() + T.duration; else T.remaining = T.duration;
    }
    const a = e.target.closest('[data-add]');
    if (a) {
      const d = +a.dataset.add;
      T.done = false;
      if (T.running) { T.endAt = Math.max(Date.now() + 5e3, T.endAt + d); T.duration = Math.max(10e3, T.duration + d); }
      else { T.duration = Math.max(10e3, T.duration + d); T.remaining = Math.max(10e3, Math.min(T.duration, T.remaining + d)); }
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const k = act.dataset.act;
      if (mode === 'timer') {
        if (k === 'go') {
          if (T.running) { T.remaining = timerLeft(); T.running = false; }
          else { if (T.done || T.remaining <= 0) T.remaining = T.duration; T.done = false; T.endAt = Date.now() + T.remaining; T.running = true; }
        } else if (k === 'reset') { T.running = false; T.done = false; T.remaining = T.duration; }
      } else {
        if (k === 'go') {
          if (S.running) { S.elapsed = swElapsed(); S.running = false; }
          else { S.startAt = Date.now(); S.running = true; }
        } else if (k === 'lap') { if (S.running) S.laps.push(swElapsed()); }
        else if (k === 'reset') { S.running = false; S.elapsed = 0; S.laps = []; }
      }
    }
    if (p || a || act) { saveClock(); tick(); renderChips(); kick(); }
  });

  TABS.timer = {
    show() { if (S.running && !T.running) mode = 'sw'; render(); kick(); },
    tick,
  };
})();

// =====================================================================
// Paramètres
// =====================================================================
(function settingsTab() {
  const body = $('[data-pane="settings"] .set-body');
  const ACCENTS = [
    ['#b5dca5', 'Sauge'], ['#9fe0cf', 'Menthe'], ['#a8d4f0', 'Ciel'], ['#c7b8f5', 'Lavande'],
    ['#f2b5cf', 'Rose'], ['#f2a08a', 'Corail'], ['#f5c2a0', 'Pêche'], ['#e6e39a', 'Citron'],
  ];
  const BGS = [['#1f171b', 'Prune'], ['#1c1d21', 'Graphite'], ['#141826', 'Nuit'], ['#161d19', 'Forêt'], ['#0d0d0f', 'Noir']];
  const TAB_NAMES = { today: "Aujourd'hui", stats: 'Stats', clip: 'Presse-papier', apps: 'Apps', timer: 'Minuteur', wall: "Fond d'écran", power: 'Énergie' };
  let st = null;
  let notifStatus = null;
  const NOTIF_TXT = {
    Allowed: ['ok', 'Accès autorisé'],
    Denied: ['bad', "Windows refuse l'accès aux notifications"],
    Unspecified: ['', 'Windows doit encore donner son accord'],
    off: ['', 'Désactivées'],
  };

  const sw = (on) => `<button class="switch ${on ? 'on' : ''}" role="switch"><i></i></button>`;
  const row = (label, sub, ctl, attrs = '') => `<div class="set-row" ${attrs}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><div class="set-ctl">${ctl}</div></div>`;

  function render() {
    if (!st) { body.innerHTML = '<div class="empty">Chargement…</div>'; return; }
    const u = st.ui;
    const custom = !ACCENTS.some(([c]) => c === u.accent);
    body.innerHTML = `
      <div class="card"><div class="card-label">Apparence</div>
        ${row('Couleur', 'Boutons actifs, onglet, curseurs', ACCENTS.map(([c, n]) => `<button class="swatch ${u.accent === c ? 'on' : ''}" style="background:${c}" title="${n}" data-accent="${c}"></button>`).join('')
          + `<label class="swatch custom ${custom ? 'on' : ''}" title="Couleur perso"><input type="color" value="${esc(u.accent)}" data-accent-custom></label>`)}
        ${row('Fond du panneau', '', BGS.map(([c, n]) => `<button class="swatch ${u.bg === c ? 'on' : ''}" style="background:${c}" title="${n}" data-bg="${c}"></button>`).join(''))}
        ${row('Opacité', `${u.opacity} %`, `<input type="range" class="range" min="70" max="100" step="1" value="${u.opacity}" data-opacity>`)}
      </div>

      <div class="card"><div class="card-label">Pilule</div>
        ${row('Ouvrir le panneau', '', `<div class="seg"><button class="seg-b ${u.openOn === 'click' ? 'active' : ''}" data-open="click">Au clic</button><button class="seg-b ${u.openOn === 'hover' ? 'active' : ''}" data-open="hover">Au survol</button></div>`)}
        ${row('Aperçu quand la musique change', 'La pilule s\'agrandit 4 secondes', sw(u.peek), 'data-toggle="peek"')}
        ${row('Prochain événement dans la pilule', 'Google Agenda · rappel 10 min avant', sw(u.pillEvent), 'data-toggle="pillEvent"')}
        ${row('Position', u.position && u.position !== 'top' ? 'Dans la barre des tâches : aucune fenêtre ne passe dessous' : 'En haut, les fenêtres agrandies passent dessous',
          [['top', 'En haut'], ['tb-left', 'Barre des tâches, à gauche'], ['tb-right', 'À droite']]
            .map(([k, n]) => `<button class="chip ${(u.position || 'top') === k ? 'on' : ''}" data-position="${k}">${n}</button>`).join(''))}
        ${u.position && u.position !== 'top' ? row('Décalage depuis le bord', `${u.offset ?? 12} px`, `<input type="range" class="range" min="0" max="900" step="4" value="${u.offset ?? 12}" data-offset>`) : ''}
        ${row('Écran', (st.screens || []).length > 1 ? '' : 'Un seul écran détecté',
          `<button class="chip ${u.display === 'primary' || !u.display ? 'on' : ''}" data-display="primary">Principal</button>`
          + `<button class="chip ${u.display === 'mouse' ? 'on' : ''}" data-display="mouse">Suit la souris</button>`
          + ((st.screens || []).length > 1 ? st.screens.map((d, i) => `<button class="chip ${u.display === d.id ? 'on' : ''}" data-display="${esc(d.id)}" title="${esc(d.name)}">${icon('screen')} ${i + 1}${d.primary ? '' : ''} · ${esc(d.size)}</button>`).join('') : ''))}
        ${row('Appli de musique', 'Bouton « Ouvrir » quand rien ne joue', st.apps.length
          ? `<button class="chip ${!st.musicApp ? 'on' : ''}" data-music="">Auto</button>` + st.apps.map((a) => `<button class="chip ${st.musicApp === a.key ? 'on' : ''}" data-music="${esc(a.key)}">${esc(a.name)}</button>`).join('')
          : '<small style="color:var(--muted);font-size:11.5px">Ajoute-la d\'abord dans l\'onglet Apps</small>')}
      </div>

      <div class="card"><div class="card-label">Notifications</div>
        ${row('Afficher les notifications Windows', (() => { const k = notifStatus || ''; const t = NOTIF_TXT[k] || (k.startsWith('error') ? ['bad', 'Indisponible sur ce PC'] : ['', 'Vérification…']); return `<span class="set-status ${t[0]}">${u.notifs ? t[1] : 'Désactivées'}</span>`; })(), sw(u.notifs), 'data-toggle="notifs"')}
        ${row('Aussi pendant les jeux', 'Sinon, rien ne s\'affiche en partie', sw(u.notifsInGame), 'data-toggle="notifsInGame"')}
        ${u.notifs && notifStatus && notifStatus !== 'Allowed' ? `<div class="set-help">Pour que le hub puisse lire tes notifications (Discord, mails…), autorise-le dans
          <b>Paramètres Windows → Confidentialité et sécurité → Notifications</b> (« Autoriser les applications à accéder à vos notifications »).
          <br><button class="pill-btn ghost" style="margin-top:8px" data-notif-open>Ouvrir le réglage</button> <button class="pill-btn ghost" style="margin-top:8px" data-notif-retry>Réessayer</button></div>` : ''}
        ${row('Tester', '', '<button class="pill-btn ghost" data-notif-test>Envoyer une notification de test</button>')}
      </div>

      <div class="card"><div class="card-label">Onglets affichés</div>
        <div class="set-ctl" style="justify-content:flex-start;padding:4px 0">${Object.entries(TAB_NAMES).map(([k, n]) => `<button class="chip ${(u.hiddenTabs || []).includes(k) ? '' : 'on'}" data-tabtoggle="${k}">${n}</button>`).join('')}</div>
      </div>

      <div class="card" id="set-cal"><div class="card-label">Google Agenda</div>
        ${st.calConnected
          ? row('Agenda connecté', 'Les événements s\'affichent dans « Aujourd\'hui »', '<button class="pill-btn ghost" data-cal-refresh>Actualiser</button><button class="pill-btn ghost" data-cal-remove>Déconnecter</button>')
          : row('Adresse secrète iCal', '<span class="set-status" data-cal-status></span>', '<input class="set-input" type="password" placeholder="https://calendar.google.com/calendar/ical/…" data-cal-url><button class="pill-btn" data-cal-save>Connecter</button>')
            + `<div class="set-help">Sur ordinateur : <b>Google Agenda</b> → ⚙ <b>Paramètres</b> → clique sur ton agenda à gauche (sous « Paramètres de mes agendas ») →
               <b>Intégrer l'agenda</b> → copie l'<b>Adresse secrète au format iCal</b> et colle-la ici. Elle reste uniquement sur ce PC.</div>`}
      </div>

      <div class="card"><div class="card-label">Système</div>
        ${row('Mode jeu', 'En pleine partie, la pilule laisse passer les clics', sw(st.gameMode), 'data-toggle="gameMode"')}
        ${row('Lancer au démarrage de Windows', '', sw(st.login), 'data-toggle="login"')}
        ${row('Ville pour la météo', st.city ? '' : `Auto${st.autoCity ? ' : ' + esc(st.autoCity) : ''}`, `<input class="set-input" style="width:150px" placeholder="${esc(st.autoCity || 'Ville')}" value="${esc(st.city)}" data-city><button class="pill-btn ghost" data-city-save>OK</button>`)}
        ${row('Historique du presse-papier', 'Les éléments épinglés sont toujours gardés', `<div class="seg">${[25, 50, 100, 200].map((n) => `<button class="seg-b ${st.clipMax === n ? 'active' : ''}" data-clipmax="${n}">${n}</button>`).join('')}</div>`)}
        ${row('Ouvrir / fermer le panneau', 'Marche aussi en jeu', '<span class="kbd">Ctrl</span><span class="kbd">Alt</span><span class="kbd">Espace</span>')}
      </div>`;
    resize();
  }

  async function saveUi(patch) {
    st.ui = { ...st.ui, ...patch };
    applyUi(st.ui);
    await feat('settings:set', { key: 'ui', value: st.ui }).catch(() => {});
  }
  const set = (key, value) => feat('settings:set', { key, value }).catch(() => {});

  body.addEventListener('click', async (e) => {
    const t = e.target;
    let el;
    if ((el = t.closest('[data-accent]'))) { await saveUi({ accent: el.dataset.accent }); render(); }
    else if ((el = t.closest('[data-bg]'))) { await saveUi({ bg: el.dataset.bg }); render(); }
    else if ((el = t.closest('[data-open]'))) { await saveUi({ openOn: el.dataset.open }); render(); }
    else if ((el = t.closest('[data-tabtoggle]'))) {
      const k = el.dataset.tabtoggle;
      const hidden = new Set(st.ui.hiddenTabs || []);
      hidden.has(k) ? hidden.delete(k) : hidden.add(k);
      await saveUi({ hiddenTabs: [...hidden] }); render();
    }
    else if ((el = t.closest('[data-position]'))) { await saveUi({ position: el.dataset.position }); render(); }
    else if ((el = t.closest('[data-display]'))) { await saveUi({ display: el.dataset.display }); render(); }
    else if (t.closest('[data-notif-open]')) { feat('notif:open').catch(() => {}); }
    else if (t.closest('[data-notif-retry]')) { notifStatus = null; render(); notifStatus = await feat('notif:status').catch(() => 'error'); render(); }
    else if (t.closest('[data-notif-test]')) { setState('pill'); setTimeout(() => notify({ app: 'Hub', title: 'Notification de test', body: 'Les notifications de tes applis apparaîtront comme ça.', glyph: 'bell', accent: true }), 500); }
    else if ((el = t.closest('[data-music]'))) { st.musicApp = el.dataset.music; await set('musicApp', st.musicApp); loadMusicApp(); render(); }
    else if ((el = t.closest('[data-clipmax]'))) { st.clipMax = +el.dataset.clipmax; await set('clipMax', st.clipMax); render(); }
    else if ((el = t.closest('[data-toggle]'))) {
      if (!t.closest('.switch')) return;
      const k = el.dataset.toggle;
      if (k === 'peek' || k === 'pillEvent' || k === 'notifs' || k === 'notifsInGame') {
        await saveUi({ [k]: !st.ui[k] });
        if (k === 'notifs') { notifStatus = null; render(); notifStatus = await feat('notif:status').catch(() => 'error'); }
      }
      else { st[k] = !st[k]; await set(k, st[k]); }
      render();
    }
    else if (t.closest('[data-cal-save]')) {
      const input = $('[data-cal-url]', body), status = $('[data-cal-status]', body);
      if (!input.value.trim()) { input.focus(); return; }
      status.className = 'set-status'; status.textContent = 'Connexion…';
      const r = await feat('cal:set', { url: input.value }).catch((er) => ({ ok: false, error: er.message }));
      if (r.ok) { st.calConnected = true; render(); if (TABS.today.refreshCal) TABS.today.refreshCal(); }
      else { status.className = 'set-status bad'; status.textContent = 'Adresse refusée : ' + (r.error || 'erreur'); }
    }
    else if (t.closest('[data-cal-remove]')) { await feat('cal:set', { url: '' }).catch(() => {}); st.calConnected = false; render(); if (TABS.today.refreshCal) TABS.today.refreshCal(); }
    else if (t.closest('[data-cal-refresh]')) { if (TABS.today.refreshCal) TABS.today.refreshCal(); el = t.closest('[data-cal-refresh]'); el.textContent = 'À jour ✓'; }
    else if (t.closest('[data-city-save]')) {
      const input = $('[data-city]', body);
      const r = await feat('today:city', { name: input.value }).catch(() => null);
      if (r && !r.ok) { input.value = ''; input.placeholder = 'Ville introuvable'; return; }
      st.city = input.value.trim(); render();
    }
  });
  // couleur perso et opacité : appliquées en direct pendant qu'on bouge
  let saveT = null;
  body.addEventListener('input', (e) => {
    if (e.target.matches('[data-accent-custom]')) { st.ui.accent = e.target.value; applyUi(st.ui); }
    else if (e.target.matches('[data-opacity]')) {
      st.ui.opacity = +e.target.value; applyUi(st.ui);
      const sub = e.target.closest('.set-row').querySelector('small'); if (sub) sub.textContent = `${st.ui.opacity} %`;
    } else if (e.target.matches('[data-offset]')) {
      st.ui.offset = +e.target.value;
      const sub = e.target.closest('.set-row').querySelector('small'); if (sub) sub.textContent = `${st.ui.offset} px`;
      clearTimeout(saveT);
      saveT = setTimeout(() => set('ui', st.ui), 120); // la pilule se déplace pendant qu'on règle
      return;
    } else return;
    clearTimeout(saveT);
    saveT = setTimeout(() => set('ui', st.ui), 400);
  });
  body.addEventListener('change', (e) => { if (e.target.matches('[data-accent-custom]')) render(); });
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.matches('[data-cal-url]')) $('[data-cal-save]', body).click();
    if (e.target.matches('[data-city]')) $('[data-city-save]', body).click();
  });

  TABS.settings = {
    async show() {
      try { st = await feat('settings:get'); } catch { st = st || null; }
      render();
      if (st && st.ui.notifs) { notifStatus = await feat('notif:status').catch(() => 'error'); render(); }
    },
  };
})();

// icônes des barres d'outils
$$('.pane [data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
