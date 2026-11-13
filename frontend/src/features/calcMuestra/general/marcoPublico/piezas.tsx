import type { ReactNode } from "react";

import { ApiError } from "../../../../api/core";
import type { ValorDeColumna } from "../../../../api/calcMuestraMarcoPublico";

const formato = new Intl.NumberFormat("en-US");
export const cifra = (n: number): string => formato.format(Math.round(n));

/** El mensaje del motor sin el código interno que `ApiError` le añade al final. */
export function errorLegible(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(/\s\u00b7\s[A-Z0-9_]+$/, "");
  return e instanceof Error ? e.message : "No se pudo completar la lectura.";
}

/** Un nombre de columna puede partirse tras un guion bajo, nunca en medio de una palabra. */
export function conCortes(nombre: string): ReactNode {
  const partes = nombre.split("_");
  return partes.map((p, i) => <span key={i}>{p}{i < partes.length - 1 ? <>_<wbr /></> : null}</span>);
}

export function Pastilla({ children, icono, tono }: { children: ReactNode; icono?: ReactNode; tono?: "ok" | "aviso" | "acento" }) {
  return <span className="cmmp-pastilla" data-tono={tono}>{icono}{children}</span>;
}

export function Formatos({ formatos }: { formatos: readonly string[] }) {
  return (
    <span className="cmmp-formatos" data-qa-geometry-group="calc-muestra/marco-formatos" data-qa-geometry-contract="equal">
      {formatos.map((f) => <span key={f} className="cmmp-formato" data-formato={f}>{f}</span>)}
    </span>
  );
}

/** Barra apilada con el peso de cada valor de una columna. */
export function BarraApilada({ valores, etiqueta }: { valores: readonly ValorDeColumna[]; etiqueta: string }) {
  const total = valores.reduce((s, v) => s + v.n, 0) || 1;
  return (
    <span className="cmmp-apilada" role="img" aria-label={etiqueta}>
      {valores.map((v, i) => (
        <i key={v.valor} data-tono={i % 6} style={{ width: `${(v.n / total) * 100}%` }} title={`${v.valor}: ${cifra(v.n)}`} />
      ))}
    </span>
  );
}

/** Barras horizontales de los valores de una columna, la mayor llena. */
export function BarrasDeValores({ valores, max = 8 }: { valores: readonly ValorDeColumna[]; max?: number }) {
  const tope = Math.max(1, ...valores.map((v) => v.n));
  return (
    <ul className="cmmp-hbarras">
      {valores.slice(0, max).map((v) => (
        <li key={v.valor}>
          <span title={v.valor}>{v.valor}</span>
          <i><b style={{ width: `${(v.n / tope) * 100}%` }} /></i>
          <em>{cifra(v.n)}</em>
        </li>
      ))}
    </ul>
  );
}
