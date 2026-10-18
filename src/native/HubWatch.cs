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
