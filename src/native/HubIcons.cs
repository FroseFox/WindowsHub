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
