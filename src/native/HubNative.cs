using System;
using System.Runtime.InteropServices;

namespace HubNative {
  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr p);
    int UnregisterControlChangeNotify(IntPtr p);
    int GetChannelCount(out uint c);
    int SetMasterVolumeLevel(float level, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    int GetMasterVolumeLevel(out float level);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint ch, float level, ref Guid ctx);
    int SetChannelVolumeLevelScalar(uint ch, float level, ref Guid ctx);
    int GetChannelVolumeLevel(uint ch, out float level);
    int GetChannelVolumeLevelScalar(uint ch, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }

  [StructLayout(LayoutKind.Sequential)]
  struct PROPERTYKEY { public Guid fmtid; public int pid; }

  [StructLayout(LayoutKind.Explicit, Size = 24)]
  struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr ptr; }

  [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out int count);
    int GetAt(int index, out PROPERTYKEY key);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    int OpenPropertyStore(int access, out IPropertyStore store);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  }

  [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    int GetCount(out uint count);
    int Item(uint index, out IMMDevice device);
  }

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumerator { }

  // Interface non documentée (utilisée par SoundSwitch & co) pour changer la sortie par défaut.
  [Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPolicyConfig {
    int GetMixFormat(); int GetDeviceFormat(); int ResetDeviceFormat(); int SetDeviceFormat();
    int GetProcessingPeriod(); int SetProcessingPeriod(); int GetShareMode(); int SetShareMode();
    int GetPropertyValue(); int SetPropertyValue();
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
  }

  [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
  class CPolicyConfigClient { }

  public class Endpoint {
    public string Id { get; set; }
    public string Name { get; set; }
    public bool IsDefault { get; set; }
  }

  public static class Audio {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT pv);

    static string NameOf(IMMDevice d) {
      try {
        IPropertyStore s;
        Marshal.ThrowExceptionForHR(d.OpenPropertyStore(0, out s));
        PROPERTYKEY k = new PROPERTYKEY();
        k.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0");
        k.pid = 14;
        PROPVARIANT pv;
        Marshal.ThrowExceptionForHR(s.GetValue(ref k, out pv));
        string r = null;
        if (pv.vt == 31 && pv.ptr != IntPtr.Zero) r = Marshal.PtrToStringUni(pv.ptr);
        PropVariantClear(ref pv);
        return r;
      } catch { return null; }
    }

    public static Endpoint[] Outputs() {
      var e = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      string defId = null;
      try { IMMDevice def; if (e.GetDefaultAudioEndpoint(0, 1, out def) == 0) def.GetId(out defId); } catch { }
      IMMDeviceCollection col;
      Marshal.ThrowExceptionForHR(e.EnumAudioEndpoints(0, 1, out col));
      uint n; col.GetCount(out n);
      var list = new System.Collections.Generic.List<Endpoint>();
      for (uint i = 0; i < n; i++) {
        IMMDevice d; if (col.Item(i, out d) != 0) continue;
        string id; d.GetId(out id);
        list.Add(new Endpoint { Id = id, Name = NameOf(d) ?? id, IsDefault = id == defId });
      }
      return list.ToArray();
    }

    public static void SetDefault(string id) {
      var pc = (IPolicyConfig)(new CPolicyConfigClient());
      for (int role = 0; role < 3; role++) Marshal.ThrowExceptionForHR(pc.SetDefaultEndpoint(id, role));
    }

    // flow : 0 = sortie (haut-parleurs), 1 = entrée (micro)
    internal static IMMDevice Device(int flow = 0) {
      var e = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      IMMDevice d;
      Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(flow, 1, out d));
      return d;
    }
    static IAudioEndpointVolume Vol(int flow = 0) {
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      Marshal.ThrowExceptionForHR(Device(flow).Activate(ref iid, 23, IntPtr.Zero, out o));
      return (IAudioEndpointVolume)o;
    }
    // ---- Micro (entrée par défaut) ----
    public static bool HasMic() { try { Device(1); return true; } catch { return false; } }
    public static bool GetMicMute() { bool m; Marshal.ThrowExceptionForHR(Vol(1).GetMute(out m)); return m; }
    public static void SetMicMute(bool m) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol(1).SetMute(m, ref g)); }
    public static string MicName() { try { return NameOf(Device(1)); } catch { return null; } }
    public static float GetVolume() { float v; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    public static void SetVolume(float v) {
      Guid g = Guid.Empty;
      v = Math.Max(0f, Math.Min(1f, v));
      Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(v, ref g));
    }
    public static bool GetMute() { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
    public static void SetMute(bool m) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol().SetMute(m, ref g)); }
    public static string DeviceName() {
      try { return NameOf(Device()); } catch { return null; }
    }
  }

  // ---------------------------------------------------------------------------
  // Mélangeur : volume de chaque appli (comme le « Mélangeur de volume » de Windows)
  // ---------------------------------------------------------------------------
  [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr guid, int flags, out IntPtr ctl);
    int GetSimpleAudioVolume(IntPtr guid, int flags, out IntPtr vol);
    int GetSessionEnumerator(out IAudioSessionEnumerator e);
  }
  [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    int GetCount(out int count);
    int GetSession(int index, out IAudioSessionControl2 session);
  }
  [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out int state);
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid ctx);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
    int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid ctx);
    int GetGroupingParam(out Guid g);
    int SetGroupingParam(ref Guid g, ref Guid ctx);
    int RegisterAudioSessionNotification(IntPtr n);
    int UnregisterAudioSessionNotification(IntPtr n);
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetProcessId(out uint pid);
    [PreserveSig] int IsSystemSoundsSession();
    int SetDuckingPreference(bool optOut);
  }
  [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume {
    int SetMasterVolume(float level, ref Guid ctx);
    int GetMasterVolume(out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }

  public class MixApp {
    public string Key { get; set; }      // chemin du programme en minuscules, ou "system"
    public string Name { get; set; }
    public string Path { get; set; }
    public int Volume { get; set; }      // 0..100
    public bool Mute { get; set; }
    public bool Active { get; set; }     // joue du son en ce moment
  }

  public static class Mixer {
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, System.Text.StringBuilder sb, ref int size);

    static string ExePath(uint pid) {
      IntPtr p = OpenProcess(0x1000, false, pid);
      if (p == IntPtr.Zero) return null;
      try { var sb = new System.Text.StringBuilder(1024); int n = sb.Capacity; return QueryFullProcessImageName(p, 0, sb, ref n) ? sb.ToString() : null; }
      finally { CloseHandle(p); }
    }
    static readonly System.Collections.Generic.Dictionary<string, string> nameCache = new System.Collections.Generic.Dictionary<string, string>();
    static string NiceName(string path, string display) {
      if (string.IsNullOrEmpty(path)) return string.IsNullOrEmpty(display) ? "Appli" : display;
      string n;
      if (nameCache.TryGetValue(path, out n)) return n;
      try { n = System.Diagnostics.FileVersionInfo.GetVersionInfo(path).FileDescription; } catch { n = null; }
      if (string.IsNullOrWhiteSpace(n) || n.Length > 40) n = System.IO.Path.GetFileNameWithoutExtension(path);
      nameCache[path] = n.Trim();
      return n.Trim();
    }

    // toutes les sessions audio de la sortie par défaut, avec leur clé
    static System.Collections.Generic.List<System.Tuple<string, IAudioSessionControl2, uint>> Sessions() {
      var list = new System.Collections.Generic.List<System.Tuple<string, IAudioSessionControl2, uint>>();
      Guid iid = typeof(IAudioSessionManager2).GUID;
      object o;
      Marshal.ThrowExceptionForHR(Audio.Device(0).Activate(ref iid, 23, IntPtr.Zero, out o));
      var mgr = (IAudioSessionManager2)o;
      IAudioSessionEnumerator en;
      Marshal.ThrowExceptionForHR(mgr.GetSessionEnumerator(out en));
      int n; en.GetCount(out n);
      for (int i = 0; i < n; i++) {
        IAudioSessionControl2 c;
        if (en.GetSession(i, out c) != 0 || c == null) continue;
        int st; c.GetState(out st);
        if (st == 2) continue; // session terminée
        uint pid; c.GetProcessId(out pid);
        string key = c.IsSystemSoundsSession() == 0 ? "system" : (ExePath(pid) ?? ("pid:" + pid)).ToLowerInvariant();
        list.Add(System.Tuple.Create(key, c, pid));
      }
      return list;
    }

    public static MixApp[] Apps() {
      var byKey = new System.Collections.Generic.Dictionary<string, MixApp>();
      var order = new System.Collections.Generic.List<string>();
      foreach (var s in Sessions()) {
        var c = s.Item2;
        var v = (ISimpleAudioVolume)c;
        float lvl; bool mute; int st;
        v.GetMasterVolume(out lvl); v.GetMute(out mute); c.GetState(out st);
        MixApp a;
        if (!byKey.TryGetValue(s.Item1, out a)) {
          string path = null, disp = null;
          if (s.Item1 != "system") { path = ExePath(s.Item3); try { c.GetDisplayName(out disp); } catch { } }
          if (disp != null && disp.StartsWith("@")) disp = null; // nom en ressource (@%SystemRoot%...) : illisible
          a = new MixApp { Key = s.Item1, Path = path, Name = s.Item1 == "system" ? "Sons système" : NiceName(path, disp), Volume = (int)Math.Round(lvl * 100), Mute = mute };
          byKey[s.Item1] = a; order.Add(s.Item1);
        }
        if (st == 1) a.Active = true;
      }
      var res = new System.Collections.Generic.List<MixApp>();
      foreach (var k in order) res.Add(byKey[k]);
      return res.ToArray();
    }

    public static int SetVolume(string key, float level) {
      level = Math.Max(0f, Math.Min(1f, level));
      int n = 0; Guid g = Guid.Empty;
      foreach (var s in Sessions()) if (s.Item1 == key) { ((ISimpleAudioVolume)s.Item2).SetMasterVolume(level, ref g); n++; }
      return n;
    }
    public static int SetMute(string key, bool mute) {
      int n = 0; Guid g = Guid.Empty;
      foreach (var s in Sessions()) if (s.Item1 == key) { ((ISimpleAudioVolume)s.Item2).SetMute(mute, ref g); n++; }
      return n;
    }
  }

  // Connexion / déconnexion des appareils audio Bluetooth (même méthode que l'outil ToothTray).
  [StructLayout(LayoutKind.Sequential)]
  struct SYSTEMTIME { public ushort a, b, c, d, e, f, g, h; }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct BLUETOOTH_DEVICE_INFO {
    public int dwSize;
    public ulong Address;
    public uint ulClassofDevice;
    [MarshalAs(UnmanagedType.Bool)] public bool fConnected;
    [MarshalAs(UnmanagedType.Bool)] public bool fRemembered;
    [MarshalAs(UnmanagedType.Bool)] public bool fAuthenticated;
    public SYSTEMTIME stLastSeen;
    public SYSTEMTIME stLastUsed;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 248)] public string szName;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct BLUETOOTH_FIND_RADIO_PARAMS { public int dwSize; }

  public static class Bt {
    [DllImport("bthprops.cpl", SetLastError = true)] static extern IntPtr BluetoothFindFirstRadio(ref BLUETOOTH_FIND_RADIO_PARAMS p, out IntPtr hRadio);
    [DllImport("bthprops.cpl")] static extern bool BluetoothFindRadioClose(IntPtr hFind);
    [DllImport("bthprops.cpl")] static extern int BluetoothGetDeviceInfo(IntPtr hRadio, ref BLUETOOTH_DEVICE_INFO info);
    [DllImport("bthprops.cpl")] static extern int BluetoothSetServiceState(IntPtr hRadio, ref BLUETOOTH_DEVICE_INFO info, ref Guid service, int flags);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    static readonly Guid[] AudioServices = {
      new Guid("0000110B-0000-1000-8000-00805F9B34FB"), // A2DP (son)
      new Guid("0000111E-0000-1000-8000-00805F9B34FB"), // Mains libres
    };

    public static int SetAudioConnected(ulong address, bool connect) {
      var p = new BLUETOOTH_FIND_RADIO_PARAMS(); p.dwSize = Marshal.SizeOf(typeof(BLUETOOTH_FIND_RADIO_PARAMS));
      IntPtr hRadio;
      IntPtr hFind = BluetoothFindFirstRadio(ref p, out hRadio);
      if (hFind == IntPtr.Zero) return -1;
      BluetoothFindRadioClose(hFind);
      try {
        var info = new BLUETOOTH_DEVICE_INFO();
        info.dwSize = Marshal.SizeOf(typeof(BLUETOOTH_DEVICE_INFO));
        info.Address = address;
        int r = BluetoothGetDeviceInfo(hRadio, ref info);
        if (r != 0) return r;
        int ok = 0, last = 0;
        foreach (Guid g0 in AudioServices) {
          Guid g = g0;
          int e;
          if (connect) {
            // désactiver puis réactiver force Windows à se reconnecter
            BluetoothSetServiceState(hRadio, ref info, ref g, 0);
            e = BluetoothSetServiceState(hRadio, ref info, ref g, 1);
          } else {
            e = BluetoothSetServiceState(hRadio, ref info, ref g, 0);
          }
          if (e == 0) ok++; else last = e;
        }
        return ok > 0 ? 0 : last;
      } finally { CloseHandle(hRadio); }
    }
  }

  public static class Win {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);
    public static void BroadcastTheme() {
      UIntPtr r;
      SendMessageTimeout((IntPtr)0xffff, 0x1A, UIntPtr.Zero, "ImmersiveColorSet", 2, 200, out r);
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SystemParametersInfo(uint action, uint param, string pvParam, uint winIni);
    public static bool SetWallpaper(string path) { return SystemParametersInfo(20, 0, path, 3); }
    [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
    public static uint ClipboardSeq() { return GetClipboardSequenceNumber(); }
    // repasse la fenêtre du hub devant la barre des tâches, SANS la déplacer ni l'activer
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    public static void Raise(long h) { SetWindowPos(new IntPtr(h), new IntPtr(-1), 0, 0, 0, 0, 0x0213); }
  }
}
