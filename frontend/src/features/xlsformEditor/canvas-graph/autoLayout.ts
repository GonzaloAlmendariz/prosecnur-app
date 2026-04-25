// =============================================================================
// canvas-graph/autoLayout.ts — layout vertical estilo `GraficarSecciones`
// =============================================================================
// Inspirado en `api/R/validacion_read_xlsform.R::GraficarSecciones`, que
// dibuja las secciones del XLSForm como columna vertical con flechas en L
// pasando por carriles a la derecha.
//
// Diseño anterior: capas horizontales tipo Sugiyama. Las flechas eran
// beziers diagonales que en archivos del corpus terminaban atravesando
// cards vecinas y forzando arcos por arriba/abajo.
//
// Diseño nuevo:
//
//   * Una sola columna vertical de cards. Cada nodo top-level visible
//     ocupa una fila (rowHeight + rowGap). Si una sección está
//     expandida, sus children se renderean indentados en filas
//     adicionales debajo del header.
//
//   * Espacio "channel" a la derecha de las cards. Las flechas viven
//     ahí — nunca pasan por encima ni por debajo de las cards.
//
//   * Cada flecha es una L de tres tramos:
//       1. salida horizontal del lateral derecho del source,
//       2. tramo vertical en un carril asignado dentro del channel,
//       3. entrada horizontal por el lateral derecho del target.
//
//   * Asignación de carriles greedy: ordenamos edges por minY, asignamos
//     a cada uno el primer carril libre. Así dos edges con spans que
//     no se solapan verticalmente comparten carril, y los que sí
//     se solapan reciben carriles separados — sin cruces.
// =============================================================================

import type { GraphEdge, GraphNode, LogicGraph } from "./buildGraph";

export type LaidOutNode = {
  node: GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  visible: boolean;
};

/**
 * Edge ya laid out con todo lo que el render necesita: el path SVG,
 * los bbox del source y target (para el detail panel y el tooltip),
 * y un punto medio (apex del carril) para anclar la etiqueta de hover.
 */
export type LaidOutEdge = {
  edge: GraphEdge;
  /** Path SVG `d` ya construido — la flecha es una L horizontal-vertical-
   *  horizontal con esquinas redondeadas. */
  path: string;
  /** Punto medio del tramo vertical en el carril — anclaje del tooltip. */
  midX: number;
  midY: number;
  fromBBox: { x: number; y: number; width: number; height: number };
  toBBox: { x: number; y: number; width: number; height: number };
};

export type LaidOutGraph = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
};

export type LayoutOptions = {
  nodeWidth: number;
  /** Altura de la card colapsada (header). */
  rowHeight: number;
  /** Espacio vertical entre filas. */
  rowGap: number;
  /** Indent horizontal de un nodo hijo respecto a su padre. */
  childIndent: number;
  /** Espacio entre el cuerpo de las cards y el primer carril del channel. */
  channelGap: number;
  /** Espacio entre carriles consecutivos del channel. */
  laneGap: number;
  /** Radio de las esquinas redondeadas en los paths L. */
  cornerRadius: number;
  /** Padding interno en cards de sección expandida. */
  innerGap: number;
  marginX: number;
  marginY: number;
};

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 280,
  rowHeight: 56,
  rowGap: 14,
  childIndent: 20,
  channelGap: 28,
  laneGap: 22,
  cornerRadius: 10,
  innerGap: 12,
  marginX: 40,
  marginY: 40,
};

export function layoutLogicGraph(
  graph: LogicGraph,
  expandedSectionIds: Set<string>,
  /** Posiciones manuales que sobrescriben el layout automático. Cuando
   *  el usuario arrastra una card, guardamos su posición acá; el layout
   *  respeta el override y recalcula los edges contra esa posición.
   *  Si una card no tiene override, cae al layout greedy. */
  positionOverrides: Map<string, { x: number; y: number }> = new Map(),
  optionsOverride: Partial<LayoutOptions> = {},
): LaidOutGraph {
  const options = { ...DEFAULT_OPTIONS, ...optionsOverride };
  const { rootNodes, edges } = graph;

  if (rootNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // ── 1. Layout vertical: una columna, cards en orden ──────────────────
  // Recorremos los rootNodes en orden. Para cada uno colocamos su card
  // en (marginX, currentY) y avanzamos currentY. Si es sección expandida,
  // recursivamente colocamos children indentados.
  const flatNodes: LaidOutNode[] = [];
  const positionByNodeId = new Map<string, LaidOutNode>();
  let currentY = options.marginY;

  const placeNode = (node: GraphNode, depth: number, visible: boolean) => {
    if (!visible) {
      // Sections colapsadas: registramos los descendientes como "no visibles"
      // para que `resolveVisibleAncestor` pueda saltar al ancestro visible.
      flatNodes.push({
        node,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        depth,
        visible: false,
      });
      positionByNodeId.set(node.id, flatNodes[flatNodes.length - 1]!);
      if (node.kind === "section") {
        for (const child of node.children) placeNode(child, depth + 1, false);
      }
      return;
    }

    const x = options.marginX + depth * options.childIndent;
    const y = currentY;
    const placed: LaidOutNode = {
      node,
      x,
      y,
      width: options.nodeWidth - depth * options.childIndent,
      height: options.rowHeight,
      depth,
      visible: true,
    };
    flatNodes.push(placed);
    positionByNodeId.set(node.id, placed);
    currentY += options.rowHeight + options.rowGap;

    if (
      node.kind === "section" &&
      expandedSectionIds.has(node.id) &&
      node.children.length > 0
    ) {
      for (const child of node.children) placeNode(child, depth + 1, true);
    } else if (node.kind === "section") {
      // Sección colapsada: registrar hijos como no visibles.
      for (const child of node.children) placeNode(child, depth + 1, false);
    }
  };

  for (const root of rootNodes) placeNode(root, 0, true);

  // ── 1.5 Aplicar overrides manuales del usuario ─────────────────────
  // Si el usuario arrastró una card, su posición se respeta como
  // (x, y) absolutos. El resto sigue con su posición greedy.
  if (positionOverrides.size > 0) {
    for (const placed of flatNodes) {
      if (!placed.visible) continue;
      const override = positionOverrides.get(placed.node.id);
      if (override) {
        placed.x = override.x;
        placed.y = override.y;
      }
    }
  }

  // ── 2. Resolver edges al ancestro visible más cercano ───────────────
  // Si A.relevant referencia B y B está dentro de una sección colapsada,
  // el edge va al header de la sección colapsada. Igual al diseño previo,
  // pero aquí el lookup es trivial porque ya tenemos el árbol.
  const parentByChildId = new Map<string, GraphNode>();
  const indexParents = (n: GraphNode, seen = new Set<string>()) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    for (const child of n.children) {
      parentByChildId.set(child.id, n);
      indexParents(child, seen);
    }
  };
  for (const root of rootNodes) indexParents(root);

  const resolveVisible = (id: string): LaidOutNode | null => {
    let cursor: GraphNode | null = positionByNodeId.get(id)?.node ?? null;
    let safety = 64;
    while (cursor && safety-- > 0) {
      const placed = positionByNodeId.get(cursor.id);
      if (placed && placed.visible) return placed;
      cursor = parentByChildId.get(cursor.id) ?? null;
    }
    return null;
  };

  // ── 3. Pre-calcular endpoints de cada edge ─────────────────────────
  type ResolvedEdge = {
    edge: GraphEdge;
    src: LaidOutNode;
    tgt: LaidOutNode;
    srcRight: number;
    srcMidY: number;
    tgtRight: number;
    tgtMidY: number;
    minY: number;
    maxY: number;
    /** Asignado en la pasada de carriles. */
    laneIdx: number;
  };

  const resolved: ResolvedEdge[] = [];
  const seenPair = new Set<string>(); // dedupe cuando dos edges colapsan al mismo par
  for (const edge of edges) {
    const src = resolveVisible(edge.source);
    const tgt = resolveVisible(edge.target);
    if (!src || !tgt || src === tgt) continue;
    const key = `${src.node.id}->${tgt.node.id}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);

    const srcRight = src.x + src.width;
    const tgtRight = tgt.x + tgt.width;
    const srcMidY = src.y + src.height / 2;
    const tgtMidY = tgt.y + tgt.height / 2;
    resolved.push({
      edge,
      src,
      tgt,
      srcRight,
      srcMidY,
      tgtRight,
      tgtMidY,
      minY: Math.min(srcMidY, tgtMidY),
      maxY: Math.max(srcMidY, tgtMidY),
      laneIdx: 0,
    });
  }

  // ── 4. Asignación greedy de carriles ───────────────────────────────
  // Ordenamos edges por su minY (cuál empieza más arriba). Para cada
  // uno, asignamos el primer carril cuyo último maxY sea menor que
  // nuestro minY (el carril está "libre" desde donde empezamos).
  // Resultado: ningún tramo vertical se solapa con otro en el mismo
  // carril → no hay cruces de líneas verticales.
  const sortedByMin = [...resolved].sort((a, b) => a.minY - b.minY);
  const laneLastMaxY: number[] = []; // laneLastMaxY[i] = último maxY usado en ese carril
  for (const r of sortedByMin) {
    let chosen = -1;
    for (let l = 0; l < laneLastMaxY.length; l += 1) {
      if (laneLastMaxY[l]! < r.minY) {
        chosen = l;
        break;
      }
    }
    if (chosen === -1) {
      chosen = laneLastMaxY.length;
      laneLastMaxY.push(0);
    }
    laneLastMaxY[chosen] = r.maxY;
    r.laneIdx = chosen;
  }

  // ── 5. Calcular x del channel y construir paths ────────────────────
  // El channel arranca a la derecha de la card más a la derecha. Si el
  // usuario arrastró cards, alguna puede estar muy a la derecha; el
  // channel se mueve para no atravesarlas.
  let maxRight = options.marginX;
  let maxBottom = options.marginY;
  for (const placed of flatNodes) {
    if (!placed.visible) continue;
    const right = placed.x + placed.width;
    if (right > maxRight) maxRight = right;
    const bottom = placed.y + placed.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  const channelStart = maxRight + options.channelGap;
  const totalLanes = Math.max(1, laneLastMaxY.length);

  const laidOutEdges: LaidOutEdge[] = resolved.map((r) => {
    const laneX = channelStart + r.laneIdx * options.laneGap;
    const path = buildLPath(
      r.srcRight,
      r.srcMidY,
      laneX,
      r.tgtRight,
      r.tgtMidY,
      options.cornerRadius,
    );
    return {
      edge: r.edge,
      path,
      midX: laneX,
      midY: (r.srcMidY + r.tgtMidY) / 2,
      fromBBox: {
        x: r.src.x,
        y: r.src.y,
        width: r.src.width,
        height: r.src.height,
      },
      toBBox: {
        x: r.tgt.x,
        y: r.tgt.y,
        width: r.tgt.width,
        height: r.tgt.height,
      },
    };
  });

  // ── 6. Tamaño total ────────────────────────────────────────────────
  // Cuando hay overrides, el width/height se calcula según la card más
  // a la derecha/abajo (puede haberse movido fuera del rango greedy).
  const channelEnd = channelStart + totalLanes * options.laneGap;
  const width = Math.max(channelEnd + options.marginX, maxRight + options.marginX);
  const height = Math.max(currentY - options.rowGap + options.marginY, maxBottom + options.marginY);

  return { nodes: flatNodes, edges: laidOutEdges, width, height };
}

/**
 * Construye el SVG `d` de una flecha en L:
 *   M srcRight srcY
 *   L laneX-r srcY                 ─── tramo horizontal
 *   A r r 0 0 sweep1 laneX srcY±r  ─── esquina redondeada
 *   L laneX tgtY∓r                 ─── tramo vertical en el carril
 *   A r r 0 0 sweep2 laneX-r tgtY  ─── esquina redondeada
 *   L tgtRight tgtY                ─── tramo horizontal de entrada
 *
 * sweep depende de si el target está arriba o abajo del source.
 */
function buildLPath(
  srcRight: number,
  srcY: number,
  laneX: number,
  tgtRight: number,
  tgtY: number,
  r: number,
): string {
  const goingDown = tgtY > srcY;
  // Si los puntos están a la misma altura, no hay L — recta horizontal
  // pasando por el carril.
  const sameLevel = Math.abs(tgtY - srcY) < 1;

  if (sameLevel) {
    return `M ${srcRight} ${srcY} L ${laneX} ${srcY} L ${tgtRight} ${srcY}`;
  }

  // Limitamos el radio a la mitad del tramo horizontal y vertical
  // mínimo para evitar que la curva colapse cuando el espacio es chico.
  const horizontalRoom = Math.min(
    Math.abs(laneX - srcRight),
    Math.abs(laneX - tgtRight),
  );
  const verticalRoom = Math.abs(tgtY - srcY);
  const radius = Math.max(2, Math.min(r, horizontalRoom * 0.45, verticalRoom * 0.45));

  // Sweep flag: en SVG arc, 1 = clockwise.
  // Vamos del source hacia el carril (este es horizontal-derecha) y luego
  // verticalmente. Si vamos abajo, el cuarto de círculo es CW (sweep=1).
  // Si vamos arriba, es CCW (sweep=0).
  const sweep1 = goingDown ? 1 : 0;
  // Después del tramo vertical, vamos del carril al target. Si target
  // está abajo (goingDown), el segundo arco es desde abajo-arriba en X
  // del carril hacia la izquierda — es CW si tgtRight < laneX.
  const tgtIsLeftOfLane = tgtRight < laneX;
  const sweep2 = goingDown ? (tgtIsLeftOfLane ? 1 : 0) : (tgtIsLeftOfLane ? 0 : 1);

  // Coordenadas para los puntos de inflexión (entrada/salida de cada arco).
  const corner1Y = goingDown ? srcY + radius : srcY - radius;
  const corner2Y = goingDown ? tgtY - radius : tgtY + radius;
  // Hacia dónde sale el segundo tramo horizontal: si tgtRight < laneX
  // venimos desde la derecha del target (entra por la derecha, no la
  // izquierda — convención del graficador R donde back-edges entran
  // por el carril).
  const corner1Xexit = laneX;
  const corner2Xexit = laneX;
  // Pre-arc x del primer arco: una unidad de radius antes del carril.
  const preArc1X = laneX - radius;
  // Post-arc x del segundo arco: una unidad de radius antes del carril
  // (por la izquierda, ya que estamos volviendo del carril hacia el target).
  const postArc2X = laneX - radius;

  return [
    `M ${srcRight} ${srcY}`,
    `L ${preArc1X} ${srcY}`,
    `A ${radius} ${radius} 0 0 ${sweep1} ${corner1Xexit} ${corner1Y}`,
    `L ${laneX} ${corner2Y}`,
    `A ${radius} ${radius} 0 0 ${sweep2} ${postArc2X} ${tgtY}`,
    `L ${tgtRight} ${tgtY}`,
  ].join(" ");
}
