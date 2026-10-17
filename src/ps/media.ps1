# Lecteur média : lit le morceau en cours (Spotify, navigateur, etc.) via les contrôles média de Windows.

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$global:MediaMgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$global:ThumbKey = $null
$global:ThumbTries = 0

# Détection d'un jeu / d'une appli en plein écran sur l'écran principal
Add-CachedType 'HubWatch' @'
using System;
using System.Text;
using System.Runtime.InteropServices;
namespace HubWatch {
  public static class Screen {
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    static Screen() { try { SetProcessDPIAware(); } catch { } }

    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);

    // Chemin du programme au premier plan (ex. C:\Riot Games\VALORANT\...\VALORANT-Win64-Shipping.exe)
    static IntPtr lastWnd = IntPtr.Zero;
    static string lastExe = null;
    public static string ForegroundExe() {
      IntPtr h = GetForegroundWindow();
      if (h == IntPtr.Zero) return null;
      if (h == lastWnd) return lastExe;
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      string exe = null;
      if (pid != 0) {
        IntPtr p = OpenProcess(0x1000, false, pid); // droits minimaux : lire le nom seulement
        if (p != IntPtr.Zero) {
          try { var sb = new StringBuilder(1024); int n = sb.Capacity; if (QueryFullProcessImageName(p, 0, sb, ref n)) exe = sb.ToString(); }
          finally { CloseHandle(p); }
        }
      }
      lastWnd = h; lastExe = exe;
      return exe;
    }

    // La souris est-elle affichée ? (cachée en pleine partie, visible dans les menus)
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }
    [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CURSORINFO ci);
    public static bool CursorVisible() {
      var ci = new CURSORINFO();
      ci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
      if (!GetCursorInfo(ref ci)) return true;
      return (ci.flags & 1) != 0;
    }

    // 3 = un jeu Direct3D tourne en plein écran exclusif
    public static int NotificationState() { int s; return SHQueryUserNotificationState(out s) == 0 ? s : 0; }

    public static bool FullscreenApp() {
      IntPtr h = GetForegroundWindow();
      if (h == IntPtr.Zero || h == GetShellWindow() || h == GetDesktopWindow()) return false;
      var cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      string c = cls.ToString();
      if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Windows.UI.Core.CoreWindow") return false;
      RECT r;
      if (!GetWindowRect(h, out r)) return false;
      var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
      if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
      if ((mi.dwFlags & 1) == 0) return false; // seulement l'écran principal (celui où est le hub)
      return r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
    }
  }
}
'@

function global:Read-Thumb($ref) {
    $stream = Await ($ref.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $type = if ($stream.ContentType) { $stream.ContentType } else { 'image/jpeg' }
    $bytes = $null
    $tries = @(
        { $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream); $ms = New-Object System.IO.MemoryStream; $net.CopyTo($ms); $ms.ToArray() },
        { $size = [uint32]$stream.Size; $reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0)); $null = Await ($reader.LoadAsync($size)) ([uint32]); $b = New-Object byte[] $size; $reader.ReadBytes($b); , $b },
        { $size = [uint32]$stream.Size; $reader = [Windows.Storage.Streams.DataReader]::new($stream); $null = Await ($reader.LoadAsync($size)) ([uint32]); $b = New-Object byte[] $size; $reader.ReadBytes($b); , $b }
    )
    foreach ($t in $tries) {
        try { $bytes = [byte[]](& $t); if ($bytes -and $bytes.Length -gt 0) { break } } catch { [Console]::Error.WriteLine("pochette: " + $_.Exception.Message) }
    }
    if (-not $bytes -or $bytes.Length -eq 0) { return $null }
    "data:$type;base64," + [Convert]::ToBase64String($bytes)
}

function global:Get-MediaCore {
    $s = $global:MediaMgr.GetCurrentSession()
    if (-not $s) {
        $changed = $null -ne $global:ThumbKey
        $global:ThumbKey = $null
        return [ordered]@{ active = $false; thumbChanged = $changed; thumb = $null }
    }
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $t = $s.GetTimelineProperties()
    $pb = $s.GetPlaybackInfo()

    $out = [ordered]@{
        active      = $true
        title       = $p.Title
        artist      = if ($p.Artist) { $p.Artist } else { $p.AlbumArtist }
        app         = $s.SourceAppUserModelId
        status      = $pb.PlaybackStatus.ToString()
        position    = [math]::Round($t.Position.TotalMilliseconds)
        duration    = [math]::Round(($t.EndTime - $t.StartTime).TotalMilliseconds)
        updated     = $t.LastUpdatedTime.ToUnixTimeMilliseconds()
        now         = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        thumbChanged = $false
    }

    # La pochette n'est envoyée que quand le morceau change (Spotify la publie parfois un peu après le titre).
    $key = "$($p.Title)|$($out.artist)"
    if ($key -ne $global:ThumbKey) {
        $global:ThumbKey = $key
        $global:ThumbTries = 0
        $out.thumbChanged = $true
        $out.thumb = $null
    }
    if ($global:ThumbTries -ge 0 -and $global:ThumbTries -lt 12) {
        $global:ThumbTries++
        if ($p.Thumbnail) {
            $img = Safe { Read-Thumb $p.Thumbnail }
            if ($img) {
                $out.thumb = $img
                $out.thumbChanged = $true
                $global:ThumbTries = -1
            }
        }
    }
    $out
}

function global:Get-Media {
    $o = Get-MediaCore
    $o.fs = Safe { [HubWatch.Screen]::FullscreenApp() }
    $o
}

function global:Invoke-Media([string]$cmd, [double]$arg) {
    $s = $global:MediaMgr.GetCurrentSession()
    if (-not $s) { return $false }
    switch ($cmd) {
        'toggle' { Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { Await ($s.TrySkipNextAsync()) ([bool]) }
        'prev'   { Await ($s.TrySkipPreviousAsync()) ([bool]) }
        'seek'   { Await ($s.TryChangePlaybackPositionAsync([long]($arg * 10000))) ([bool]) }
        default  { $false }
    }
}
