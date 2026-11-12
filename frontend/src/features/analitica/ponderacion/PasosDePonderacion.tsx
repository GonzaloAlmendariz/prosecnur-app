// El recorrido de Ponderación, a todo el ancho bajo la cabecera (prototipo,
// `pp-pasos pp-pasos--serie`): cuatro pasos con su número o su marca de hecho,
// unidos por una línea. No es navegación: cada paso dice su estado y el panel
// donde se resuelve está a la vista debajo.

import { Panel } from "../../../components/Panel";
import { Check, Minus } from "../../../vendor/lucide-react";
import type { PasoDePonderacion } from "./pasosDelRecorrido";

const ESTADO_EN_PALABRAS: Record<PasoDePonderacion["estado"], string> = {
  hecho: "hecho",
  actual: "paso actual",
  pendiente: "pendiente",
  "no-aplica": "no aplica",
};

export function PasosDePonderacion({ pasos }: { pasos: readonly PasoDePonderacion[] }) {
  return (
    <Panel noPadding className="pond-pasos-panel" data-entra="sube">
      {/* C1: los pasos miden lo que su rótulo; la línea que los une se queda con el resto. */}
      <ol
        className="pond-pasos"
        aria-label="Recorrido de la ponderación"
        data-qa-geometry-group="analitica/ponderacion-pasos"
        data-qa-geometry-contract="intrinsic"
      >
        {pasos.map((paso, i) => (
          <li
            key={paso.clave}
            className="pond-paso"
            data-estado={paso.estado}
            aria-current={paso.estado === "actual" ? "step" : undefined}
            title={paso.titulo}
          >
            <span className="pond-paso-marca" aria-hidden="true">
              {paso.estado === "hecho" ? <Check size={12} strokeWidth={3} /> : paso.estado === "no-aplica" ? <Minus size={12} /> : i + 1}
            </span>
            <span className="pond-paso-rotulo">{paso.rotulo}</span>
            <span className="pulso-sr-only">, {ESTADO_EN_PALABRAS[paso.estado]}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
