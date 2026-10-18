// Surveillance (mode main) : envoie au hub UNIQUEMENT ce qui change.
// Même logique que src/ps/watch.ps1 ; les intervalles s'allongent quand le panneau est fermé ou en jeu.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32;
#if !NOWINRT
using Windows.Media.Control;
using Windows.Storage.Streams;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;
#endif

namespace HubHelper {
  public static class Watch {
    static readonly Stopwatch SW = Stopwatch.StartNew();
    static long Now { get { return SW.ElapsedMilliseconds; } }

    static string mode = "closed";
    static string sysSig = "", mediaSig = "", fsSig = null;
    static uint clipSeq = 0;
    static double? est = null;
    static long estAt = 0;
    static int errors = 0;
    public static long RaiseHwnd = 0;
    public static int Wait = 300;

    // en millisecondes : media, sys, fs (jeux), clip, notif
    static readonly Dictionary<string, int[]> Intervals = new Dictionary<string, int[]> {
      { "open",   new[] { 300, 500, 1000, 500, 1500 } },
      { "closed", new[] { 400, 2000, 1000, 700, 1500 } },
      { "game",   new[] { 1500, 8000, 400, 2500, 4000 } },
    };
    static readonly long[] next = new long[5];
    const int MEDIA = 0, SYS = 1, FS = 2, CLIP = 3, NOTIF = 4;

    public static void Init() {
#if !NOWINRT
      try { mediaMgr = Cmds.Await(GlobalSystemMediaTransportControlsSessionManager.RequestAsync()); }
      catch (Exception e) { Program.Log("musique : " + e.Message); }
#endif
    }

    public static object SetMode(string m) {
      if (Intervals.ContainsKey(m)) { mode = m; next[SYS] = 0; next[MEDIA] = 0; }
      return "ok";
    }
    public static object ForceEmit() {
      sysSig = ""; mediaSig = ""; fsSig = null;
      next[SYS] = 0; next[MEDIA] = 0; next[FS] = 0;
      return "ok";
    }

    static void Err(string what, Exception e) {
      errors++;
      if (errors <= 5) Program.Log(what + " : " + e.Message);
    }

    public static void Tick() {
      var iv = Intervals[mode];
      long now = Now;
      if (now >= next[MEDIA]) { try { WatchMedia(); } catch (Exception e) { Err("musique", e); } next[MEDIA] = Now + iv[MEDIA]; }
      if (now >= next[FS]) {
        try { WatchFs(); } catch (Exception e) { Err("plein écran", e); }
        if (RaiseHwnd != 0 && mode != "game") { try { HubNative.Win.Raise(RaiseHwnd); } catch { } }
        next[FS] = now + iv[FS];
      }
      if (now >= next[CLIP]) { try { WatchClip(); } catch (Exception e) { Err("presse-papier", e); } next[CLIP] = now + iv[CLIP]; }
      if (now >= next[SYS]) { try { WatchSys(); } catch (Exception e) { Err("système", e); } next[SYS] = Now + iv[SYS]; }
      if (now >= next[NOTIF]) { try { WatchNotif(); } catch (Exception e) { Err("notifications", e); } next[NOTIF] = Now + iv[NOTIF]; }
      long soonest = next.Min();
      Wait = (int)Math.Max(25, Math.Min(2000, soonest - Now));
    }

    // =====================================================================
    // Musique (contrôles média de Windows)
    // =====================================================================
#if !NOWINRT
    static GlobalSystemMediaTransportControlsSessionManager mediaMgr;
#endif
    static string thumbKey = null;
    static int thumbTries = 0;

    public static Obj MediaCore(bool withFs) {
#if !NOWINRT
      var s = mediaMgr != null ? mediaMgr.GetCurrentSession() : null;
      if (s == null) {
        bool changed = thumbKey != null;
        thumbKey = null;
        return new Obj { { "active", false }, { "thumbChanged", changed }, { "thumb", null } };
      }
      var p = Cmds.Await(s.TryGetMediaPropertiesAsync());
      var t = s.GetTimelineProperties();
      var pb = s.GetPlaybackInfo();
      string artist = string.IsNullOrEmpty(p.Artist) ? p.AlbumArtist : p.Artist;
      var o = new Obj {
        { "active", true },
        { "title", p.Title },
        { "artist", artist },
        { "app", s.SourceAppUserModelId },
        { "status", pb.PlaybackStatus.ToString() },
        { "position", (long)Math.Round(t.Position.TotalMilliseconds) },
        { "duration", (long)Math.Round((t.EndTime - t.StartTime).TotalMilliseconds) },
        { "updated", t.LastUpdatedTime.ToUnixTimeMilliseconds() },
        { "now", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() },
        { "thumbChanged", false },
      };
      // la pochette n'est envoyée que quand le morceau change (Spotify la publie parfois un peu après le titre)
      string key = p.Title + "|" + artist;
      if (key != thumbKey) {
        thumbKey = key; thumbTries = 0;
        o["thumbChanged"] = true;
        o["thumb"] = null;
      }
      if (thumbTries >= 0 && thumbTries < 12) {
        thumbTries++;
        if (p.Thumbnail != null) {
          string img = null;
          try { img = ReadThumb(p.Thumbnail); } catch (Exception e) { if (thumbTries == 1) Program.Log("pochette Windows illisible : " + e.Message); }
          if (img != null) { o["thumb"] = img; o["thumbChanged"] = true; thumbTries = -1; }
        }
      }
      if (withFs) o["fs"] = Cmds.Safe(() => HubWatch.Screen.FullscreenApp());
      return o;
#else
      return new Obj { { "active", false }, { "thumbChanged", false }, { "thumb", null } };
#endif
    }

#if !NOWINRT
    public static string ReadThumb(IRandomAccessStreamReference r) {
      using (var st = Cmds.Await(r.OpenReadAsync())) {
        string type = string.IsNullOrEmpty(st.ContentType) ? "image/jpeg" : st.ContentType;
        using (var net = st.AsStreamForRead())
        using (var ms = new MemoryStream()) {
          net.CopyTo(ms);
          if (ms.Length == 0) return null;
          return "data:" + type + ";base64," + Convert.ToBase64String(ms.ToArray());
        }
      }
    }
#endif

    public static object InvokeMedia(string cmd, double arg) {
#if !NOWINRT
      var s = mediaMgr != null ? mediaMgr.GetCurrentSession() : null;
      if (s == null) return false;
      switch (cmd) {
        case "toggle": return Cmds.Await(s.TryTogglePlayPauseAsync());
        case "next": return Cmds.Await(s.TrySkipNextAsync());
        case "prev": return Cmds.Await(s.TrySkipPreviousAsync());
        case "seek": return Cmds.Await(s.TryChangePlaybackPositionAsync((long)(arg * 10000)));
      }
#endif
      return false;
    }

    static void WatchMedia() {
      var m = MediaCore(false);
      long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
      bool active = (bool)m["active"];
      object v;
      string status = m.TryGetValue("status", out v) ? (string)v : null;
      string sig = active + "|" + Get(m, "title") + "|" + Get(m, "artist") + "|" + status + "|" + Get(m, "duration") + "|" + Get(m, "app");
      // position estimée maintenant : sert à repérer un saut (quand tu avances dans le morceau)
      double? e = null;
      if (active) {
        double pos = Convert.ToDouble(m["position"]);
        long updated = Convert.ToInt64(m["updated"]);
        if (status == "Playing" && updated > 0 && now - updated < 21600000) pos += now - updated;
        e = pos;
      }
      bool jump = false;
      if (e.HasValue && est.HasValue) {
        double pred = est.Value;
        if (status == "Playing") pred += now - estAt;
        if (Math.Abs(e.Value - pred) > 2500) jump = true;
      }
      est = e; estAt = now;
      if (sig != mediaSig || (bool)m["thumbChanged"] || jump) {
        mediaSig = sig;
        var ev = new Obj { { "type", "media" } };
        foreach (var kv in m) ev[kv.Key] = kv.Value;
        Program.Event(ev);
      }
    }
    static string Get(Obj o, string k) { object v; return o.TryGetValue(k, out v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : ""; }

    // =====================================================================
    // État système (Wi-Fi, volume, thème...)
    // =====================================================================
    static void WatchSys() {
      string j = Json.Write(Cmds.HubState());
      if (j != sysSig) {
        sysSig = j;
        Program.Emit("@E {\"type\":\"sys\",\"data\":" + j + "}");
      }
    }

    // =====================================================================
    // Jeux : détection par le programme au premier plan (pas juste le plein écran)
    // =====================================================================
    static readonly string[] GameDirs = { @"\steamapps\common\", @"\riot games\", @"\epic games\", @"\xboxgames\", @"\ea games\", @"\ubisoft game launcher\games\",
      @"\gog galaxy\games\", @"\gog games\", @"\rockstar games\", @"\battle.net\games\", @"\roblox\versions\", @"\windowsapps\microsoft.minecraft" };
    static readonly HashSet<string> KnownGames = new HashSet<string> { "valorant-win64-shipping.exe", "robloxplayerbeta.exe", "minecraft.windows.exe", "league of legends.exe", "r5apex.exe",
      "cs2.exe", "fortniteclient-win64-shipping.exe", "overwatch.exe", "rocketleague.exe", "gta5.exe", "eldenring.exe" };
    static readonly Regex NeverGames = new Regex(@"^(chrome|msedge|firefox|opera|opera_gx|brave|vivaldi|arc|discord|obs64|obs32|spotify|deezer|explorer|code|devenv|steam|steamwebhelper|epicgameslauncher|battle\.net|eadesktop|origin|upc|ubisoftconnect|galaxyclient|robloxstudiobeta|riotclient.*|leagueclient.*|vgtray|crashreport.*|unitycrashhandler.*|electron|hub|hubhelper|vlc|mpc-hc.*|powerpnt|winword|excel|figma|photoshop|premiere.*|afterfx|resolve|blender)\.exe$", RegexOptions.Compiled);
    static readonly HashSet<string> gameExtra = new HashSet<string>();
    static readonly HashSet<string> gameNever = new HashSet<string>();
    static readonly Dictionary<string, bool> gameCache = new Dictionary<string, bool>();
    static HashSet<string> gameStore = new HashSet<string>();
    static long gameStoreAt = -999999;

    // jeux que Windows a lui-même reconnus (Game Bar / mode Jeu)
    static void LoadGameStore() {
      var set = new HashSet<string>();
      try {
        using (var root = Registry.CurrentUser.OpenSubKey(@"System\GameConfigStore\Children")) {
          if (root != null) {
            foreach (var n in root.GetSubKeyNames()) {
              using (var k = root.OpenSubKey(n)) {
                var p = k == null ? null : k.GetValue("MatchedExeFullPath") as string;
                if (!string.IsNullOrEmpty(p)) set.Add(p.ToLowerInvariant());
              }
            }
          }
        }
      } catch { }
      gameStore = set;
      gameStoreAt = Now;
      gameCache.Clear();
    }

    public static object SetGameLists(string yes, string no) {
      gameExtra.Clear(); gameNever.Clear();
      foreach (var n in yes.Split('|')) if (n.Length > 0) gameExtra.Add(n.ToLowerInvariant());
      foreach (var n in no.Split('|')) if (n.Length > 0) gameNever.Add(n.ToLowerInvariant());
      fsSig = null;
      return "ok";
    }

    static string ExeName(string path) { return path.Substring(path.LastIndexOfAny(new[] { '\\', '/' }) + 1); }

    static bool IsGameExe(string path) {
      string p = path.ToLowerInvariant();
      string name = ExeName(p);
      if (gameNever.Contains(name)) return false;
      if (gameExtra.Contains(name)) return true;
      bool r;
      if (gameCache.TryGetValue(p, out r)) return r;
      if (NeverGames.IsMatch(name)) r = false;
      else if (KnownGames.Contains(name)) r = true;
      else if (gameStore.Contains(p)) r = true;
      else r = GameDirs.Any(d => p.Contains(d));
      gameCache[p] = r;
      return r;
    }

    static void WatchFs() {
      if (Now - gameStoreAt > 600000) LoadGameStore();
      string exe = HubWatch.Screen.ForegroundExe();
      bool game = exe != null && IsGameExe(exe);
      string name = exe != null ? ExeName(exe) : "";
      // jeu en plein écran exclusif pas reconnu autrement (sauf si tu as dit que ce n'est pas un jeu)
      if (!game && !gameNever.Contains(name.ToLowerInvariant()) && HubWatch.Screen.NotificationState() == 3) game = true;
      bool cursor = true;
      if (game) { try { cursor = HubWatch.Screen.CursorVisible(); } catch { cursor = false; } }
      string sig = game + "|" + name + "|" + cursor;
      if (sig != fsSig) {
        fsSig = sig;
        Program.Event(new Obj { { "type", "game" }, { "game", game }, { "exe", name }, { "cursor", cursor } });
      }
    }

    // =====================================================================
    // Presse-papier : Windows incrémente un compteur à chaque copie ; on lit le texte ici
    // =====================================================================
    static void WatchClip() {
      uint q = HubNative.Win.ClipboardSeq();
      if (q == clipSeq) return;
      bool first = clipSeq == 0;
      clipSeq = q;
      if (first) return;
      Thread.Sleep(40); // laisse à l'appli le temps de finir de copier
      var r = new Obj { { "type", "clip" }, { "text", null }, { "img", false }, { "err", null } };
      for (int i = 0; i < 4; i++) {
        try {
          if (System.Windows.Forms.Clipboard.ContainsText()) {
            string t = System.Windows.Forms.Clipboard.GetText();
            if (t.Length > 20000) t = t.Substring(0, 20000);
            r["text"] = t;
          } else if (System.Windows.Forms.Clipboard.ContainsImage()) r["img"] = true;
          r["err"] = null;
          break;
        } catch (Exception e) { r["err"] = e.Message; Thread.Sleep(80); }
      }
      Program.Event(r);
    }

    public static object SaveClipImage(string path) {
      using (var img = System.Windows.Forms.Clipboard.GetImage()) {
        if (img == null) return false;
        img.Save(path, System.Drawing.Imaging.ImageFormat.Png);
      }
      return true;
    }

    // =====================================================================
    // Notifications Windows (Discord, mails...)
    // =====================================================================
    static bool notifOn = false, notifFirst = true;
    static string notifStatus = "off";
    static readonly HashSet<uint> seen = new HashSet<uint>();
    static readonly Dictionary<string, string> notifIcons = new Dictionary<string, string>();
#if !NOWINRT
    static UserNotificationListener listener;
#endif

    public static object SetNotif(bool on) {
      notifOn = on;
      if (!on) return "off";
#if !NOWINRT
      if (notifStatus != "Allowed") {
        try {
          listener = UserNotificationListener.Current;
          notifStatus = Cmds.Await(listener.RequestAccessAsync()).ToString();
          notifFirst = true;
        } catch (Exception e) { notifStatus = "error: " + e.Message; }
      }
#endif
      return notifStatus;
    }

    static void WatchNotif() {
#if !NOWINRT
      if (!notifOn || notifStatus != "Allowed" || listener == null) return;
      var list = Cmds.Await(listener.GetNotificationsAsync(NotificationKinds.Toast));
      bool first = notifFirst;
      notifFirst = false;
      if (seen.Count > 3000) { seen.Clear(); first = true; }
      foreach (var n in list) {
        if (!seen.Add(n.Id)) continue;
        if (first) continue; // au démarrage : on ignore celles déjà présentes
        var texts = new List<string>();
        try {
          var b = n.Notification.Visual.GetBinding(KnownNotificationBindings.ToastGeneric);
          if (b != null) foreach (var t in b.GetTextElements()) if (!string.IsNullOrEmpty(t.Text)) texts.Add(t.Text);
        } catch { }
        string app = null, key = null;
        try { app = n.AppInfo.DisplayInfo.DisplayName; } catch { }
        try { key = n.AppInfo.AppUserModelId; } catch { }
        if (string.IsNullOrEmpty(key)) key = app;
        string icon = null;
        if (!string.IsNullOrEmpty(key)) {
          if (!notifIcons.TryGetValue(key, out icon)) {
            try { icon = ReadThumb(n.AppInfo.DisplayInfo.GetLogo(new Windows.Foundation.Size(48, 48))); } catch { icon = null; }
            notifIcons[key] = icon;
          }
        }
        Program.Event(new Obj {
          { "type", "notif" }, { "app", app },
          { "title", texts.Count > 0 ? texts[0] : app },
          { "body", string.Join(" · ", texts.Skip(1)) },
          { "icon", icon },
        });
      }
#endif
    }
  }
}
