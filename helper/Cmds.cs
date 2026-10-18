// Commandes du moteur compilé : mêmes noms et mêmes réponses que les fonctions PowerShell (src/ps/*.ps1).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;
#if !NOWINRT
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Devices.Radios;
using Windows.Devices.WiFi;
using Windows.Foundation;
using Windows.Networking.Connectivity;
using Windows.Security.Credentials;
#endif

namespace HubHelper {
  public static partial class Cmds {
#if !NOWINRT
    // Attendre un appel asynchrone de Windows (WinRT)
    public static T Await<T>(IAsyncOperation<T> op) { return op.AsTask().GetAwaiter().GetResult(); }
    public static void Await(IAsyncAction op) { op.AsTask().GetAwaiter().GetResult(); }
#endif
    public static object Safe(Func<object> f) { try { return f(); } catch { return null; } }

    public static void Init() {
#if !NOWINRT
      try { Await(Radio.RequestAccessAsync()); } catch { }
#endif
    }

    public static object Dispatch(string name, Args a) {
      switch (name) {
        // ---- système ----
        case "Get-HubState": return HubState();
        case "Set-Radio": return SetRadio(a.S(0), a.B(1));
        case "Set-Volume": HubNative.Audio.SetVolume((float)a.D(0)); return "ok";
        case "Set-Mute": HubNative.Audio.SetMute(a.B(0)); return "ok";
        case "Set-DarkMode": return SetDarkMode(a.B(0));
        case "Set-NightLight": return SetNightLight(a.B(0));
        case "Get-AudioOutputs": return AudioOutputs();
        case "Set-AudioOutput": HubNative.Audio.SetDefault(a.B64(0)); return "ok";
        case "Get-Mixer": return Mixer();
        case "Set-MixerVolume": return HubNative.Mixer.SetVolume(a.B64(0), (float)a.D(1));
        case "Set-MixerMute": return HubNative.Mixer.SetMute(a.B64(0), a.B(1));
        case "Set-MicMute": HubNative.Audio.SetMicMute(a.B(0)); return "ok";
        case "Get-BtDevices": return BtDevices();
        case "Set-BtAudio": { int r = HubNative.Bt.SetAudioConnected(ulong.Parse(a.S(0), CultureInfo.InvariantCulture), a.B(1)); return r == 0 ? "ok" : "err" + r; }
        case "Get-WifiNetworks": return WifiNetworks();
        case "Connect-Wifi": return ConnectWifi(a.B64(0), a.B64(1));
        case "Disconnect-Wifi": return DisconnectWifi();
        case "Get-AppsList": return AppsList();
        case "Get-UwpIcon": return UwpIcon(a.B64(0));
        case "Get-AppIcon": return HubIcons.Shell.IconPng(a.B64(0), 64);
        case "Set-Wallpaper": return HubNative.Win.SetWallpaper(a.B64(0)) ? "ok" : "error";
        case "Get-Wallpaper": return Registry.GetValue(@"HKEY_CURRENT_USER\Control Panel\Desktop", "WallPaper", null) as string;
        case "Invoke-Sleep": System.Windows.Forms.Application.SetSuspendState(System.Windows.Forms.PowerState.Suspend, false, false); return "ok";
        // ---- stats ----
        case "Get-NetBytes": return NetBytes();
        case "Get-Stats": return Stats();
        case "Get-GpuName": return GpuName();
        // ---- musique, jeux, presse-papier, notifications (surveillance) ----
        case "Get-Media": return Watch.MediaCore(true);
        case "Invoke-Media": return Watch.InvokeMedia(a.S(0), a.D(1));
        case "Get-CursorVisible": return HubWatch.Screen.CursorVisible();
        case "Set-WatchMode": return Watch.SetMode(a.S(0));
        case "Force-Emit": return Watch.ForceEmit();
        case "Set-GameLists": return Watch.SetGameLists(a.B64(0), a.B64(1));
        case "Set-Raise": Watch.RaiseHwnd = (long)a.D(0); return "ok";
        case "Set-Notif": return Watch.SetNotif(a.B(0));
        case "Save-ClipImage": return Watch.SaveClipImage(a.B64(0));
        case "Ping": return "pong";
        default: throw new Exception("commande inconnue : " + name);
      }
    }

    // =====================================================================
    // Wi-Fi / Bluetooth (radios)
    // =====================================================================
#if !NOWINRT
    static Dictionary<string, Radio> radios;
    static int radiosAt;
    static Radio GetRadio(string kind) {
      if (radios == null || Math.Abs(Environment.TickCount - radiosAt) > 60000) {
        var d = new Dictionary<string, Radio>();
        foreach (var r in Await(Radio.GetRadiosAsync())) {
          string k = r.Kind.ToString();
          if (!d.ContainsKey(k)) d[k] = r;
        }
        radios = d;
        radiosAt = Environment.TickCount;
      }
      Radio x;
      return radios.TryGetValue(kind, out x) ? x : null;
    }
    static object SetRadio(string kind, bool on) {
      var r = GetRadio(kind);
      if (r == null) return "NoRadio";
      return Await(r.SetStateAsync(on ? RadioState.On : RadioState.Off)).ToString();
    }
    public static string WifiName() {
      foreach (var p in NetworkInformation.GetConnectionProfiles()) {
        if (p.IsWlanConnectionProfile && p.GetNetworkConnectivityLevel() != NetworkConnectivityLevel.None) return p.ProfileName;
      }
      return null;
    }
    static object RadioOn(string kind) {
      var r = GetRadio(kind);
      if (r == null) return null;
      return r.State == RadioState.On;
    }
#else
    static object SetRadio(string kind, bool on) { return "NoRadio"; }
    public static string WifiName() { return null; }
    static object RadioOn(string kind) { return null; }
#endif

    // =====================================================================
    // État complet (tuiles du panneau)
    // =====================================================================
    public static Obj HubState() {
      return new Obj {
        { "wifi", Safe(() => RadioOn("WiFi")) },
        { "wifiName", Safe(() => WifiName()) },
        { "bt", Safe(() => RadioOn("Bluetooth")) },
        { "volume", Safe(() => (int)Math.Round(HubNative.Audio.GetVolume() * 100)) },
        { "mute", Safe(() => HubNative.Audio.GetMute()) },
        { "output", Safe(() => HubNative.Audio.DeviceName()) },
        { "dark", Safe(() => DarkMode()) },
        { "night", Safe(() => NightLight()) },
      };
    }

    // =====================================================================
    // Mode sombre / éclairage nocturne
    // =====================================================================
    const string ThemeKey = @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    static object DarkMode() {
      object v = Registry.GetValue(ThemeKey, "AppsUseLightTheme", null);
      if (v == null) return null;
      return Convert.ToInt32(v, CultureInfo.InvariantCulture) == 0;
    }
    static object SetDarkMode(bool dark) {
      int val = dark ? 0 : 1;
      Registry.SetValue(ThemeKey, "AppsUseLightTheme", val, RegistryValueKind.DWord);
      Registry.SetValue(ThemeKey, "SystemUsesLightTheme", val, RegistryValueKind.DWord);
      HubNative.Win.BroadcastTheme();
      return "ok";
    }

    const string NightKey = @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate";
    static object NightLight() {
      var d = Registry.GetValue(NightKey, "Data", null) as byte[];
      if (d == null || d.Length <= 18) return null;
      return d[18] == 0x15;
    }
    // pas d'API officielle : on modifie l'état enregistré par Windows (format connu : 41 octets éteint, 43 allumé)
    static object SetNightLight(bool on) {
      var d = Registry.GetValue(NightKey, "Data", null) as byte[];
      if (d == null || d.Length <= 24) return "unsupported";
      bool isOn = d[18] == 0x15;
      if (isOn == on) return "ok";
      if (on && d.Length != 41) return "unsupported";
      if (!on && (d.Length != 43 || d[23] != 0x10 || d[24] != 0x00)) return "unsupported";
      var list = new List<byte>(d);
      if (on) { list[18] = 0x15; list.InsertRange(23, new byte[] { 0x10, 0x00 }); }
      else { list[18] = 0x13; list.RemoveRange(23, 2); }
      for (int i = 10; i < 15; i++) {
        if (list[i] != 0xff) { list[i] = (byte)(list[i] + 1); break; }
      }
      Registry.SetValue(NightKey, "Data", list.ToArray(), RegistryValueKind.Binary);
      return "ok";
    }

    // =====================================================================
    // Son : sorties, mélangeur, micro
    // =====================================================================
    static object AudioOutputs() {
      var items = HubNative.Audio.Outputs().Select(e => (object)new Obj { { "id", e.Id }, { "name", e.Name }, { "current", e.IsDefault } }).ToList();
      return new Obj { { "ok", true }, { "items", items } };
    }
    static object Mixer() {
      var apps = HubNative.Mixer.Apps().Select(x => (object)new Obj {
        { "key", x.Key }, { "name", x.Name }, { "path", x.Path }, { "vol", x.Volume }, { "mute", x.Mute }, { "active", x.Active },
      }).ToList();
      object mic = null;
      if (HubNative.Audio.HasMic()) mic = new Obj { { "name", HubNative.Audio.MicName() }, { "mute", Safe(() => HubNative.Audio.GetMicMute()) } };
      return new Obj { { "ok", true }, { "items", apps }, { "mic", mic } };
    }

    // =====================================================================
    // Bluetooth : appareils associés
    // =====================================================================
#if !NOWINRT
    static object BtDevices() {
      var list = new List<Obj>();
      var infos = Await(DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true)));
      foreach (var i in infos) {
        BluetoothDevice d = null;
        try { d = Await(BluetoothDevice.FromIdAsync(i.Id)); } catch { }
        if (d == null) continue;
        string major = null;
        try { major = d.ClassOfDevice.MajorClass.ToString(); } catch { }
        list.Add(new Obj {
          { "addr", d.BluetoothAddress.ToString(CultureInfo.InvariantCulture) },
          { "name", string.IsNullOrEmpty(d.Name) ? i.Name : d.Name },
          { "connected", d.ConnectionStatus == BluetoothConnectionStatus.Connected },
          { "kind", major },
          { "audio", major == "AudioVideo" },
        });
        d.Dispose();
      }
      // appareils « basse énergie » (souris, claviers...) : affichés, connexion gérée par Windows
      try {
        var le = Await(DeviceInformation.FindAllAsync(BluetoothLEDevice.GetDeviceSelectorFromPairingState(true)));
        foreach (var i in le) {
          BluetoothLEDevice d = null;
          try { d = Await(BluetoothLEDevice.FromIdAsync(i.Id)); } catch { }
          if (d == null) continue;
          string name = string.IsNullOrEmpty(d.Name) ? i.Name : d.Name;
          if (list.Any(x => (string)x["name"] == name)) { d.Dispose(); continue; }
          list.Add(new Obj {
            { "addr", d.BluetoothAddress.ToString(CultureInfo.InvariantCulture) }, { "name", name },
            { "connected", d.ConnectionStatus == BluetoothConnectionStatus.Connected }, { "kind", "LowEnergy" }, { "audio", false },
          });
          d.Dispose();
        }
      } catch { }
      var sorted = list.OrderBy(x => !(bool)x["connected"]).ThenBy(x => (string)x["name"] ?? "").Cast<object>().ToList();
      return new Obj { { "ok", true }, { "items", sorted } };
    }
#else
    static object BtDevices() { return new Obj { { "ok", true }, { "items", new List<object>() } }; }
#endif

    // =====================================================================
    // Wi-Fi : réseaux disponibles, connexion
    // =====================================================================
#if !NOWINRT
    static Dictionary<string, WiFiAvailableNetwork> wifiNets = new Dictionary<string, WiFiAvailableNetwork>();
    static WiFiAdapter WifiAdapter() {
      var all = Await(WiFiAdapter.FindAllAdaptersAsync());
      return all.Count > 0 ? all[0] : null;
    }
    static object WifiNetworks() {
      var access = Await(WiFiAdapter.RequestAccessAsync());
      if (access != WiFiAccessStatus.Allowed) return new Obj { { "ok", false }, { "reason", "location" } };
      var a = WifiAdapter();
      if (a == null) return new Obj { { "ok", false }, { "reason", "noadapter" } };
      try { Await(a.ScanAsync()); } catch { }
      string current = null;
      try { current = WifiName(); } catch { }
      var known = KnownWifi();
      var best = new Dictionary<string, WiFiAvailableNetwork>();
      foreach (var n in a.NetworkReport.AvailableNetworks) {
        if (string.IsNullOrEmpty(n.Ssid)) continue;
        WiFiAvailableNetwork b;
        if (!best.TryGetValue(n.Ssid, out b) || b.SignalBars < n.SignalBars) best[n.Ssid] = n;
      }
      wifiNets = best;
      var items = best.Values.Select(n => {
        var auth = n.SecuritySettings.NetworkAuthenticationType.ToString();
        return new Obj {
          { "ssid", n.Ssid }, { "bars", (int)n.SignalBars },
          { "secure", !(auth == "Open80211" || auth == "None") },
          { "known", known.Contains(n.Ssid) }, { "connected", n.Ssid == current },
        };
      }).OrderBy(x => !(bool)x["connected"]).ThenBy(x => !(bool)x["known"]).ThenBy(x => -(int)x["bars"]).Cast<object>().ToList();
      return new Obj { { "ok", true }, { "items", items } };
    }
    static object ConnectWifi(string ssid, string pass) {
      var a = WifiAdapter();
      WiFiAvailableNetwork n;
      if (a == null || !wifiNets.TryGetValue(ssid, out n)) return "notfound";
      WiFiConnectionResult res;
      if (!string.IsNullOrEmpty(pass)) {
        var cred = new PasswordCredential();
        cred.Password = pass;
        res = Await(a.ConnectAsync(n, WiFiReconnectionKind.Automatic, cred));
      } else res = Await(a.ConnectAsync(n, WiFiReconnectionKind.Automatic));
      return res.ConnectionStatus == WiFiConnectionStatus.Success ? "ok" : res.ConnectionStatus.ToString();
    }
    static object DisconnectWifi() {
      var a = WifiAdapter();
      if (a != null) a.Disconnect();
      return "ok";
    }
#else
    static object WifiNetworks() { return new Obj { { "ok", false }, { "reason", "noadapter" } }; }
    static object ConnectWifi(string ssid, string pass) { return "notfound"; }
    static object DisconnectWifi() { return "ok"; }
#endif
    // réseaux déjà enregistrés sur le PC
    static HashSet<string> KnownWifi() {
      var set = new HashSet<string>();
      try {
        var psi = new ProcessStartInfo("netsh", "wlan show profiles") {
          UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true,
          StandardOutputEncoding = Encoding.GetEncoding(CultureInfo.CurrentCulture.TextInfo.OEMCodePage),
        };
        using (var p = Process.Start(psi)) {
          string txt = p.StandardOutput.ReadToEnd();
          p.WaitForExit(5000);
          foreach (var line in txt.Split('\n')) {
            var m = Regex.Match(line.TrimEnd('\r'), @"^\s+[^:]+?\s:\s(.+)$");
            if (m.Success) {
              string n = m.Groups[1].Value.Trim();
              if (n.Length > 0 && !n.StartsWith("<")) set.Add(n);
            }
          }
        }
      } catch { }
      return set;
    }

    // =====================================================================
    // Onglet Apps : applis du menu Démarrer + icônes
    // =====================================================================
    static readonly Regex SkipApp = new Regex(@"uninstall|désinstaller|readme|lisez-moi|documentation|help|aide$|website|site web|release notes", RegexOptions.IgnoreCase);
    static object AppsList() {
      var items = new List<Obj>();
      var t = Type.GetTypeFromProgID("Shell.Application");
      dynamic sh = Activator.CreateInstance(t);
      try {
        dynamic folder = sh.NameSpace("shell:AppsFolder");
        foreach (dynamic it in folder.Items()) {
          string name = it.Name;
          string id = it.Path;
          if (string.IsNullOrEmpty(name) || SkipApp.IsMatch(name)) continue;
          items.Add(new Obj { { "name", name }, { "id", id } });
        }
      } finally { System.Runtime.InteropServices.Marshal.ReleaseComObject(sh); }
      var sorted = items.OrderBy(x => (string)x["name"], StringComparer.CurrentCultureIgnoreCase).Cast<object>().ToList();
      return new Obj { { "ok", true }, { "items", sorted } };
    }

    // Icône d'une appli du Microsoft Store (logo déclaré dans son manifeste)
    static Dictionary<string, string> appxByFamily;
    static object UwpIcon(string id) {
      string[] parts = id.Split(new[] { '!' }, 2);
      if (appxByFamily == null) {
        appxByFamily = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
#if !NOWINRT
        try {
          var pm = new Windows.Management.Deployment.PackageManager();
          foreach (var p in pm.FindPackagesForUser(string.Empty)) {
            try { appxByFamily[p.Id.FamilyName] = p.InstalledLocation.Path; } catch { }
          }
        } catch (Exception e) { Program.Log("applis du Store : " + e.Message); }
#endif
      }
      string dir;
      if (!appxByFamily.TryGetValue(parts[0], out dir) || string.IsNullOrEmpty(dir)) return null;
      var xml = new System.Xml.XmlDocument();
      xml.Load(Path.Combine(dir, "AppxManifest.xml"));
      var apps = xml.SelectNodes("//*[local-name()='Application']");
      System.Xml.XmlNode app = null;
      foreach (System.Xml.XmlNode n in apps) {
        if (app == null) app = n;
        if (parts.Length > 1 && n.Attributes != null && n.Attributes["Id"] != null && n.Attributes["Id"].Value == parts[1]) { app = n; break; }
      }
      string logo = null;
      if (app != null) {
        var ve = app.SelectSingleNode("*[local-name()='VisualElements']");
        if (ve != null && ve.Attributes != null) {
          foreach (var attr in new[] { "Square44x44Logo", "Square150x150Logo", "Logo" }) {
            if (ve.Attributes[attr] != null) { logo = ve.Attributes[attr].Value; break; }
          }
        }
      }
      if (logo == null) {
        var l = xml.SelectSingleNode("//*[local-name()='Properties']/*[local-name()='Logo']");
        if (l != null) logo = l.InnerText;
      }
      if (string.IsNullOrEmpty(logo)) return null;
      string full = Path.Combine(dir, logo);
      string folder = Path.GetDirectoryName(full);
      string bas = Path.GetFileNameWithoutExtension(full);
      string ext = Path.GetExtension(full);
      string pick = null;
      if (Directory.Exists(folder)) {
        // Windows range plusieurs tailles du logo : on prend celle qui ressemble à l'icône de la barre des tâches
        Func<string, int> rank = f => {
          string n = Path.GetFileName(f).ToLowerInvariant();
          if (n.Contains("targetsize-48_altform-unplated")) return 0;
          if (n.Contains("targetsize-48")) return 1;
          if (n.Contains("targetsize-64_altform-unplated")) return 2;
          if (n.Contains("targetsize-32")) return 3;
          if (n.Contains("scale-200")) return 4;
          if (n.Contains("scale-100")) return 5;
          return 6;
        };
        pick = Directory.GetFiles(folder, bas + "*" + ext).Where(f => !Path.GetFileName(f).ToLowerInvariant().Contains("contrast")).OrderBy(rank).FirstOrDefault();
      }
      if (pick == null && File.Exists(full)) pick = full;
      if (pick == null) return null;
      return "data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(pick));
    }

    // =====================================================================
    // Stats : réseau, GPU
    // =====================================================================
    static Obj NetBytes() {
      long rx = 0, tx = 0;
      foreach (var n in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()) {
        if (n.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
        var t = n.NetworkInterfaceType;
        if (t == System.Net.NetworkInformation.NetworkInterfaceType.Loopback || t == System.Net.NetworkInformation.NetworkInterfaceType.Tunnel) continue;
        if (Regex.IsMatch(n.Description ?? "", "Hyper-V|Virtual|VMware|VirtualBox|Loopback|WAN Miniport")) continue;
        try { var s = n.GetIPStatistics(); rx += s.BytesReceived; tx += s.BytesSent; } catch { }
      }
      return new Obj { { "rx", rx }, { "tx", tx } };
    }
    static object Stats() {
      var n = NetBytes();
      double g = -1;
      try { g = HubPdh.Gpu.Load(); } catch { }
      n["gpu"] = g >= 0 ? (object)(int)Math.Round(g) : null;
      return n;
    }
    static object GpuName() {
#if !NOWINRT
      using (var s = new System.Management.ManagementObjectSearcher("SELECT Name FROM Win32_VideoController")) {
        foreach (System.Management.ManagementObject o in s.Get()) {
          string n = o["Name"] as string;
          if (n != null && !Regex.IsMatch(n, "Basic|Virtual|Parsec|Remote")) return n;
        }
      }
#endif
      return null;
    }
  }
}
