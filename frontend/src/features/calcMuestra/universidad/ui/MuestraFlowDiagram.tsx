/**
 * Diagrama SVG del recorrido completo de "Muestra de aulas":
 *
 *   Definir → Subir bases → Mapear variables → Construir marco → Calcular
 *   → Seleccionar aulas
 *
 * Es ilustrativo, NO navegable: el rail y el sidebar ya son el recorrido real;
 * este dibujo solo orienta. Cada nodo declara su RESULTADO ("qué obtienes"),
 * `highlight` marca dónde está parado el usuario con el pin "Estás aquí" y
 * `estados` rellena el círculo de los pasos ya completados por el motor.
 * Colores solo por tokens: --cmv2-accent (activo), --pulso-success-fg (listo)
 * y --pulso-border (pendiente).
 */
import { useId, type CSSProperties } from "react";
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
  /** Versión compacta para convivir con contenido (menos aire, alineada a la izquierda). */
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

const NODE_X = [86, 243, 400, 557, 714, 871];
const NODE_CY = 60;
const NODE_R = 30;

export function MuestraFlowDiagram({ highlight, estados, compacto }: MuestraFlowDiagramProps) {
  const uid = useId();
  return (
    <div className="cmv2-muestra-flow" data-compacto={compacto || undefined}>
      <svg
        viewBox="0 0 960 150"
        role="img"
        aria-labelledby={`${uid}-title ${uid}-desc`}
        className="cmv2-muestra-flow-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={`${uid}-title`}>Recorrido de la muestra de aulas</title>
        <desc id={`${uid}-desc`}>
          Seis pasos encadenados: definir el estudio, subir las bases
          institucionales, mapear qué columna es qué, construir el marco con el
          N poblacional real, calcular n con sus cuotas y seleccionar las aulas
          a visitar.
        </desc>

        {/* Aristas primero, para que queden debajo de los nodos. */}
        {NODES.slice(0, -1).map((_, i) => (
          <FlowArrow key={`arista-${i}`} index={i} copy={ARROW_COPY[i]!} />
        ))}

        {NODES.map((node, i) => (
          <FlowNode
            key={node.key}
            node={node}
            index={i}
            highlighted={node.key === highlight}
            ready={estados?.[node.key] === "ready"}
          />
        ))}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FlowNode — círculo con estado + ilustración + título + subtítulo de resultado
// -----------------------------------------------------------------------------

function FlowNode({
  node,
  index,
  highlighted,
  ready,
}: {
  node: (typeof NODES)[number];
  index: number;
  highlighted: boolean;
  ready: boolean;
}) {
  const cx = NODE_X[index]!;
  // El activo manda sobre el ready: el usuario mira dónde está parado.
  const fill = highlighted
    ? "var(--cmv2-accent)"
    : ready
      ? "var(--pulso-success-fg)"
      : "var(--cmv2-surface, var(--pulso-surface))";
  const stroke = highlighted
    ? "var(--cmv2-accent)"
    : ready
      ? "var(--pulso-success-fg)"
      : "var(--pulso-border)";
  const iconColor = highlighted || ready
    ? "var(--cmv2-surface, var(--pulso-surface))"
    : "var(--pulso-text-muted)";

  return (
    <g
      className={`cmv2-muestra-flow-node${highlighted ? " is-highlighted" : ""}`}
      style={{ animationDelay: `${index * 40}ms` } as CSSProperties}
    >
      <circle cx={cx} cy={NODE_CY} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={2} />

      {/* Halo punteado del nodo activo */}
      {highlighted && (
        <circle
          cx={cx}
          cy={NODE_CY}
          r={NODE_R + 6}
          fill="none"
          stroke="var(--cmv2-accent)"
          strokeWidth={1.5}
          strokeOpacity={0.35}
          strokeDasharray="4 4"
          className="cmv2-muestra-flow-halo"
        />
      )}

      <g transform={`translate(${cx - 18}, ${NODE_CY - 18})`}>
        <NodeIllustration nodeKey={node.key} color={iconColor} />
      </g>

      <text
        x={cx}
        y={NODE_CY + NODE_R + 22}
        textAnchor="middle"
        className="cmv2-muestra-flow-title"
        fill="var(--pulso-text)"
      >
        {node.title}
      </text>
      <text
        x={cx}
        y={NODE_CY + NODE_R + 38}
        textAnchor="middle"
        className="cmv2-muestra-flow-sub"
        fill="var(--pulso-text-muted)"
      >
        {node.subtitle}
      </text>

      {highlighted && (
        <g transform={`translate(${cx + 26}, ${NODE_CY - 44})`}>
          <rect x={-32} y={-12} width={64} height={20} rx={10} fill="var(--cmv2-accent)" />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            fill="var(--cmv2-surface, var(--pulso-surface))"
            className="cmv2-muestra-flow-pin"
          >
            Estás aquí
          </text>
        </g>
      )}
    </g>
  );
}

// -----------------------------------------------------------------------------
// NodeIllustration — glifo simple por paso (lienzo interno de 36×36)
// -----------------------------------------------------------------------------

function NodeIllustration({
  nodeKey,
  color,
}: {
  nodeKey: MuestraFlowNodeKey;
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  switch (nodeKey) {
    case "definir":
      // Ficha del estudio: documento con líneas de identidad.
      return (
        <g {...common}>
          <rect x={10} y={6} width={16} height={24} rx={2.5} />
          <line x1={14} y1={13} x2={22} y2={13} />
          <line x1={14} y1={18} x2={22} y2={18} />
          <line x1={14} y1={23} x2={19} y2={23} />
        </g>
      );

    case "bases":
      // Hoja de cálculo: la base institucional con filas y columnas.
      return (
        <g {...common}>
          <rect x={7} y={8} width={22} height={20} rx={2.5} />
          <line x1={7} y1={15} x2={29} y2={15} />
          <line x1={15} y1={15} x2={15} y2={28} />
          <line x1={22} y1={15} x2={22} y2={28} />
        </g>
      );

    case "variables":
      // Mapeo: columnas de la izquierda conectadas a roles de la derecha.
      return (
        <g {...common}>
          <circle cx={9} cy={10} r={2} fill={color} stroke="none" />
          <circle cx={9} cy={18} r={2} fill={color} stroke="none" />
          <circle cx={9} cy={26} r={2} fill={color} stroke="none" />
          <circle cx={27} cy={12} r={2.5} />
          <circle cx={27} cy={24} r={2.5} />
          <path d="M 12 10 C 18 10 20 12 24 12" />
          <path d="M 12 18 C 18 18 20 23 24 24" />
          <path d="M 12 26 C 18 26 20 13 24 12" />
        </g>
      );

    case "marco":
      // Embudo: del universo bruto al N poblacional depurado.
      return (
        <g {...common}>
          <path d="M 8 8 L 28 8 L 21 17 L 21 26 L 15 30 L 15 17 Z" />
        </g>
      );

    case "calcular":
      // Calculadora: pantalla + teclas — de N salen n y cuotas.
      return (
        <g {...common}>
          <rect x={10} y={6} width={16} height={24} rx={2.5} />
          <line x1={13.5} y1={11.5} x2={22.5} y2={11.5} />
          <circle cx={14.5} cy={18} r={1.3} fill={color} stroke="none" />
          <circle cx={18} cy={18} r={1.3} fill={color} stroke="none" />
          <circle cx={21.5} cy={18} r={1.3} fill={color} stroke="none" />
          <circle cx={14.5} cy={23} r={1.3} fill={color} stroke="none" />
          <circle cx={18} cy={23} r={1.3} fill={color} stroke="none" />
          <circle cx={21.5} cy={23} r={1.3} fill={color} stroke="none" />
        </g>
      );

    case "aulas":
      // Grilla de aulas: dos quedan seleccionadas (rellenas).
      return (
        <g {...common}>
          <rect x={6.5} y={9} width={7} height={7} rx={1.5} fill={color} stroke="none" />
          <rect x={16} y={9} width={7} height={7} rx={1.5} />
          <rect x={25.5} y={9} width={7} height={7} rx={1.5} />
          <rect x={6.5} y={20} width={7} height={7} rx={1.5} />
          <rect x={16} y={20} width={7} height={7} rx={1.5} fill={color} stroke="none" />
          <rect x={25.5} y={20} width={7} height={7} rx={1.5} />
        </g>
      );
  }
}

// -----------------------------------------------------------------------------
// FlowArrow — arista entre nodos con microcopy corto encima
// -----------------------------------------------------------------------------

function FlowArrow({ index, copy }: { index: number; copy: string }) {
  const x1 = NODE_X[index]! + NODE_R + 8;
  const x2 = NODE_X[index + 1]! - NODE_R - 8;
  const midX = (x1 + x2) / 2;
  const y = NODE_CY;

  return (
    <g className="cmv2-muestra-flow-arrow">
      <line
        x1={x1}
        y1={y}
        x2={x2 - 6}
        y2={y}
        stroke="var(--cmv2-border-strong, var(--pulso-border-strong))"
        strokeWidth={1.5}
      />
      <path
        d={`M ${x2 - 8} ${y - 4} L ${x2} ${y} L ${x2 - 8} ${y + 4} Z`}
        fill="var(--cmv2-border-strong, var(--pulso-border-strong))"
      />
      <text
        x={midX}
        y={y - 10}
        textAnchor="middle"
        fill="var(--pulso-text-muted)"
        className="cmv2-muestra-flow-arrow-text"
      >
        {copy}
      </text>
    </g>
  );
}
