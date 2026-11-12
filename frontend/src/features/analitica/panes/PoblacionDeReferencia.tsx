// Contra qué población se pondera. Decide si se ofrecen las metas del CPV 2025
// (sólo territorio). Va en la línea de la leyenda, sobre la tabla de metas,
// como "Población de referencia" en el prototipo. El grupo es el segmentado del
// kit: una parada de tabulador y las flechas eligen.

import { useId } from "react";

import { Segmentado, type OpcionDeSegmentado } from "../ponderacion/Segmentado";
import type { PoblacionDeReferencia as Poblacion } from "./poblacionReferenciaModel";
import "./PonderacionControles.css";

const OPCIONES: OpcionDeSegmentado<Poblacion>[] = [
  { valor: "territorio", rotulo: "Población de un territorio", ayuda: "Hogares o personas de ciudades, provincias o distritos. Las metas pueden salir del CPV 2025." },
  { valor: "marco", rotulo: "Padrón o marco propio", ayuda: "Estudiantes, docentes, egresados, miembros de una institución. Las metas salen de tu padrón o marco." },
];

export function PoblacionDeReferencia({ valor, inferida, metasDelCenso, onCambio }: {
  valor: Poblacion;
  inferida: boolean;
  /** Márgenes con metas tomadas del CPV 2025: se avisan si el estudio no es territorial. */
  metasDelCenso: number;
  onCambio: (p: Poblacion) => void;
}) {
  const id = useId();
  return (
    <div className="pond-card pond-poblacion">
      <div className="pond-ajuste">
        <span className="pond-ajuste-rotulo" id={id}>Población de referencia</span>
        <Segmentado etiquetadoPor={id} valor={valor} opciones={OPCIONES} onCambio={onCambio} />
        {inferida && <small className="pond-ajuste-nota" title="Se deduce del Monitoreo y de Hojas de ruta del proyecto. Elige otra si no corresponde.">según el estudio</small>}
      </div>
      {valor === "marco" && metasDelCenso > 0 && (
        <p className="pond-aviso is-warn">
          {metasDelCenso === 1 ? "Una variable tiene" : `${metasDelCenso} variables tienen`} metas del CPV 2025, que describen un territorio y no tu padrón.
        </p>
      )}
    </div>
  );
}
