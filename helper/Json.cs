// Écriture JSON minimale (aucune dépendance) : nombres, textes, booléens, listes et dictionnaires.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace HubHelper {
  // Objet JSON : l'ordre d'insertion est conservé (on ne supprime jamais de clé)
  public class Obj : Dictionary<string, object> { }

  public static class Json {
    public static string Write(object o) {
      var sb = new StringBuilder();
      W(sb, o);
      return sb.ToString();
    }

    static void W(StringBuilder sb, object o) {
      if (o == null) { sb.Append("null"); return; }
      if (o is string) { Str(sb, (string)o); return; }
      if (o is bool) { sb.Append((bool)o ? "true" : "false"); return; }
      if (o is int || o is long || o is uint || o is ulong || o is short || o is ushort || o is byte || o is sbyte) {
        sb.Append(Convert.ToString(o, CultureInfo.InvariantCulture));
        return;
      }
      if (o is double || o is float || o is decimal) {
        double d = Convert.ToDouble(o, CultureInfo.InvariantCulture);
        if (double.IsNaN(d) || double.IsInfinity(d)) sb.Append("null");
        else sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
        return;
      }
      if (o is Enum) { Str(sb, o.ToString()); return; }
      var dict = o as IDictionary;
      if (dict != null) {
        sb.Append('{');
        bool first = true;
        foreach (DictionaryEntry e in dict) {
          if (!first) sb.Append(',');
          first = false;
          Str(sb, Convert.ToString(e.Key, CultureInfo.InvariantCulture));
          sb.Append(':');
          W(sb, e.Value);
        }
        sb.Append('}');
        return;
      }
      var list = o as IEnumerable;
      if (list != null) {
        sb.Append('[');
        bool first = true;
        foreach (var x in list) {
          if (!first) sb.Append(',');
          first = false;
          W(sb, x);
        }
        sb.Append(']');
        return;
      }
      Str(sb, o.ToString());
    }

    static void Str(StringBuilder sb, string s) {
      sb.Append('"');
      foreach (char c in s) {
        switch (c) {
          case '"': sb.Append("\\\""); break;
          case '\\': sb.Append("\\\\"); break;
          case '\n': sb.Append("\\n"); break;
          case '\r': sb.Append("\\r"); break;
          case '\t': sb.Append("\\t"); break;
          default:
            if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
            break;
        }
      }
      sb.Append('"');
    }
  }
}
