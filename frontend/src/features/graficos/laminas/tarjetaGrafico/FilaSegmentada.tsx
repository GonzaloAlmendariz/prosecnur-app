// Fila de la tarjeta con sus opciones en un segmentado (ítem 9 de la oleada del inspector, 2026-11-08): el rótulo con su
// «?» y su sello, y las opciones a la vista. Con rótulos largos («Como el informe (sin casos)») el segmentado baja a su
// propia línea, a todo el ancho; nunca se recorta (C4). Lo que decide si caben es opcionesEnSegmentado.ts.

import type { ReactNode } from "react";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import type { Segmentacion } from "../opcionesEnSegmentado";
import { rotuloConAyuda } from "./rotuloConAyuda";

type Props = {
  id: string;
  rotulo: string;
  /** El «?» y el sello de alcance, junto al rótulo. */
  marcas?: ReactNode;
  segmentos: Segmentacion;
  valor: string;
  onCambio: (v: string) => void;
  qa?: string;
};

export function FilaSegmentada({ id, rotulo, marcas, segmentos, valor, onCambio, qa }: Props) {
  return (
    <div className={`pulso-f6-dato pulso-f6-dato-segmentado${segmentos.apilado ? " is-apilado" : ""}`} data-qa={qa}>
      <span className="pulso-f6-dato-rotulo" id={id}>{rotuloConAyuda(rotulo, marcas)}</span>
      <RadioSegmentado etiqueta={rotulo} ancho multilinea={segmentos.apilado} valor={valor} opciones={segmentos.opciones} onCambiar={onCambio} />
    </div>
  );
}
