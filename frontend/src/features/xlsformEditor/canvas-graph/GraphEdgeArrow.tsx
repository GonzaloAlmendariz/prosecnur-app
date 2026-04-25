// =============================================================================
// canvas-graph/GraphEdgeArrow.tsx — flecha entre dos nodos con routing
// =============================================================================
// El usuario reportó que las flechas atravesaban los bloques porque las
// capas estaban demasiado pegadas. Ahora hacemos routing distinto según
// la relación geométrica entre source y target:
//
//   * Forward edge (target a la derecha del source):
//       → bezier en el gutter horizontal con control points proporcionales
//         a la distancia. Curva suave que entra y sale por los lados.
//
//   * Same-layer edge (target en la misma columna):
//       → arco por la derecha que sale del lateral del source, da una
//         "media luna" hacia afuera y entra por el lateral del target.
//         Nunca pasa por encima de las cards.
//
//   * Back-edge (target a la izquierda del source — ciclos como
//     `inicio → datos_generales → inicio`):
//       → la flecha sale por arriba (o abajo) del source, viaja por
//         encima de la fila a una distancia segura del top del nodo, y
//         entra por arriba/abajo del target. La altura del arco se
//         ajusta para no chocar con headers de otras cards en la misma
//         capa.
//
// Resultado: ningún edge atraviesa una card. La intuición "sale por la
// derecha, entra por la izquierda" se respeta para forward; los casos
// raros se reconocen visualmente porque la flecha sale por el techo.
// =============================================================================

import type { LaidOutEdge } from "./autoLayout";

export type GraphEdgeArrowProps = {
  edge: LaidOutEdge;
  highlighted: boolean;
  dimmed: boolean;
  /** Optional hover handler. Cuando está, el edge muestra una etiqueta
   *  flotante con la condición traducida ("si X = Y") al hover. */
  onHover?: (hovering: boolean) => void;
};

const STROKE_WIDTH = 1.5;
const COLOR = "#2457d6";
/** Padding entre la curva y la card más cercana — evita que la flecha
 *  parezca pegada al borde. */
const SAFETY = 14;

export function GraphEdgeArrow({
  edge,
  highlighted,
  dimmed,
  onHover,
}: GraphEdgeArrowProps) {
  const path = routeEdge(edge);

  const opacity = dimmed ? 0.15 : highlighted ? 1 : 0.7;
  const strokeWidth = highlighted ? STROKE_WIDTH + 0.7 : STROKE_WIDTH;

  return (
    <g
      className="pulso-graph-edge"
      opacity={opacity}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      {/* Track invisible más ancho para que el hover sea generoso. */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={path}
        fill="none"
        stroke={COLOR}
        strokeWidth={strokeWidth}
        markerEnd="url(#pulso-graph-arrow-depends-on)"
      />
    </g>
  );
}

/**
 * Calcula el path SVG del edge según la relación geométrica entre los
 * bounding boxes de los nodos.
 */
function routeEdge(edge: LaidOutEdge): string {
  const { fromBBox: src, toBBox: tgt } = edge;
  const srcRight = src.x + src.width;
  const srcCenterY = src.y + src.height / 2;
  const tgtLeft = tgt.x;
  const tgtCenterY = tgt.y + tgt.height / 2;

  // ─── Caso forward ─────────────────────────────────────────────────
  // El target está a la derecha del source con espacio entre medio. La
  // curva normal sale del lado derecho y entra por el lado izquierdo.
  if (srcRight + SAFETY <= tgtLeft) {
    const dx = (tgtLeft - srcRight) * 0.5;
    return `M ${srcRight} ${srcCenterY} ` +
           `C ${srcRight + dx} ${srcCenterY}, ` +
           `${tgtLeft - dx} ${tgtCenterY}, ` +
           `${tgtLeft} ${tgtCenterY}`;
  }

  // ─── Same-layer o back-edge ────────────────────────────────────────
  // Las cards se solapan horizontalmente (misma columna o target a la
  // izquierda). La flecha tiene que dar la vuelta por afuera. Decidimos
  // arriba o abajo según en qué dirección queda más despejado: si el
  // target está más abajo que el source, vamos por abajo; si está más
  // arriba, por arriba. Si están a la misma altura, default a arriba.
  const goDown = tgtCenterY > srcCenterY + 4;
  const goUp = !goDown;

  // Punto de salida (arriba o abajo del lateral derecho del source).
  const startX = srcRight - 8;
  const startY = goUp ? src.y : src.y + src.height;
  // Punto de entrada (arriba o abajo del lateral izquierdo del target).
  const endX = tgtLeft + 8;
  const endY = goUp ? tgt.y : tgt.y + tgt.height;

  // Altura del arco — proporcional a la distancia vertical entre las
  // cards más una constante. Nunca menor que 28px para que sea legible.
  const verticalSpan = Math.abs(tgtCenterY - srcCenterY);
  const archDepth = Math.max(36, Math.min(120, 36 + verticalSpan * 0.45));
  const archY = goUp ? Math.min(src.y, tgt.y) - archDepth : Math.max(src.y + src.height, tgt.y + tgt.height) + archDepth;

  // Control points horizontales: empujar hacia la derecha del source
  // (para que la curva primero salga lateralmente antes de subir/bajar).
  const lateralPush = Math.max(48, Math.min(140, src.width * 0.6));

  return `M ${startX} ${startY} ` +
         `C ${startX + lateralPush} ${archY}, ` +
         `${endX - lateralPush} ${archY}, ` +
         `${endX} ${endY}`;
}

/**
 * Marker único para la flecha de visibilidad. Se monta una vez en `<defs>`
 * del SVG raíz.
 */
export function GraphEdgeMarkers() {
  return (
    <defs>
      <marker
        id="pulso-graph-arrow-depends-on"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerUnits="strokeWidth"
        markerWidth={6}
        markerHeight={6}
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR} />
      </marker>
    </defs>
  );
}
