// Un separador entre dos filas de la lista (D4): un botón delgado que dice «Separar aquí» al pasar o enfocar, y que,
// puesto, muestra la línea punteada que saldrá en el gráfico. Un botón de alternar (aria-pressed), alcanzable con Tab.

import { Minus, X } from "../../../../vendor/lucide-react";
import "./separadorEntreFilas.css";

type Props = {
  /** La fila tras la que va el separador (1 = entre la primera y la segunda). */
  posicion: number;
  activo: boolean;
  onCambiar: (activo: boolean) => void;
};

export function SeparadorEntreFilas({ posicion, activo, onCambiar }: Props) {
  return (
    <div className={`pulso-f6-separador-filas${activo ? " is-activo" : ""}`}>
      <button type="button" className="pulso-f6-separador-filas-boton" aria-pressed={activo}
        aria-label={activo ? `Quitar el separador tras la fila ${posicion}` : `Separar aquí, tras la fila ${posicion}`}
        onClick={() => onCambiar(!activo)}>
        <span className="pulso-f6-separador-filas-linea" aria-hidden="true" />
        <span className="pulso-f6-separador-filas-rotulo" aria-hidden="true">
          {activo ? <><Minus size={12} /> Separador <X size={12} /></> : "Separar aquí"}
        </span>
        <span className="pulso-f6-separador-filas-linea" aria-hidden="true" />
      </button>
    </div>
  );
}
