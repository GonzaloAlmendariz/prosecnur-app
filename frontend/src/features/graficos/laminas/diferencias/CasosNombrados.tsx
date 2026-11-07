// «Cómo se nombran los casos» (`publico`): el plural de la unidad en la lectura («estudiantes»). Va en el mismo lugar del
// bloque en las tarjetas, en los hallazgos y en el resumen de diferencias: después de «Comparar por» y del nombre corto
// de los grupos (H6 del checklist de usabilidad, 2026-11-05).

import { useId } from "react";
import { AyudaGlobo } from "../AyudaGlobo";

type Props = {
  valor: string;
  /** Dónde se lee el nombre, en una línea. */
  ayuda?: string;
  onCambio: (publico: string) => void;
};

export function CasosNombrados({ valor, ayuda = "En la lectura de cada tarjeta, p. ej. «estudiantes».", onCambio }: Props) {
  const id = useId();
  return (
    <div className="pulso-f6-dato is-apilado" data-campo="publico" data-qa-geometry-member="">
      <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-publico`}>
        Cómo se nombran los casos
        <AyudaGlobo id={`${id}-publico-ayuda`} rotulo="Cómo se nombran los casos" detalle={ayuda} />
      </label>
      <input id={`${id}-publico`} className="pulso-f6-input" value={valor} placeholder="personas encuestadas"
        aria-describedby={`${id}-publico-ayuda`} onChange={(e) => onCambio(e.target.value)} />
    </div>
  );
}
