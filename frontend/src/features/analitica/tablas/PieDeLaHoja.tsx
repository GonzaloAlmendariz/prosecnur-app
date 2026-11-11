// El pie de la vista previa de una pestaña de tablas (Frecuencias y Cruces):
// cuántas tablas se ven de cuántas tiene el archivo, con el botón para ver más,
// y los avisos, uno por renglón. Lo que dice cada aviso lo arma la pestaña.

import type { ReactNode } from "react";

import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle } from "../../../vendor/lucide-react";
import { rotuloMostrarMas, textoDelRecorte } from "./vistaPreviaModelo";

export type LineaDelPie = {
  clave: string;
  /** Pide atención: lleva el triángulo y el texto en el tono de lectura. */
  alerta: boolean;
  texto: ReactNode;
};

export function PieDeLaHoja({ recorte, lineas }: {
  /** La hoja no trae todas las tablas; `siguiente` es el próximo tope, `null` si ya no se pueden pedir más. */
  recorte: { devueltas: number; total: number; limite: number; siguiente: number | null; onMostrarMas?: () => void } | null;
  lineas: readonly LineaDelPie[];
}) {
  return (
    <div className="tablas-pie-vista">
      {recorte ? (
        <div className="tablas-recorte">
          <p className="tablas-aviso">
            {textoDelRecorte(recorte.devueltas, recorte.total)}
            {recorte.siguiente === null ? " Para ver otra, elígela en Ir a una pregunta." : null}
          </p>
          {recorte.siguiente !== null && recorte.onMostrarMas ? (
            <PulsoButton variant="secondary" size="sm" onClick={recorte.onMostrarMas}>
              {rotuloMostrarMas(recorte.limite, recorte.siguiente, recorte.total)}
            </PulsoButton>
          ) : null}
        </div>
      ) : null}
      {lineas.length > 0 ? (
        <ul className="tablas-avisos" aria-label="Avisos de la vista previa" data-qa-geometry-group="analitica/tablas-avisos" data-qa-geometry-contract="intrinsic">
          {lineas.map((l) => (
            <li key={l.clave} className="tablas-aviso" data-alerta={l.alerta ? "" : undefined}>
              {l.alerta ? <AlertTriangle size={13} aria-hidden="true" /> : null}
              <span>{l.texto}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
