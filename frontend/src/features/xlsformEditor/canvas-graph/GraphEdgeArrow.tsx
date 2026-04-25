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
  /** Expresión `relevant` del target — para detectar si es la
   *  expresión genérica (`${X} != ''`, color neutro) y para fallback
   *  por hash si no se proveyó `colorIndex`. */
  relevantExpression: string | null;
  /** Índice estable de Tableau-10 según orden de aparición (provisto
   *  por el layout). Si está, se usa directamente: dos expresiones
   *  distintas reciben colores distintos garantizadamente. Si es
   *  null, se usa el color neutro. Si es `undefined`, fallback al
   *  hash legacy (compatibilidad). */
  colorIndex?: number | null | undefined;
  highlighted: boolean;
  dimmed: boolean;
  /** Si true, este edge acaba de aparecer (drag-arrow finalizado) y se
   *  reproduce una animación corta de "pulse" para feedback. */
  justAppeared?: boolean;
  /** Index dentro del layout — usado para stagger de aparición
   *  inicial. Edges con index alto entran un poco después. */
  appearanceIndex?: number;
  /** Si true, este edge fue clicado y está aislado — render extra
   *  con halo glow y stroke ligeramente más ancho para destacarlo
   *  contra los edges atenuados. */
  isSelected?: boolean;
  onHover?: (hovering: boolean) => void;
  /** Click en la rama → aísla esa relación (otras se atenúan). */
  onClick?: () => void;
};

/** [Deprecado] Antes usábamos dashed para var↔var. El usuario
 *  reportó: "en la condición roja aún hay un dashed line cuando no
 *  es una condición del rojo" — el dasharray dentro de un mismo
 *  bundle generaba inconsistencia visual (algunas ramas dashed,
 *  otras solid). Y la punta de flecha también se distinguía menos
 *  con dashes. Ahora TODOS los edges van sólidos; el color y el
 *  bundle ya diferencian tipos suficientemente. */
function isVarToVar(_relation: string): boolean {
  return false;
}

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

const STROKE_WIDTH = 1.9;

export function GraphEdgeArrow({
  edge,
  relevantExpression,
  colorIndex,
  highlighted,
  dimmed,
  justAppeared,
  appearanceIndex = 0,
  isSelected,
  onHover,
  onClick,
}: GraphEdgeArrowProps) {
  // Color: prioridad al colorIndex provisto por el layout (orden de
  // aparición → sin colisiones para las primeras 10 condiciones). Si
  // no se proveyó (compat), fallback al hash legacy. Si la expresión
  // es genérica o nula, color neutro.
  const color =
    colorIndex == null
      ? colorForExpression(relevantExpression)
      : TABLEAU_10[colorIndex % TABLEAU_10.length]!;
  // Visibilidad base alta — antes 0.78 lucía "fantasma" sobre fondo
  // claro, en especial las dashed var↔var. Subimos a 0.95 para que
  // el trazo se lea como "primera capa" del lienzo. El dim sigue
  // siendo agresivo (0.16) para que el contraste de selección se
  // mantenga.
  const opacity = dimmed ? 0.16 : highlighted ? 1 : 0.95;
  const strokeWidth = isSelected
    ? STROKE_WIDTH + 1.2
    : highlighted
      ? STROKE_WIDTH + 0.8
      : STROKE_WIDTH;
  // Dashed por TIPO de dependencia, no por var-to-var.
  // - depends-on (visibilidad/relevant): sólido (más prominente).
  // - constrained-by: dashed largo (refleja "restricción").
  // - calculated-from: dotted (refleja "cálculo").
  // - choice-filter: dash-dot (refleja "filtro").
  // El color sigue siendo por expresión (Tableau-10) — el dasharray
  // diferencia el TIPO sin perder la identidad cromática del bundle.
  const k = edge.edge.kind;
  const dashArray =
    k === "constrained-by"
      ? "8 5"
      : k === "calculated-from"
        ? "2 4"
        : k === "choice-filter"
          ? "8 3 2 3"
          : isVarToVar(edge.edge.relation)
            ? undefined
            : undefined;

  return (
    <g
      className={`pulso-graph-edge ${justAppeared ? "is-fresh" : ""} ${
        onClick ? "is-clickable" : ""
      } ${isSelected ? "is-selected" : ""}`}
      opacity={opacity}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={{
        ...(onClick ? { cursor: "pointer" } : {}),
        // Stagger de aparición inicial — cada edge entra ~25ms después
        // del anterior. Cap a 1.2s para que formularios grandes no
        // tarden eternamente en mostrar todo.
        animationDelay: `${Math.min(appearanceIndex * 25, 1200)}ms`,
      }}
    >
      {/* Track invisible más ancho para hover generoso. */}
      <path d={edge.path} fill="none" stroke="transparent" strokeWidth={14} />
      {/* Halo glow detrás del trazo cuando el edge está seleccionado.
          Se renderiza ANTES del trazo principal para quedar debajo.
          Usa el mismo color con alpha bajo y stroke ancho. */}
      {isSelected && (
        <path
          d={edge.path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 8}
          strokeOpacity={0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
      <path
        d={edge.path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
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
          viewBox="0 0 12 12"
          refX={11}
          refY={6}
          markerUnits="strokeWidth"
          markerWidth={8}
          markerHeight={8}
          orient="auto"
        >
          {/* Triángulo más afilado y prominente: viewBox 12×12 vs
              10×10 anterior, markerWidth 8 vs 6. Refleja "punta de
              flecha clara" reportado como difícil de distinguir. */}
          <path
            d="M 0 1 L 12 6 L 0 11 L 2 6 z"
            fill={color}
            stroke={color}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        </marker>
      ))}
    </defs>
  );
}
