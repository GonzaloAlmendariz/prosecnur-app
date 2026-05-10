// =============================================================================
// shell/HubFlowDiagram.tsx — guía visual de los pasos del editor
// =============================================================================
// SVG embebido en el `EmptyHome`. Cuatro pasos secuenciales que cubren
// el ciclo dentro del editor — desde crear la estructura hasta obtener
// el archivo final exportado:
//
//   Secciones  →  Preguntas  →  Lógica  →  Exportar
//
// Cada nodo es una ilustración con `<path>` simples. La microcopy en las
// flechas describe el resultado del paso ("agrupa", "define", "configura",
// "descarga"), no acciones futuras fuera del editor.
// =============================================================================

import type { CSSProperties } from "react";

export type HubFlowDiagramProps = {
  /** Nodo a resaltar. No tiene default — la guía no asume dónde está
   *  parado el usuario porque puede entrar al hub en cualquier momento. */
  highlight?: "secciones" | "preguntas" | "logica" | "exportar";
};

const NODES = [
  {
    key: "secciones" as const,
    title: "Secciones",
    subtitle: "agrupa preguntas relacionadas",
    color: "#2457d6",
  },
  {
    key: "preguntas" as const,
    title: "Preguntas",
    subtitle: "define tipo, texto y opciones",
    color: "#0f766e",
  },
  {
    key: "logica" as const,
    title: "Lógica",
    subtitle: "cuándo aparece y cómo se valida",
    color: "#7c3aed",
  },
  {
    key: "exportar" as const,
    title: "Exportar",
    subtitle: "como XLSForm (.xlsx) o PDF",
    color: "#d4396a",
  },
];

const ARROW_COPY = ["", "dentro de cada", "configura el flujo", "guarda el resultado"];

export function HubFlowDiagram({ highlight }: HubFlowDiagramProps) {
  return (
    <div className="pulso-hub-flow">
      <svg
        viewBox="0 0 880 220"
        role="img"
        aria-labelledby="hub-flow-title hub-flow-desc"
        className="pulso-hub-flow-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="hub-flow-title">Cómo funciona Prosecnur</title>
        <desc id="hub-flow-desc">
          Cuatro etapas: pensar las preguntas, armar el formulario en este
          editor, salir a encuestar con KoBo o ODK Collect, y analizar los
          datos recolectados.
        </desc>

        {/* Flechas entre nodos (las dibujamos primero para que queden
            debajo de los nodos). */}
        {NODES.slice(0, -1).map((_, i) => (
          <FlowArrow key={`arrow-${i}`} index={i} copy={ARROW_COPY[i]!} />
        ))}

        {/* Nodos */}
        {NODES.map((node, i) => (
          <FlowNode
            key={node.key}
            node={node}
            index={i}
            highlighted={node.key === highlight}
          />
        ))}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FlowNode — un nodo del flujo (círculo + ilustración + label)
// -----------------------------------------------------------------------------

const NODE_X = [80, 300, 540, 780];
const NODE_CY = 80;
const NODE_R = 46;

function FlowNode({
  node,
  index,
  highlighted,
}: {
  node: (typeof NODES)[number];
  index: number;
  highlighted: boolean;
}) {
  const cx = NODE_X[index]!;
  const fill = highlighted ? node.color : "white";
  const stroke = node.color;
  const iconColor = highlighted ? "white" : node.color;

  return (
    <g
      className={`pulso-hub-flow-node${highlighted ? " is-highlighted" : ""}`}
      style={{ animationDelay: `${index * 80}ms` } as CSSProperties}
    >
      {/* Círculo principal */}
      <circle
        cx={cx}
        cy={NODE_CY}
        r={NODE_R}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />

      {/* Halo cuando está resaltado */}
      {highlighted && (
        <circle
          cx={cx}
          cy={NODE_CY}
          r={NODE_R + 6}
          fill="none"
          stroke={node.color}
          strokeWidth={1.5}
          strokeOpacity={0.3}
          strokeDasharray="4 4"
          className="pulso-hub-flow-halo"
        />
      )}

      {/* Ilustración interior (path por nodo) */}
      <g transform={`translate(${cx - 22}, ${NODE_CY - 22})`}>
        <NodeIllustration nodeKey={node.key} color={iconColor} />
      </g>

      {/* Etiquetas */}
      <text
        x={cx}
        y={NODE_CY + NODE_R + 22}
        textAnchor="middle"
        className="pulso-hub-flow-node-title"
        fill="var(--pulso-text)"
      >
        {node.title}
      </text>
      <text
        x={cx}
        y={NODE_CY + NODE_R + 40}
        textAnchor="middle"
        className="pulso-hub-flow-node-sub"
        fill="var(--pulso-text-soft)"
      >
        {node.subtitle}
      </text>

      {/* Pin "Estás aquí" cuando aplica */}
      {highlighted && (
        <g transform={`translate(${cx + 32}, ${NODE_CY - 50})`}>
          <rect
            x={-32}
            y={-12}
            width={64}
            height={20}
            rx={10}
            fill={node.color}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            fill="white"
            className="pulso-hub-flow-pin-text"
          >
            Estás aquí
          </text>
        </g>
      )}
    </g>
  );
}

// -----------------------------------------------------------------------------
// NodeIllustration — el dibujito interior, distinto por nodo
// -----------------------------------------------------------------------------

function NodeIllustration({
  nodeKey,
  color,
}: {
  nodeKey: (typeof NODES)[number]["key"];
  color: string;
}) {
  // Lienzo interno 44x44 (centrado en el círculo de 92px de radio en
  // FlowNode). Los iconos usan un grosor de trazo uniforme y poco
  // detalle para que se lean a tamaño chico sin saturar.
  const stroke = color;
  const strokeWidth = 2;
  const fill = color;

  switch (nodeKey) {
    case "secciones":
      // Tres barras horizontales con offset descendente — sugiere stack
      // de secciones que contienen contenido. Cada barra con un punto
      // marca a la izquierda (handle de sección).
      return (
        <g
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={10} cy={11} r={1.6} fill={fill} stroke="none" />
          <line x1={16} y1={11} x2={36} y2={11} />
          <circle cx={10} cy={22} r={1.6} fill={fill} stroke="none" />
          <line x1={16} y1={22} x2={32} y2={22} />
          <circle cx={10} cy={33} r={1.6} fill={fill} stroke="none" />
          <line x1={16} y1={33} x2={34} y2={33} />
        </g>
      );

    case "preguntas":
      // Signo de pregunta dentro de un círculo punteado — universal,
      // legible y no se confunde con el icono de "secciones".
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={22} cy={22} r={16} fill="none" />
          <path
            d="M 16 17 Q 16 12 22 12 Q 28 12 28 17 Q 28 21 22 23 L 22 26"
            fill="none"
          />
          <circle cx={22} cy={31} r={1.6} fill={fill} stroke="none" />
        </g>
      );

    case "logica":
      // Diagrama de bifurcación: un nodo origen que se separa en dos
      // ramas (sí/no, condición). Más obvio que la card→card anterior.
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Nodo origen arriba */}
          <circle cx={22} cy={10} r={3} fill={fill} stroke="none" />
          {/* Bifurcación */}
          <path d="M 22 13 L 22 20" fill="none" />
          <path d="M 22 20 L 12 28" fill="none" />
          <path d="M 22 20 L 32 28" fill="none" />
          {/* Hijos */}
          <circle cx={12} cy={32} r={3} fill="none" />
          <circle cx={32} cy={32} r={3} fill={fill} stroke="none" />
        </g>
      );

    case "exportar":
      // Caja con flecha apuntando hacia afuera/arriba a la derecha —
      // metáfora estándar de "exportar" / "salir hacia". Más clara que
      // la "descarga" porque acá lo que sale es el archivo del editor.
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Caja con esquina recortada (donde sale la flecha) */}
          <path
            d="M 8 16 L 8 36 L 32 36 L 32 24"
            fill="none"
          />
          <path
            d="M 8 16 L 22 16"
            fill="none"
          />
          {/* Flecha hacia afuera (arriba-derecha) */}
          <path d="M 22 22 L 36 8" fill="none" />
          <path
            d="M 28 8 L 36 8 L 36 16"
            fill="none"
          />
        </g>
      );
  }
}

// -----------------------------------------------------------------------------
// FlowArrow — flecha entre dos nodos con label superior
// -----------------------------------------------------------------------------

function FlowArrow({ index, copy }: { index: number; copy: string }) {
  const x1 = NODE_X[index]! + NODE_R + 8;
  const x2 = NODE_X[index + 1]! - NODE_R - 8;
  const midX = (x1 + x2) / 2;
  const y = NODE_CY;

  return (
    <g className="pulso-hub-flow-arrow">
      {/* Línea */}
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke="#cbd5e1" strokeWidth={1.5} />
      {/* Punta */}
      <path
        d={`M ${x2 - 8} ${y - 4} L ${x2} ${y} L ${x2 - 8} ${y + 4} Z`}
        fill="#cbd5e1"
      />
      {/* Microcopy arriba de la flecha */}
      <text
        x={midX}
        y={y - 10}
        textAnchor="middle"
        fill="var(--pulso-text-soft)"
        className="pulso-hub-flow-arrow-text"
      >
        {copy}
      </text>
    </g>
  );
}
