// Cifras en tarjeta del kit (2 nov 2026, pasada de diseño de Material): una fila de
// cifras que resumen una sección, cada una en su tarjeta con rótulo en versalitas,
// el valor en el rol `kpi`, «de N» subordinado y, si hace falta, una barra de avance.
//
// No había una compartida: cada módulo tenía la suya (`KpiCard` en Dashboard,
// `CifraMotor` en Cálculo de muestra, `Metric` en aulas). `CifrasPestana` de
// Analítica es otra cosa —chips compactos para la cabecera de una pestaña— y se
// queda allí. Las del resto de módulos pueden converger aquí cuando se toquen.

import type { CSSProperties, ReactNode } from "react";

import { BarraDeAvance } from "./BarraDeAvance";
import "./cifras-en-tarjeta.css";

export type CifraEnTarjeta = {
  id: string;
  rotulo: string;
  valor: ReactNode;
  /** El total contra el que se lee el valor: se pinta «de N», subordinado. */
  de?: number;
  nota?: ReactNode;
  avance?: { valor: number; total: number; etiqueta: string };
  /** `aviso`: lo pendiente que bloquea; `listo`: lo cumplido. */
  tono?: "aviso" | "listo";
};

export function CifrasEnTarjeta({ cifras }: { cifras: readonly CifraEnTarjeta[] }) {
  return (
    <dl className="pulso-cifras-tarjeta" style={{ "--pulso-cifras-columnas": String(cifras.length) } as CSSProperties}>
      {cifras.map((c) => (
        <div key={c.id} className="pulso-cifra-tarjeta" data-tono={c.tono}>
          <dt>{c.rotulo}</dt>
          <dd>
            {c.valor}
            {c.de !== undefined ? <small> de {c.de.toLocaleString("es-PE")}</small> : null}
          </dd>
          {c.avance ? <BarraDeAvance {...c.avance} /> : null}
          {c.nota ? <span>{c.nota}</span> : null}
        </div>
      ))}
    </dl>
  );
}
