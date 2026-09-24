import { BarChart3, Database, Grid3X3, Layers3, Table2, Target } from "lucide-react";

import { labelMarcoOcasional, type MarcoOcasional } from "./marcoOcasional";
import "./general.css";

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
    { id: "estratos", label: "Capas / variables de control", copy: "Tengo N por estrato, actor, sexo, edad, distrito u otra capa.", icon: Layers3 },
    { id: "conglomerados", label: "Conglomerados", copy: "Seleccionaré cursos-horario, sedes, servicios, instituciones u otras unidades agrupadas.", icon: Grid3X3 },
    { id: "servicios", label: "Atenciones por servicio y municipalidad", copy: "Patrón GIZ: volumen por celda, n por territorio y cuotas proporcionales.", icon: Table2 },
    { id: "cuotas_controladas", label: "Control no probabilístico", copy: "No hay selección probabilística final, pero sí variables de control.", icon: Target },
    { id: "cobertura", label: "Cobertura de marco", copy: "Quiero saber cuánto del marco corresponde cubrir o contactar.", icon: BarChart3 },
  ];
  return (
    <section className="cmv2-panel" aria-labelledby="cmg-forma-marco-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Forma del marco</span>
          <h3 className="cmg-panel-titulo" id="cmg-forma-marco-titulo">Qué elementos contiene</h3>
        </div>
      </div>
      <div className="cmv2-shape-grid" role="group" aria-labelledby="cmg-forma-marco-titulo">
        {shapes.map((shape) => {
          const Icon = shape.icon;
          const active = selected === labelMarcoOcasional(shape.id);
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
    </section>
  );
}
