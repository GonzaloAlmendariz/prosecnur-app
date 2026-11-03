import { BarChart3, Database, Grid3X3, Layers3, Table2, Target } from "lucide-react";

import { marcoOcasionalCoincide, type MarcoOcasional } from "./marcoOcasional";
import "./general.css";
import { Panel } from "../../../components/Panel";

/** Forma del marco (Muestra general › Marco). Extraída tal cual de la página. */
export function MarcoShapeSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (kind: MarcoOcasional) => void;
}) {
  const shapes: Array<{ id: MarcoOcasional; label: string; copy: string; icon: typeof Table2 }> = [
    { id: "marco_total", label: "Marco total", copy: "Tengo un N enumerable de la población objetivo.", icon: Database },
    { id: "estratos", label: "Estratos y variables de control", copy: "Tengo N por estrato, actor, sexo, edad, distrito u otra variable.", icon: Layers3 },
    { id: "conglomerados", label: "Conglomerados", copy: "Seleccionaré grupos de unidades: sedes, instituciones, centros, manzanas u otros conglomerados.", icon: Grid3X3 },
    { id: "servicios", label: "Volumen por celda", copy: "Tengo el volumen por cruce de dos dimensiones (territorio × servicio, sede × categoría…) y quiero n y cuotas por celda.", icon: Table2 },
    { id: "cuotas_controladas", label: "Muestreo por cuotas", copy: "Sin selección aleatoria final: se fijan cuotas por variables de control (no probabilístico).", icon: Target },
    { id: "cobertura", label: "Censo o cobertura total", copy: "Quiero cubrir o contactar todas las unidades del marco, sin muestrearlas.", icon: BarChart3 },
  ];
  return (
    <Panel aria-labelledby="cmg-forma-marco-titulo" title={<span id="cmg-forma-marco-titulo">Qué elementos contiene</span>}>
      <div className="cmv2-shape-grid" role="group" aria-labelledby="cmg-forma-marco-titulo">
        {shapes.map((shape) => {
          const Icon = shape.icon;
          const active = marcoOcasionalCoincide(selected, shape.id);
          return (
            <button
              key={shape.id}
              type="button"
              className={`cmv2-shape ${active ? "is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(shape.id)}
            >
              <Icon size={16} aria-hidden="true" />
              <strong>{shape.label}</strong>
              <span>{shape.copy}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
