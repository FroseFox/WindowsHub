# Onglet Stats : débit réseau et charge du GPU (le CPU, la RAM et le disque sont lus directement par Node).

function global:Get-NetBytes {
    $rx = [int64]0; $tx = [int64]0
    foreach ($n in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($n.OperationalStatus -ne 'Up') { continue }
        if ($n.NetworkInterfaceType -eq 'Loopback' -or $n.NetworkInterfaceType -eq 'Tunnel') { continue }
        if ($n.Description -match 'Hyper-V|Virtual|VMware|VirtualBox|Loopback|WAN Miniport') { continue }
        try { $s = $n.GetIPStatistics(); $rx += $s.BytesReceived; $tx += $s.BytesSent } catch { }
    }
    [ordered]@{ rx = $rx; tx = $tx }
}

# Charge GPU via les compteurs de performance (comme le Gestionnaire des tâches) : quelques millisecondes,
# au lieu de la requête WMI qui pouvait prendre 10 à 30 secondes la première fois.
Add-CachedType 'HubPdh' @'
using System;
using System.Runtime.InteropServices;
namespace HubPdh {
  public static class Gpu {
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhOpenQuery(string src, IntPtr user, out IntPtr query);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhAddEnglishCounter(IntPtr query, string path, IntPtr user, out IntPtr counter);
    [DllImport("pdh.dll")] static extern uint PdhCollectQueryData(IntPtr query);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern uint PdhGetFormattedCounterArray(IntPtr counter, uint format, ref uint size, out uint count, IntPtr buffer);
    const uint PDH_FMT_DOUBLE = 0x200;
    const uint PDH_MORE_DATA = 0x800007D2;
    static IntPtr query, counter;
    static bool ready;

    // -1 = pas encore de mesure (il faut deux relevés)
    public static double Load() {
      if (!ready) {
        if (PdhOpenQuery(null, IntPtr.Zero, out query) != 0) return -1;
        if (PdhAddEnglishCounter(query, @"\GPU Engine(*engtype_3D)\Utilization Percentage", IntPtr.Zero, out counter) != 0) return -1;
        PdhCollectQueryData(query);
        ready = true;
        return -1;
      }
      if (PdhCollectQueryData(query) != 0) return -1;
      uint size = 0, count;
      if (PdhGetFormattedCounterArray(counter, PDH_FMT_DOUBLE, ref size, out count, IntPtr.Zero) != PDH_MORE_DATA) return -1;
      IntPtr buf = Marshal.AllocHGlobal((int)size);
      try {
        if (PdhGetFormattedCounterArray(counter, PDH_FMT_DOUBLE, ref size, out count, buf) != 0) return -1;
        int item = IntPtr.Size + 16; // { nom ; { statut ; valeur } }
        double sum = 0;
        for (int i = 0; i < count; i++) {
          IntPtr p = new IntPtr(buf.ToInt64() + (long)i * item);
          uint status = (uint)Marshal.ReadInt32(p, IntPtr.Size);
          if (status <= 1) sum += BitConverter.Int64BitsToDouble(Marshal.ReadInt64(p, IntPtr.Size + 8));
        }
        return Math.Min(100.0, sum);
      } finally { Marshal.FreeHGlobal(buf); }
    }
  }
}
'@

function global:Get-GpuName {
    (Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object { $_.Name -notmatch 'Basic|Virtual|Parsec|Remote' } | Select-Object -First 1).Name
}

function global:Get-Stats {
    $n = Get-NetBytes
    $g = Safe { [HubPdh.Gpu]::Load() }
    [ordered]@{ rx = $n.rx; tx = $n.tx; gpu = $(if ($null -ne $g -and $g -ge 0) { [int][Math]::Round($g) } else { $null }) }
}

# ---- Icônes d'applis, demandées directement à Windows (comme le menu Démarrer) ----
Add-CachedType 'HubIcons' @'
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
namespace HubIcons {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx; public int cy; }

  public static class Shell {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);

    // name = chemin d'un fichier, ou "shell:AppsFolder\<id d'appli>"
    public static string IconPng(string name, int size) {
      IShellItemImageFactory f;
      SHCreateItemFromParsingName(name, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
      SIZE sz = new SIZE(); sz.cx = size; sz.cy = size;
      IntPtr hbm;
      int hr = f.GetImage(sz, 0x4 /* icône seulement */, out hbm);
      if (hr != 0 || hbm == IntPtr.Zero) return null;
      try {
        using (Bitmap raw = Image.FromHbitmap(hbm)) {
          Rectangle r = new Rectangle(0, 0, raw.Width, raw.Height);
          BitmapData d = raw.LockBits(r, ImageLockMode.ReadOnly, raw.PixelFormat);
          try {
            // FromHbitmap perd la transparence : on relit les mêmes pixels en gardant le canal alpha
            using (Bitmap alpha = new Bitmap(d.Width, d.Height, d.Stride, PixelFormat.Format32bppPArgb, d.Scan0))
            using (Bitmap copy = new Bitmap(alpha))
            using (MemoryStream ms = new MemoryStream()) {
              copy.Save(ms, ImageFormat.Png);
              return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
            }
          } finally { raw.UnlockBits(d); }
        }
      } finally { DeleteObject(hbm); }
    }
  }
}
'@ @('System.Drawing')

function global:Get-AppIcon([string]$nameB64) {
    [HubIcons.Shell]::IconPng((FromB64 $nameB64), 64)
}
