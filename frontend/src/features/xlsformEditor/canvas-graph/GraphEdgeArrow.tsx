// =============================================================================
// canvas-graph/GraphEdgeArrow.tsx — flecha pre-laid-out, color por condición
// =============================================================================
// Cambios respecto al diseño anterior:
//
//   * Líneas SÓLIDAS — eliminamos los dasharray. Resultaban visualmente
//     ruidosas y no aportaban al sistema de colores.
//
//   * Color por hash de la expresión `relevant`. Dos flechas que vienen
//     de la misma condición exacta (ej. dos preguntas con `relevant =
//     ${apoderado} = '2'`) reciben el MISMO color. Distintas condiciones
//     reciben colores distintos. Replica el comportamiento de
//     `GraficarSecciones` con su paleta Tableau 10.
//
//   * Si la expresión es la default genérica `${X} != ''` (la que el
//     canvas escribe al hacer drag-arrow sin picker), usamos el azul
//     primary neutro — no contamina la paleta categórica.
// =============================================================================

import type { LaidOutEdge } from "./autoLayout";

export type GraphEdgeArrowProps = {
  edge: LaidOutEdge;
  /** Expresión `relevant` del target — para colorear el edge según la
   *  condición que lo dispara. Cuando varios edges convergen al mismo
   *  target, todos comparten esta expresión y por ende el mismo color. */
  relevantExpression: string | null;
  highlighted: boolean;
  dimmed: boolean;
  /** Si true, este edge acaba de aparecer (drag-arrow finalizado) y se
   *  reproduce una animación corta de "pulse" para feedback. */
  justAppeared?: boolean;
  onHover?: (hovering: boolean) => void;
};

/**
 * Paleta categórica Tableau-10 — la misma que usa `GraficarSecciones`
 * en R/ggplot. Ofrece contraste razonable sobre fondo blanco.
 */
const TABLEAU_10 = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
];

/** Color neutro para flechas con expresión genérica `${X} != ''`. */
const NEUTRAL_COLOR = "#2457d6";

/**
 * Hash determinístico string → índice. Misma fórmula que el resto del
 * editor para colorear secciones por nombre.
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Detecta si una expresión es la "genérica por defecto" del drag-arrow.
 *  Esas no aportan información categórica — color neutro. */
function isGenericExpression(expr: string): boolean {
  // Forma `${name} != ''` posiblemente con espacios.
  return /^\s*\$\{[^}]+\}\s*!=\s*''\s*$/.test(expr);
}

export function colorForExpression(expr: string | null): string {
  if (!expr || isGenericExpression(expr)) return NEUTRAL_COLOR;
  const h = hashString(expr.trim());
  return TABLEAU_10[h % TABLEAU_10.length]!;
}

const STROKE_WIDTH = 1.5;

export function GraphEdgeArrow({
  edge,
  relevantExpression,
  highlighted,
  dimmed,
  justAppeared,
  onHover,
}: GraphEdgeArrowProps) {
  const color = colorForExpression(relevantExpression);
  const opacity = dimmed ? 0.18 : highlighted ? 1 : 0.78;
  const strokeWidth = highlighted ? STROKE_WIDTH + 0.7 : STROKE_WIDTH;

  return (
    <g
      className={`pulso-graph-edge ${justAppeared ? "is-fresh" : ""}`}
      opacity={opacity}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      {/* Track invisible más ancho para hover generoso. */}
      <path d={edge.path} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={edge.path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#pulso-graph-arrow-${markerIdFor(color)})`}
      />
    </g>
  );
}

/**
 * Markers SVG dinámicos: uno por color que aparece en el grafo. El id
 * del marker es derivado del color (sin '#') para que SVG los pueda
 * referenciar via `url(#...)`. Generamos los markers para toda la
 * paleta Tableau-10 + el neutral, así no hace falta indexar en runtime.
 */
function markerIdFor(color: string): string {
  return `c-${color.replace("#", "").toLowerCase()}`;
}

export function GraphEdgeMarkers() {
  const palette = [...TABLEAU_10, NEUTRAL_COLOR];
  return (
    <defs>
      {palette.map((color) => (
        <marker
          key={color}
          id={`pulso-graph-arrow-${markerIdFor(color)}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerUnits="strokeWidth"
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}
