// Una pregunta de la guía de criterios: su rótulo y dos opciones excluyentes.

import { useId } from "react";

import { Segmentado } from "./Segmentado";

export function PreguntaDeCriterio({ rotulo, si, no, valor, onCambio }: {
  rotulo: string;
  si: string;
  no: string;
  /** `null` mientras no se respondió. */
  valor: boolean | null;
  onCambio: (valor: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="pond-criterio">
      <span className="pond-criterio-rotulo" id={id}>{rotulo}</span>
      <Segmentado
        etiquetadoPor={id}
        valor={valor === null ? null : valor ? "si" : "no"}
        opciones={[{ valor: "si", rotulo: si }, { valor: "no", rotulo: no }]}
        onCambio={(elegido) => onCambio(elegido === "si")}
      />
    </div>
  );
}
