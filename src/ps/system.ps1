# Etat et réglages système : Wi-Fi, Bluetooth, volume, mode sombre, éclairage nocturne.

Add-CachedType 'HubNative' @'
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

    static IMMDevice Device() {
      var e = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      IMMDevice d;
      Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out d));
      return d;
    }
    static IAudioEndpointVolume Vol() {
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      Marshal.ThrowExceptionForHR(Device().Activate(ref iid, 23, IntPtr.Zero, out o));
      return (IAudioEndpointVolume)o;
    }
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
'@

# ---- Radios (Wi-Fi / Bluetooth) via l'API Windows.Devices.Radios, comme le centre de notifications ----
$null = [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
$null = [Windows.Devices.Radios.RadioState, Windows.System.Devices, ContentType = WindowsRuntime]
$null = [Windows.Devices.Radios.RadioAccessStatus, Windows.System.Devices, ContentType = WindowsRuntime]
$null = Safe { Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus]) }

# Les objets "radio" sont gardés en mémoire : leur état se met à jour tout seul.
$global:RadioCache = @{}
$global:RadioCacheAt = 0
function global:Get-Radio([string]$kind) {
    $now = [Environment]::TickCount
    if (-not $global:RadioCache.Count -or [Math]::Abs($now - $global:RadioCacheAt) -gt 60000) {
        $all = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
        $global:RadioCache = @{}
        foreach ($r in $all) { $k = $r.Kind.ToString(); if (-not $global:RadioCache.ContainsKey($k)) { $global:RadioCache[$k] = $r } }
        $global:RadioCacheAt = $now
    }
    $global:RadioCache[$kind]
}

function global:Set-Radio([string]$kind, [bool]$on) {
    $r = Get-Radio $kind
    if (-not $r) { return 'NoRadio' }
    $state = if ($on) { [Windows.Devices.Radios.RadioState]::On } else { [Windows.Devices.Radios.RadioState]::Off }
    (Await ($r.SetStateAsync($state)) ([Windows.Devices.Radios.RadioAccessStatus])).ToString()
}

# Nom du réseau Wi-Fi connecté (API WinRT : quelques millisecondes, au lieu d'une requête CIM lente)
$null = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
function global:Get-WifiName {
    foreach ($p in [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()) {
        if ($p.IsWlanConnectionProfile -and $p.GetNetworkConnectivityLevel().ToString() -ne 'None') { return $p.ProfileName }
    }
    $null
}

# ---- Mode sombre ----
$global:ThemeKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'

function global:Get-DarkMode {
    $v = [Microsoft.Win32.Registry]::GetValue('HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize', 'AppsUseLightTheme', $null)
    if ($null -eq $v) { return $null }
    return ($v -eq 0)
}

function global:Set-DarkMode([bool]$dark) {
    $val = if ($dark) { 0 } else { 1 }
    Set-ItemProperty -LiteralPath $global:ThemeKey -Name AppsUseLightTheme -Value $val -Type DWord
    Set-ItemProperty -LiteralPath $global:ThemeKey -Name SystemUsesLightTheme -Value $val -Type DWord
    [HubNative.Win]::BroadcastTheme()
    'ok'
}

# ---- Eclairage nocturne (pas d'API officielle : on modifie l'état stocké par Windows) ----
$global:NightKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate'

$global:NightRegPath = 'HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate'
function global:Get-NightLight {
    $d = [Microsoft.Win32.Registry]::GetValue($global:NightRegPath, 'Data', $null)
    if (-not $d) { return $null }
    if ($d.Length -le 18) { return $null }
    return ($d[18] -eq 0x15)
}

function global:Set-NightLight([bool]$on) {
    $d = [byte[]](Get-ItemProperty -LiteralPath $global:NightKey -Name Data -ErrorAction Stop).Data
    $isOn = ($d[18] -eq 0x15)
    if ($isOn -eq $on) { return 'ok' }
    # Format connu : 41 octets éteint, 43 allumé. Si ça ne correspond pas, on ne touche à rien.
    if ($on -and $d.Length -ne 41) { return 'unsupported' }
    if (-not $on -and ($d.Length -ne 43 -or $d[23] -ne 0x10 -or $d[24] -ne 0x00)) { return 'unsupported' }
    $list = New-Object 'System.Collections.Generic.List[byte]'
    $list.AddRange($d)
    if ($on) {
        $list[18] = 0x15
        $list.InsertRange(23, [byte[]](0x10, 0x00))
    } else {
        $list[18] = 0x13
        $list.RemoveRange(23, 2)
    }
    for ($i = 10; $i -lt 15; $i++) {
        if ($list[$i] -ne 0xff) { $list[$i] = [byte]($list[$i] + 1); break }
    }
    Set-ItemProperty -LiteralPath $global:NightKey -Name Data -Value ([byte[]]$list.ToArray()) -Type Binary
    'ok'
}

# ---- Fenêtre Son : liste des sorties ----
function global:Get-AudioOutputs {
    $items = @([HubNative.Audio]::Outputs() | ForEach-Object { [ordered]@{ id = $_.Id; name = $_.Name; current = $_.IsDefault } })
    [ordered]@{ ok = $true; items = $items }
}

function global:Set-AudioOutput([string]$idB64) {
    [HubNative.Audio]::SetDefault((FromB64 $idB64))
    'ok'
}

# ---- Fenêtre Bluetooth : appareils associés ----
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]

function global:Get-BtDevices {
    $out = New-Object System.Collections.ArrayList
    $sel = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true)
    $infos = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
    foreach ($i in $infos) {
        $d = Safe { Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($i.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice]) }
        if (-not $d) { continue }
        $major = Safe { $d.ClassOfDevice.MajorClass.ToString() }
        $null = $out.Add([ordered]@{
            addr      = $d.BluetoothAddress.ToString()
            name      = if ($d.Name) { $d.Name } else { $i.Name }
            connected = $d.ConnectionStatus.ToString() -eq 'Connected'
            kind      = $major
            audio     = $major -eq 'AudioVideo'
        })
        $d.Dispose()
    }
    # Appareils Bluetooth "basse énergie" (souris, claviers...) : affichés, connexion gérée par Windows
    $selLe = [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromPairingState($true)
    $infosLe = Safe { Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selLe)) ([Windows.Devices.Enumeration.DeviceInformationCollection]) }
    foreach ($i in @($infosLe)) {
        if (-not $i) { continue }
        $d = Safe { Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($i.Id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice]) }
        if (-not $d) { continue }
        $name = if ($d.Name) { $d.Name } else { $i.Name }
        if ($out | Where-Object { $_.name -eq $name }) { $d.Dispose(); continue }
        $null = $out.Add([ordered]@{
            addr = $d.BluetoothAddress.ToString(); name = $name
            connected = $d.ConnectionStatus.ToString() -eq 'Connected'
            kind = 'LowEnergy'; audio = $false
        })
        $d.Dispose()
    }
    $items = @($out | Sort-Object -Property @{ Expression = { -not $_.connected } }, @{ Expression = { $_.name } })
    [ordered]@{ ok = $true; items = $items }
}

function global:Set-BtAudio([string]$addr, [bool]$connect) {
    $r = [HubNative.Bt]::SetAudioConnected([uint64]$addr, $connect)
    if ($r -eq 0) { 'ok' } else { "err$r" }
}

# ---- Fenêtre Wi-Fi : réseaux disponibles ----
$null = [Windows.Devices.WiFi.WiFiAdapter, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiAccessStatus, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiConnectionResult, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiReconnectionKind, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Security.Credentials.PasswordCredential, Windows.Security.Credentials, ContentType = WindowsRuntime]
$global:WifiNets = @{}

function global:Get-WifiAdapter {
    $adapters = Await ([Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.WiFi.WiFiAdapter]])
    $adapters | Select-Object -First 1
}

function global:Get-KnownWifi {
    $known = @{}
    $txt = netsh wlan show profiles 2>$null
    foreach ($l in $txt) {
        if ($l -match '^\s+[^:]+?\s:\s(.+)$') {
            $n = $Matches[1].Trim()
            if ($n -and $n -notmatch '^<') { $known[$n] = $true }
        }
    }
    $known
}

function global:Get-WifiNetworks {
    $access = Await ([Windows.Devices.WiFi.WiFiAdapter]::RequestAccessAsync()) ([Windows.Devices.WiFi.WiFiAccessStatus])
    if ($access.ToString() -ne 'Allowed') { return [ordered]@{ ok = $false; reason = 'location' } }
    $a = Get-WifiAdapter
    if (-not $a) { return [ordered]@{ ok = $false; reason = 'noadapter' } }
    Safe { AwaitAction ($a.ScanAsync()) }
    $current = Safe { Get-WifiName }
    $known = Get-KnownWifi
    $best = @{}
    foreach ($n in $a.NetworkReport.AvailableNetworks) {
        if (-not $n.Ssid) { continue }
        if (-not $best.ContainsKey($n.Ssid) -or $best[$n.Ssid].SignalBars -lt $n.SignalBars) { $best[$n.Ssid] = $n }
    }
    $global:WifiNets = $best
    $list = foreach ($ssid in $best.Keys) {
        $n = $best[$ssid]
        $auth = $n.SecuritySettings.NetworkAuthenticationType.ToString()
        [ordered]@{
            ssid      = $ssid
            bars      = [int]$n.SignalBars
            secure    = -not ($auth -eq 'Open80211' -or $auth -eq 'None')
            known     = $known.ContainsKey($ssid)
            connected = $ssid -eq $current
        }
    }
    $sorted = @($list | Sort-Object -Property @{ Expression = { -not $_.connected } }, @{ Expression = { -not $_.known } }, @{ Expression = { -$_.bars } })
    [ordered]@{ ok = $true; items = $sorted }
}

function global:Connect-Wifi([string]$ssidB64, [string]$passB64) {
    $ssid = FromB64 $ssidB64
    $a = Get-WifiAdapter
    $n = $global:WifiNets[$ssid]
    if (-not $a -or -not $n) { return 'notfound' }
    $kind = [Windows.Devices.WiFi.WiFiReconnectionKind]::Automatic
    if ($passB64) {
        $cred = New-Object Windows.Security.Credentials.PasswordCredential
        $cred.Password = FromB64 $passB64
        $res = Await ($a.ConnectAsync($n, $kind, $cred)) ([Windows.Devices.WiFi.WiFiConnectionResult])
    } else {
        $res = Await ($a.ConnectAsync($n, $kind)) ([Windows.Devices.WiFi.WiFiConnectionResult])
    }
    $s = $res.ConnectionStatus.ToString()
    if ($s -eq 'Success') { 'ok' } else { $s }
}

function global:Disconnect-Wifi {
    $a = Get-WifiAdapter
    if ($a) { $a.Disconnect() }
    'ok'
}

# ---- Onglet Apps : applis du menu Démarrer ----
function global:Get-AppsList {
    $skip = '(?i)uninstall|désinstaller|readme|lisez-moi|documentation|help|aide$|website|site web|release notes'
    $items = @(Get-StartApps | Where-Object { $_.Name -and $_.Name -notmatch $skip } | Sort-Object Name | ForEach-Object { [ordered]@{ name = $_.Name; id = $_.AppID } })
    [ordered]@{ ok = $true; items = $items }
}

# ---- Onglet Fond d'écran ----
function global:Set-Wallpaper([string]$pathB64) {
    if ([HubNative.Win]::SetWallpaper((FromB64 $pathB64))) { 'ok' } else { 'error' }
}

function global:Get-Wallpaper {
    (Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -ErrorAction Stop).WallPaper
}

# ---- Onglet Énergie ----
function global:Invoke-Sleep {
    Add-Type -AssemblyName System.Windows.Forms
    $null = [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
    'ok'
}

# ---- Etat complet envoyé à l'interface ----
function global:Get-HubState {
    $wifi = Safe { Get-Radio 'WiFi' }
    $bt = Safe { Get-Radio 'Bluetooth' }
    [ordered]@{
        wifi     = if ($wifi) { $wifi.State.ToString() -eq 'On' } else { $null }
        wifiName = Safe { Get-WifiName }
        bt       = if ($bt) { $bt.State.ToString() -eq 'On' } else { $null }
        volume   = Safe { [int][math]::Round([HubNative.Audio]::GetVolume() * 100) }
        mute     = Safe { [HubNative.Audio]::GetMute() }
        output   = Safe { [HubNative.Audio]::DeviceName() }
        dark     = Safe { Get-DarkMode }
        night    = Safe { Get-NightLight }
    }
}

# ---- Icône d'une appli du Microsoft Store (Deezer Store, Minecraft, Xbox...) ----
$global:AppxByFamily = $null
function global:Get-UwpIcon([string]$idB64) {
    $id = FromB64 $idB64
    $parts = $id.Split('!', 2)
    if (-not $global:AppxByFamily) {
        $global:AppxByFamily = @{}
        foreach ($p in (Get-AppxPackage -ErrorAction SilentlyContinue)) { $global:AppxByFamily[$p.PackageFamilyName] = $p }
    }
    $pkg = $global:AppxByFamily[$parts[0]]
    if (-not $pkg -or -not $pkg.InstallLocation) { return $null }
    [xml]$man = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -Raw -ErrorAction Stop
    $apps = @($man.Package.Applications.Application)
    $app = $apps | Where-Object { $_.Id -eq $parts[1] } | Select-Object -First 1
    if (-not $app) { $app = $apps[0] }
    $ve = $app.VisualElements
    $logo = $null
    foreach ($attr in 'Square44x44Logo', 'Square150x150Logo', 'Logo') { if ($ve -and $ve.$attr) { $logo = $ve.$attr; break } }
    if (-not $logo) { $logo = $man.Package.Properties.Logo }
    if (-not $logo) { return $null }
    $full = Join-Path $pkg.InstallLocation $logo
    $dir = Split-Path -Parent $full
    $base = [IO.Path]::GetFileNameWithoutExtension($full)
    $ext = [IO.Path]::GetExtension($full)
    # Windows range plusieurs tailles du logo : on prend celle qui ressemble à l'icône de la barre des tâches
    $rank = {
        $n = $_.Name.ToLower()
        if ($n -match 'targetsize-48_altform-unplated') { 0 } elseif ($n -match 'targetsize-48') { 1 }
        elseif ($n -match 'targetsize-64_altform-unplated') { 2 } elseif ($n -match 'targetsize-32') { 3 }
        elseif ($n -match 'scale-200') { 4 } elseif ($n -match 'scale-100') { 5 } else { 6 }
    }
    $pick = Get-ChildItem -LiteralPath $dir -Filter "$base*$ext" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'contrast' } | Sort-Object $rank | Select-Object -First 1
    if (-not $pick -and (Test-Path -LiteralPath $full)) { $pick = Get-Item -LiteralPath $full }
    if (-not $pick) { return $null }
    'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($pick.FullName))
}
