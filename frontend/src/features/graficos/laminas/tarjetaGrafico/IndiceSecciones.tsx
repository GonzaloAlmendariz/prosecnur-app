// H4: índice de la tarjeta del gráfico, pegado arriba del cuerpo del inspector mientras se recorre la tarjeta. Cada
// botón abre su sección y la lleva arriba. Las secciones que ese tipo de gráfico no tiene se ocultan por CSS, con la
// misma regla que oculta la sección vacía (datosGrafico.css).

import type { RefObject } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { useLaminasUi } from "../laminasStore";
import { ROTULO_INDICE, SECCIONES_TARJETA, TITULO_GRUPO } from "../gruposTarjeta";
import { irASeccion } from "./irASeccion";

export function IndiceSecciones({ tarjeta }: { tarjeta: RefObject<HTMLElement> }) {
  const abrir = useLaminasUi((s) => s.abrirSeccionTarjeta);
  return (
    <nav className="pulso-f6-indice-tarjeta" aria-label="Secciones del gráfico" data-indice-tarjeta=""
      data-qa-geometry-group="graficos/f6-indice-tarjeta" data-qa-geometry-contract="intrinsic">
      {SECCIONES_TARJETA.map((s) => (
        <PulsoButton key={s} variant="secondary" size="sm" className="pulso-f6-indice-tarjeta-ir" data-ir={s}
          // La altura es la del control del kit (--pulso-control-height-sm), no un hueco del contenido.
          data-qa-geometry-capacity="owned" title={`Ir a ${TITULO_GRUPO[s]}`}
          onClick={() => { abrir(s); irASeccion(tarjeta.current, s); }}>
          {/* El rótulo en su elemento: la auditoría de geometría mide los hijos elemento del botón (patrón de EstadoChip). */}
          <span>{ROTULO_INDICE[s]}</span>
        </PulsoButton>
      ))}
    </nav>
  );
}
