// Lecture d'un agenda au format iCal (adresse secrète Google Agenda) + calcul des événements répétés.
const DAY = 864e5;
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unfold(text) { return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); }
const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// "20261017" (journée entière), "20261017T180000Z" (UTC), "20261017T180000" (heure locale)
function parseDate(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || /VALUE=DATE(?!-)/i.test(params || '')) return { t: new Date(+y, mo - 1, +d).getTime(), allDay: true };
  if (z) return { t: Date.UTC(+y, mo - 1, +d, +h, +mi, +s), allDay: false };
  return { t: new Date(+y, mo - 1, +d, +h, +mi, +s).getTime(), allDay: false };
}

function parseDuration(v) {
  const m = (v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * DAY) + ((+m[3] || 0) * DAY) + ((+m[4] || 0) * 3600e3) + ((+m[5] || 0) * 60e3) + ((+m[6] || 0) * 1e3);
  return m[1] === '-' ? -ms : ms;
}

function parseEvents(text) {
  const lines = unfold(text);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...params] = head.split(';');
    const p = params.join(';');
    switch (name.toUpperCase()) {
      case 'DTSTART': cur.start = parseDate(value, p); break;
      case 'DTEND': cur.end = parseDate(value, p); break;
      case 'DURATION': cur.duration = parseDuration(value); break;
      case 'SUMMARY': cur.title = unescape(value); break;
      case 'LOCATION': cur.location = unescape(value); break;
      case 'UID': cur.uid = value; break;
      case 'STATUS': cur.status = value.toUpperCase(); break;
      case 'RRULE': cur.rrule = Object.fromEntries(value.split(';').map((kv) => kv.split('='))); break;
      case 'EXDATE': value.split(',').forEach((v) => { const d = parseDate(v, p); if (d) cur.exdates.push(d.t); }); break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDate(value, p); break;
    }
  }
  return events;
}

function nthWeekday(y, m, wd, n) {
  if (n > 0) {
    const first = new Date(y, m, 1).getDay();
    const day = 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
    return day <= new Date(y, m + 1, 0).getDate() ? day : null;
  }
  const last = new Date(y, m + 1, 0);
  const day = last.getDate() - ((last.getDay() - wd + 7) % 7) + (n + 1) * 7;
  return day >= 1 ? day : null;
}

// Toutes les dates de début d'un événement répété (bornées à [from, to])
function expand(ev, from, to) {
  const start = ev.start.t;
  const r = ev.rrule;
  if (!r) return [start];
  const freq = (r.FREQ || '').toUpperCase();
  const interval = Math.max(1, +r.INTERVAL || 1);
  const count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? (parseDate(r.UNTIL) || {}).t : Infinity;
  const s = new Date(start);
  const hh = s.getHours(), mm = s.getMinutes(), ss = s.getSeconds();
  const out = [];
  let n = 0;
  const push = (t) => {
    if (t < start) return true;
    if (t > until || n >= count) return false;
    n++;
    if (t >= from - DAY * 40 && t <= to) out.push(t);
    return t <= to;
  };
  const byday = (r.BYDAY || '').split(',').filter(Boolean).map((x) => { const m = x.match(/^([+-]?\d+)?(\w\w)$/); return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2]] } : null; }).filter(Boolean);
  const bymonthday = (r.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
  for (let i = 0; i < 3000; i++) {
    if (freq === 'DAILY') {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i * interval, hh, mm, ss);
      if (!push(d.getTime())) break;
    } else if (freq === 'WEEKLY') {
      const days = byday.length ? byday.map((b) => b.wd) : [s.getDay()];
      const weekStart = new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7) + i * 7 * interval);
      let go = true;
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + ((wd + 6) % 7), hh, mm, ss);
        if (!push(d.getTime())) { go = false; break; }
      }
      if (!go) break;
    } else if (freq === 'MONTHLY') {
      const y = s.getFullYear(), m = s.getMonth() + i * interval;
      let days = [];
      if (byday.length) days = byday.map((b) => nthWeekday(y, m, b.wd, b.n || 1));
      else if (bymonthday.length) days = bymonthday.map((d) => (d > 0 ? d : new Date(y, m + 1, 0).getDate() + d + 1));
      else days = [s.getDate()];
      let go = true;
      for (const day of days.filter((d) => d && d <= new Date(y, m + 1, 0).getDate()).sort((a, b) => a - b)) {
        if (!push(new Date(y, m, day, hh, mm, ss).getTime())) { go = false; break; }
      }
      if (!go) break;
    } else if (freq === 'YEARLY') {
      const d = new Date(s.getFullYear() + i * interval, s.getMonth(), s.getDate(), hh, mm, ss);
      if (d.getDate() !== s.getDate()) continue; // 29 février
      if (!push(d.getTime())) break;
    } else break;
  }
  return out;
}

// Liste des événements entre from et to : [{ start, end, allDay, title, location }]
function eventsBetween(text, from, to) {
  const all = parseEvents(text).filter((e) => e.status !== 'CANCELLED');
  // occurrences modifiées individuellement : elles remplacent l'occurrence d'origine
  const overrides = new Map();
  for (const e of all) if (e.recurrenceId) {
    if (!overrides.has(e.uid)) overrides.set(e.uid, new Set());
    overrides.get(e.uid).add(e.recurrenceId.t);
  }
  const out = [];
  for (const e of all) {
    const dur = e.end ? e.end.t - e.start.t : e.duration || (e.start.allDay ? DAY : 0);
    const skip = new Set([...e.exdates, ...(e.recurrenceId ? [] : overrides.get(e.uid) || [])]);
    for (const t of e.recurrenceId ? [e.start.t] : expand(e, from, to)) {
      if (skip.has(t)) continue;
      if (t + Math.max(dur, 1) < from || t > to) continue;
      out.push({ start: t, end: t + dur, allDay: e.start.allDay, title: e.title || '(Sans titre)', location: e.location || '' });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

module.exports = { eventsBetween };
