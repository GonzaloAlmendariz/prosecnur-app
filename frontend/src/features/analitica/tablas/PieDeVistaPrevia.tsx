// Lo que la vista previa dice bajo la hoja: cuántas tablas se ven de cuántas
// tiene el archivo (con el botón para ver más), las preguntas pedidas que no
// tienen tabla y por qué, la ponderación que no se aplicó, los avisos del
// motor y, con varias bases, de cuál es la vista previa.

import type { FrecuenciasPreview } from "../../../api/analitica";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { AlertTriangle } from "../../../vendor/lucide-react";
import {
  avisosDelMotor, causaSinTabla, dicePorBase, ponderacionSinAplicar, rotuloMostrarMas, siguienteLimite, textoDelRecorte,
} from "./vistaPreviaModelo";

export function PieDeVistaPrevia({ preview, sinTabla, limite, onMostrarMas, releyendo = false }: {
  preview: FrecuenciasPreview;
  /** Las preguntas pedidas que no tienen tabla, de la hoja y de la pregunta elegida. */
  sinTabla: FrecuenciasPreview["sin_tabla"];
  limite: number;
  onMostrarMas?: () => void;
  /** Lo que se ve es de una lectura anterior. */
  releyendo?: boolean;
}) {
  const avisos = avisosDelMotor(preview);
  const siguiente = preview.recortado ? siguienteLimite(limite, preview.total_variables) : null;
  const lineas = [
    ...sinTabla.map((s) => ({ clave: `sin/${s.variable}`, alerta: true, texto: <><code className="tablas-codigo">{s.variable}</code> {causaSinTabla(s.motivo)}</> })),
    ...(ponderacionSinAplicar(preview)
      ? [{ clave: "pesos", alerta: true, texto: <>La ponderación está activada y no se aplicó: las tablas salen sin pesos. Revísala en Ponderación.</> }]
      : []),
    ...avisos.map((a, i) => ({ clave: `aviso/${i}`, alerta: true, texto: <>{a}</> })),
    ...(dicePorBase(preview, releyendo)
      ? [{
        clave: "bases",
        alerta: false,
        texto: <>Vista previa de la base &quot;{preview.base.nombre}&quot;. Al generar sale un archivo por cada una de las {formatoConteo(preview.base.n_bases)} bases.</>,
      }]
      : []),
  ];
  return (
    <div className="tablas-pie-vista">
      {preview.recortado ? (
        <div className="tablas-recorte">
          <p className="tablas-aviso">
            {textoDelRecorte(preview.devueltas, preview.total_variables)}
            {siguiente === null ? " Para ver otra, elígela en Ir a una pregunta." : null}
          </p>
          {siguiente !== null && onMostrarMas ? (
            <PulsoButton variant="secondary" size="sm" onClick={onMostrarMas}>
              {rotuloMostrarMas(limite, siguiente, preview.total_variables)}
            </PulsoButton>
          ) : null}
        </div>
      ) : null}
      {lineas.length > 0 ? (
        <ul className="tablas-avisos" aria-label="Avisos de la vista previa">
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
