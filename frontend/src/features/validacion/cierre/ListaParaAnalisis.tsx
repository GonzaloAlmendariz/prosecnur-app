/**
 * "Lista para análisis" de Cierre (prototipo `pp-v-lista` y `pp-deps`): el
 * sello que dice qué base rige para Codificación y Analítica y, debajo, si la
 * auditoría está al día y si quedan hallazgos por decidir. Absorbe la tarjeta
 * de promoción (`components/PromocionBase.tsx`): el bloqueo y la falta de
 * respaldo van en el sello con su causa; volver a la base cargada es "Reabrir
 * la base" en la cabecera.
 *
 * Mide su contenido (no lleva scroll propio): el alto libre de la columna es
 * de "Archivos".
 */
import { AlertTriangle, Check, FileCheck2, Undo2 } from "../../../vendor/lucide-react";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import type { PuntoDeLista, Sello } from "./modeloCierre";

export function ListaParaAnalisis({ sello, puntos, onIrAHallazgos, onVerFicha }: {
  sello: Sello;
  puntos: readonly PuntoDeLista[];
  onIrAHallazgos: () => void;
  /** Abre la lista de los casos para la ficha física. */
  onVerFicha: () => void;
}) {
  const icono = sello.tono === "ok"
    ? <Check size={18} />
    : sello.tono !== "neutro"
      ? <AlertTriangle size={18} />
      : sello.reabierta ? <Undo2 size={18} /> : <FileCheck2 size={18} />;
  return (
    <PanelDeMesa zona="lista" titulo="Lista para análisis">
      <div className="pulso-ci-sello" data-tono={sello.tono}>
        <span className="pulso-ci-sello-icono" aria-hidden="true">{icono}</span>
        <div>
          <b>{sello.titulo}</b>
          <span>{sello.detalle}</span>
        </div>
      </div>
      <ul className="pulso-ci-puntos" data-qa-geometry-group="validacion/cierre-lista" data-qa-geometry-contract="intrinsic">
        {puntos.map((p) => (
          <li key={p.clave} data-tono={p.tono}>
            <span className="pulso-ci-punto" aria-hidden="true" />
            <div>
              <b>{p.titulo}</b>
              {p.detalle ? <span>{p.detalle}</span> : null}
            </div>
            {p.irAHallazgos ? (
              <PulsoButton variant="link" size="sm" onClick={onIrAHallazgos}>Ir a Hallazgos</PulsoButton>
            ) : null}
            {p.verFicha ? (
              <PulsoButton variant="link" size="sm" onClick={onVerFicha}>Ver la lista</PulsoButton>
            ) : null}
          </li>
        ))}
      </ul>
    </PanelDeMesa>
  );
}
