// H4: índice de secciones plegables, pegado arriba del cuerpo del inspector mientras se recorre la pestaña. Cada botón
// abre su sección y la lleva arriba (irASeccion). Lo usan la tarjeta del gráfico y la pestaña «Lámina».

import type { RefObject } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { irASeccion } from "./irASeccion";

export type EntradaIndice = { clave: string; rotulo: string; titulo: string };

type Props = {
  /** Contenedor de las secciones (`[data-seccion-tarjeta]`) y del índice. */
  tarjeta: RefObject<HTMLElement>;
  entradas: readonly EntradaIndice[];
  etiqueta: string;
  onAbrir: (clave: string) => void;
};

export function IndicePlegables({ tarjeta, entradas, etiqueta, onAbrir }: Props) {
  return (
    <nav className="pulso-f6-indice-tarjeta" aria-label={etiqueta} data-indice-tarjeta=""
      data-qa-geometry-group="graficos/f6-indice-tarjeta" data-qa-geometry-contract="equal">
      {entradas.map((e) => (
        <PulsoButton key={e.clave} variant="secondary" size="sm" className="pulso-f6-indice-tarjeta-ir" data-ir={e.clave}
          // La altura es la del control del kit (--pulso-control-height-sm), no un hueco del contenido.
          data-qa-geometry-capacity="owned" title={`Ir a ${e.titulo}`}
          onClick={() => { onAbrir(e.clave); irASeccion(tarjeta.current, e.clave); }}>
          {/* El rótulo en su elemento: la auditoría de geometría mide los hijos elemento del botón (patrón de EstadoChip). */}
          <span>{e.rotulo}</span>
        </PulsoButton>
      ))}
    </nav>
  );
}
