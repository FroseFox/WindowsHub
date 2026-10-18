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
