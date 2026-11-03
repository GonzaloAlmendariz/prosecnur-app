import type { ExploradorCruceTabla } from "../../../../api/validacionExplorar";
import { fmtN, fmtPct } from "./explorarModelo";

export type Recodificacion = {
  /** Opciones que conservan todos sus casos en la recodificada (la diagonal en 100 %). */
  intactas: { etiqueta: string; n: number }[];
  /** Opciones que perdieron casos, con adónde fueron. */
  cambios: { etiqueta: string; n: number; quedan: number; destinos: { etiqueta: string; n: number }[] }[];
};

/**
 * E8d — una múltiple cruzada con su recodificación: cada opción de la original sigue en la recodificada (mismo
 * rótulo) y casi todas conservan sus casos; lo que importa es adónde fueron los de las que cambiaron (típicamente
 * «Otro»). Null si el par no tiene esa forma —dos múltiples distintas—: entonces va la tabla de calor.
 */
export function recodificacion(tabla: ExploradorCruceTabla): Recodificacion | null {
  const col = new Map(tabla.columnas.map((c, j) => [c.etiqueta, j]));
  if (tabla.filas.length < 2 || tabla.filas.some((f) => f.n === null || !col.has(f.etiqueta))) return null;
  const nuevas = tabla.columnas.map((c, j) => ({ c, j })).filter(({ c }) => !tabla.filas.some((f) => f.etiqueta === c.etiqueta));
  const intactas: Recodificacion["intactas"] = [];
  const cambios: Recodificacion["cambios"] = [];
  tabla.filas.forEach((f, i) => {
    const n = f.n as number;
    const quedan = tabla.n[i][col.get(f.etiqueta) as number];
    if (quedan === n) {
      intactas.push({ etiqueta: f.etiqueta, n });
      return;
    }
    const destinos = nuevas.map(({ c, j }) => ({ etiqueta: c.etiqueta, n: tabla.n[i][j] })).filter((d) => d.n > 0).sort((a, b) => b.n - a.n);
    cambios.push({ etiqueta: f.etiqueta, n, quedan, destinos });
  });
  // Si casi nada queda intacto, no es una recodificación sino dos múltiples distintas.
  if (!cambios.length || intactas.length < tabla.filas.length / 2) return null;
  return { intactas, cambios };
}

export default function CruceRecodificacion({ datos }: { datos: Recodificacion }) {
  return (
    <div className="vx-recod">
      {datos.intactas.length > 0 && (
        <div>
          <span className="vx-eyebrow">Sin cambios</span>
          <div className="vx-fichas">
            {datos.intactas.map((o) => (
              <span key={o.etiqueta}>{o.etiqueta} · {fmtN(o.n)}</span>
            ))}
          </div>
        </div>
      )}
      {datos.cambios.map((c) => {
        const filas = [...c.destinos.map((d) => ({ ...d, sigue: false })), { etiqueta: `Sigue en «${c.etiqueta}»`, n: c.quedan, sigue: true }];
        const max = Math.max(1, ...filas.map((f) => f.n));
        return (
          <div key={c.etiqueta}>
            <span className="vx-eyebrow">Adónde fueron los {fmtN(c.n)} casos de «{c.etiqueta}»</span>
            <div className="vx-barras">
              {filas.map((f, k) => (
                <div key={f.etiqueta} className={`vx-barra-fila${k === 0 && !f.sigue ? " is-primera" : ""}${f.sigue ? " is-residual" : ""}`}>
                  <span className="vx-barra-etq">{f.etiqueta}</span>
                  <span className="vx-pista" aria-hidden>
                    <span className="vx-relleno" style={{ width: `${(100 * f.n) / max}%` }} />
                  </span>
                  <span className="vx-barra-pct">{fmtN(f.n)}</span>
                  <span className="vx-barra-n">{fmtPct(c.n > 0 ? (100 * f.n) / c.n : 0)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
