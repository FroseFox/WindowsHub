// Moteur compilé du hub (remplace PowerShell : démarrage instantané, beaucoup moins de mémoire).
// Même protocole que src/ps/host.ps1 :
//   entrée  : "<id> <commande en base64>"      (ex. commande : Set-Radio 'WiFi' $true)
//   sortie  : "@R <id> <json>"  ·  "@E <json>" (événement)  ·  "@READY"
//   -Mode main   : commandes + surveillance (musique, système, jeux, presse-papier, notifications)
//   -Mode worker : commandes seulement (listes, stats, icônes...)
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace HubHelper {
  public static class Program {
    static TextWriter output;
    static readonly object outLock = new object();
    static readonly BlockingCollection<string> inbox = new BlockingCollection<string>();
    public static bool MainMode = true;

    public static void Emit(string line) {
      lock (outLock) {
        output.Write(line);
        output.Write('\n');
        output.Flush();
      }
    }
    public static void Event(object o) { Emit("@E " + Json.Write(o)); }

    // les erreurs vont sur stderr (le hub les écrit dans son journal)
    public static void Log(string s) {
      try { Console.Error.WriteLine(s); Console.Error.Flush(); } catch { }
    }

    [STAThread]   // nécessaire pour le presse-papier
    static int Main(string[] args) {
      for (int i = 0; i + 1 < args.Length; i++) {
        if (string.Equals(args[i], "-Mode", StringComparison.OrdinalIgnoreCase)) MainMode = !string.Equals(args[i + 1], "worker", StringComparison.OrdinalIgnoreCase);
      }
      Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
      output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
      Console.SetError(new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)) { AutoFlush = true });

      // lecture des commandes sur un fil à part ; elles sont exécutées sur le fil principal (STA)
      var reader = new Thread(() => {
        try {
          var r = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
          string l;
          while ((l = r.ReadLine()) != null) inbox.Add(l);
        } catch { }
        inbox.CompleteAdding();
      });
      reader.IsBackground = true;
      reader.Start();

      try { Cmds.Init(); } catch (Exception e) { Log("démarrage : " + e.Message); }
      if (MainMode) { try { Watch.Init(); } catch (Exception e) { Log("surveillance : " + e.Message); } }
      Emit("@READY");

      while (true) {
        string line;
        int wait = MainMode ? Watch.Wait : Timeout.Infinite;
        if (inbox.TryTake(out line, wait)) {
          RunLine(line);
          while (inbox.TryTake(out line)) RunLine(line);
        }
        if (inbox.IsCompleted) return 0;   // le hub s'est fermé
        if (MainMode) Watch.Tick();
      }
    }

    static void RunLine(string line) {
      int sp = line.IndexOf(' ');
      if (sp < 1) return;
      string id = line.Substring(0, sp);
      string json;
      try {
        string cmd = Encoding.UTF8.GetString(Convert.FromBase64String(line.Substring(sp + 1).Trim()));
        json = Json.Write(Run(cmd));
      } catch (Exception e) {
        var inner = e;
        while (inner.InnerException != null && (inner is AggregateException || inner is System.Reflection.TargetInvocationException)) inner = inner.InnerException;
        json = Json.Write(new Obj { { "__error", inner.Message } });
      }
      Emit("@R " + id + " " + json);
    }

    // "Nom 'texte' $true 0.5" -> nom + arguments
    static readonly Regex Tok = new Regex(@"'([^']*)'|(\S+)", RegexOptions.Compiled);
    public static object Run(string text) {
      var args = new List<object>();
      string name = null;
      foreach (Match m in Tok.Matches(text.Trim())) {
        if (name == null) { name = m.Value; continue; }
        if (m.Groups[1].Success) { args.Add(m.Groups[1].Value); continue; }
        string v = m.Groups[2].Value;
        if (string.Equals(v, "$true", StringComparison.OrdinalIgnoreCase)) args.Add(true);
        else if (string.Equals(v, "$false", StringComparison.OrdinalIgnoreCase)) args.Add(false);
        else {
          double d;
          if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) args.Add(d);
          else args.Add(v);
        }
      }
      if (name == null) return null;
      return Cmds.Dispatch(name, new Args(args));
    }
  }

  public class Args {
    readonly List<object> a;
    public Args(List<object> a) { this.a = a; }
    public string S(int i) { return i < a.Count && a[i] != null ? Convert.ToString(a[i], CultureInfo.InvariantCulture) : ""; }
    public string B64(int i) { string s = S(i); return s.Length == 0 ? "" : Encoding.UTF8.GetString(Convert.FromBase64String(s)); }
    public bool B(int i) { if (i >= a.Count) return false; if (a[i] is bool) return (bool)a[i]; return string.Equals(S(i), "true", StringComparison.OrdinalIgnoreCase) || S(i) == "1"; }
    public double D(int i) { if (i >= a.Count) return 0; if (a[i] is double) return (double)a[i]; double d; return double.TryParse(S(i), NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : 0; }
  }
}
