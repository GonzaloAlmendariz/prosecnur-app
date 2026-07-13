/**
 * Diagrama del recorrido completo de "Muestra de aulas":
 *
 *   Definir → Subir bases → Mapear variables → Construir marco → Calcular
 *   → Seleccionar aulas
 *
 * Es ilustrativo, NO navegable: el rail y el sidebar ya son el recorrido real;
 * este dibujo solo orienta. Cada nodo declara su RESULTADO ("qué obtienes"),
 * `highlight` marca dónde está parado el usuario con el pin "Estás aquí" y
 * `estados` rellena el círculo de los pasos ya completados por el motor.
 *
 * Layout: stepper FLEX responsivo — los nodos tienen tamaño fijo y los
 * conectores crecen (flex-grow) para llenar el ancho disponible, sin márgenes
 * vacíos y sin agrandar los círculos en pantallas anchas (a diferencia de un
 * SVG que escala con su viewBox). Colores solo por tokens: --cmv2-accent
 * (activo), --pulso-success-fg (listo) y --pulso-border (pendiente).
 */
import type { CSSProperties } from "react";
import "./muestra-flow.css";

export type MuestraFlowNodeKey =
  | "definir"
  | "bases"
  | "variables"
  | "marco"
  | "calcular"
  | "aulas";

export type MuestraFlowDiagramProps = {
  /** Nodo donde está parado el usuario: se pinta con el acento + pin. */
  highlight?: MuestraFlowNodeKey;
  /** Estado por nodo: "ready" rellena el círculo en tono éxito. */
  estados?: Partial<Record<MuestraFlowNodeKey, "ready" | "pending">>;
  /** Versión compacta para convivir con contenido (menos aire). */
  compacto?: boolean;
};

const NODES: Array<{ key: MuestraFlowNodeKey; title: string; subtitle: string }> = [
  { key: "definir", title: "Definir", subtitle: "qué estudio es" },
  { key: "bases", title: "Subir bases", subtitle: "el Excel institucional" },
  { key: "variables", title: "Mapear variables", subtitle: "qué columna es qué" },
  { key: "marco", title: "Construir marco", subtitle: "N poblacional real" },
  { key: "calcular", title: "Calcular", subtitle: "n y cuotas" },
  { key: "aulas", title: "Seleccionar aulas", subtitle: "qué aulas visitar" },
];

/** Microcopy de la arista que LLEGA al nodo i+1 (5 flechas). */
const ARROW_COPY = ["con esto claro", "de ese Excel", "columnas listas", "sobre ese N", "para cubrir n"];

export function MuestraFlowDiagram({ highlight, estados, compacto }: MuestraFlowDiagramProps) {
  return (
    <div className="cmv2-muestra-flow" data-compacto={compacto || undefined}>
      <ol
        className="cmv2-muestra-flow-track"
        aria-label="Recorrido de la muestra de aulas: definir el estudio, subir las bases, mapear variables, construir el marco, calcular n y seleccionar las aulas."
      >
        {NODES.map((node, i) => {
          const state = node.key === highlight
            ? "active"
            : estados?.[node.key] === "ready"
              ? "ready"
              : "pending";
          return (
            <li key={node.key} className="cmv2-muestra-flow-item">
              <div
                className="cmv2-muestra-flow-node"
                data-state={state}
                style={{ animationDelay: `${i * 45}ms` } as CSSProperties}
              >
                <span className="cmv2-muestra-flow-badge">
                  {state === "active" && <span className="cmv2-muestra-flow-pin">Estás aquí</span>}
                  <NodeIllustration nodeKey={node.key} />
                </span>
                <span className="cmv2-muestra-flow-label">
                  <strong>{node.title}</strong>
                  <small>{node.subtitle}</small>
                </span>
              </div>

              {i < NODES.length - 1 && (
                <div className="cmv2-muestra-flow-link" aria-hidden="true">
                  <span className="cmv2-muestra-flow-link-copy">{ARROW_COPY[i]}</span>
                  <span className="cmv2-muestra-flow-link-line" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// -----------------------------------------------------------------------------
// NodeIllustration — glifo simple por paso (lienzo interno de 36×36). El color
// lo hereda del badge vía currentColor, así el estado (activo/listo/pendiente)
// gobierna el trazo sin recalcularlo aquí.
// -----------------------------------------------------------------------------

function NodeIllustration({ nodeKey }: { nodeKey: MuestraFlowNodeKey }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <svg className="cmv2-muestra-flow-glyph" viewBox="0 0 36 36" aria-hidden="true">
      {nodeKey === "definir" && (
        <g {...common}>
          <rect x={10} y={6} width={16} height={24} rx={2.5} />
          <line x1={14} y1={13} x2={22} y2={13} />
          <line x1={14} y1={18} x2={22} y2={18} />
          <line x1={14} y1={23} x2={19} y2={23} />
        </g>
      )}
      {nodeKey === "bases" && (
        <g {...common}>
          <rect x={7} y={8} width={22} height={20} rx={2.5} />
          <line x1={7} y1={15} x2={29} y2={15} />
          <line x1={15} y1={15} x2={15} y2={28} />
          <line x1={22} y1={15} x2={22} y2={28} />
        </g>
      )}
      {nodeKey === "variables" && (
        <g {...common}>
          <circle cx={9} cy={10} r={2} fill="currentColor" stroke="none" />
          <circle cx={9} cy={18} r={2} fill="currentColor" stroke="none" />
          <circle cx={9} cy={26} r={2} fill="currentColor" stroke="none" />
          <circle cx={27} cy={12} r={2.5} />
          <circle cx={27} cy={24} r={2.5} />
          <path d="M 12 10 C 18 10 20 12 24 12" />
          <path d="M 12 18 C 18 18 20 23 24 24" />
          <path d="M 12 26 C 18 26 20 13 24 12" />
        </g>
      )}
      {nodeKey === "marco" && (
        <g {...common}>
          <path d="M 8 8 L 28 8 L 21 17 L 21 26 L 15 30 L 15 17 Z" />
        </g>
      )}
      {nodeKey === "calcular" && (
        <g {...common}>
          <rect x={10} y={6} width={16} height={24} rx={2.5} />
          <line x1={13.5} y1={11.5} x2={22.5} y2={11.5} />
          <circle cx={14.5} cy={18} r={1.3} fill="currentColor" stroke="none" />
          <circle cx={18} cy={18} r={1.3} fill="currentColor" stroke="none" />
          <circle cx={21.5} cy={18} r={1.3} fill="currentColor" stroke="none" />
          <circle cx={14.5} cy={23} r={1.3} fill="currentColor" stroke="none" />
          <circle cx={18} cy={23} r={1.3} fill="currentColor" stroke="none" />
          <circle cx={21.5} cy={23} r={1.3} fill="currentColor" stroke="none" />
        </g>
      )}
      {nodeKey === "aulas" && (
        <g {...common}>
          <rect x={6.5} y={9} width={7} height={7} rx={1.5} fill="currentColor" stroke="none" />
          <rect x={16} y={9} width={7} height={7} rx={1.5} />
          <rect x={25.5} y={9} width={7} height={7} rx={1.5} />
          <rect x={6.5} y={20} width={7} height={7} rx={1.5} />
          <rect x={16} y={20} width={7} height={7} rx={1.5} fill="currentColor" stroke="none" />
          <rect x={25.5} y={20} width={7} height={7} rx={1.5} />
        </g>
      )}
    </svg>
  );
}
