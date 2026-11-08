// H4: índice de secciones plegables, pegado arriba del cuerpo del inspector mientras se recorre la pestaña. Cada opción
// abre su sección y la lleva arriba (irASeccion). Lo usan la tarjeta del gráfico y la pestaña «Lámina».
// Acabado W2-B (2026-11-08): Datos / Cálculo / Aspecto es el segmentado del kit (GlidingRadioGroup, pulgar blanco sobre
// surface-2) en partes iguales a todo el ancho. Con el clic salta y enfoca la sección; con las flechas salta sin sacar
// el foco del índice, para poder seguir recorriéndolo. Volver a pulsar la opción elegida vuelve a saltar.

import { useState, type ButtonHTMLAttributes, type RefObject } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { irASeccion } from "./irASeccion";
import "../../subpestanas/radioSegmentado.css";

export type EntradaIndice = { clave: string; rotulo: string; titulo: string };

type Props = {
  /** Contenedor de las secciones (`[data-seccion-tarjeta]`) y del índice. */
  tarjeta: RefObject<HTMLElement>;
  entradas: readonly EntradaIndice[];
  etiqueta: string;
  onAbrir: (clave: string) => void;
};

type PropsOpcion = ButtonHTMLAttributes<HTMLButtonElement> & { [dato: `data-${string}`]: string };

export function IndicePlegables({ tarjeta, entradas, etiqueta, onAbrir }: Props) {
  const [activa, setActiva] = useState(entradas[0]?.clave ?? "");
  const ir = (clave: string, enfocar: boolean) => {
    setActiva(clave);
    onAbrir(clave);
    irASeccion(tarjeta.current, clave, { enfocar });
  };
  return (
    <nav className="pulso-f6-indice-tarjeta" aria-label={etiqueta} data-indice-tarjeta="">
      <GlidingRadioGroup
        value={activa}
        options={entradas}
        getOptionValue={(e) => e.clave}
        // Flechas (roving del kit): salta sin robar el foco. El clic llega por onClickCapture, que enfoca la sección.
        onValueChange={(clave) => ir(clave, false)}
        aria-label="Ir a la sección"
        className="pulso-f6-segmento is-ancho pulso-f6-indice-tarjeta-segmento"
        data-qa-geometry-group="graficos/f6-indice-tarjeta"
        data-qa-geometry-contract="equal"
        getOptionProps={(e) => {
          const props: PropsOpcion = {
            title: `Ir a ${e.titulo}`,
            "data-ir": e.clave,
            "data-qa-geometry-member": "",
            onClickCapture: (ev) => {
              // El clic con el ratón o Espacio/Intro: salta y enfoca. Se corta aquí para no repetir el salto en
              // onValueChange (que queda para las flechas).
              ev.preventDefault();
              ev.stopPropagation();
              ir(e.clave, true);
            },
          };
          return props;
        }}
      >
        {/* El rótulo en su elemento: la auditoría de geometría mide los hijos elemento del botón (patrón de EstadoChip). */}
        {(e) => <span className="pulso-f6-segmento-rotulo">{e.rotulo}</span>}
      </GlidingRadioGroup>
    </nav>
  );
}
