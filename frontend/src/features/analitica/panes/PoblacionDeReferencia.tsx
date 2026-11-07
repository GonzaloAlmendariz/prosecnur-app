// Pregunta previa a los pasos de la calibración: contra qué población se
// pondera. Decide si se ofrecen las metas del CPV 2025 (sólo territorio).

import type { PoblacionDeReferencia as Poblacion } from "./poblacionReferenciaModel";
import "./PonderacionControles.css";

const OPCIONES: { valor: Poblacion; rotulo: string; ayuda: string }[] = [
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
  return (
    <div className="pond-card pond-poblacion">
      <div className="pond-ajuste">
        <span className="pond-ajuste-rotulo">Población</span>
        <div className="analitica-segmented" role="radiogroup" aria-label="Contra qué población ponderas">
          {OPCIONES.map((o) => (
            <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
              className={valor === o.valor ? "is-on" : ""} title={o.ayuda} onClick={() => onCambio(o.valor)}>
              {o.rotulo}
            </button>
          ))}
        </div>
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
