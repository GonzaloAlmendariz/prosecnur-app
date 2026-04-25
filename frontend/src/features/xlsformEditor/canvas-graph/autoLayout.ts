// =============================================================================
// canvas-graph/autoLayout.ts — layout horizontal "kanban-style"
// =============================================================================
// Cambio respecto al diseño anterior (vertical en una columna): las
// secciones top-level fluyen en una FILA HORIZONTAL, lado a lado. Cuando
// el usuario expande una sección, sus variables se despliegan VERTICAL
// hacia abajo, indentadas. Esto refleja mejor la mentalidad "cada
// sección es una pieza del cuestionario" y permite ver muchas secciones
// de un vistazo.
//
// Estructura visual:
//
//   [ Sec A   ▾ ]   [ Sec B   ▸ ]   [ Sec C   ▾ ]   [ Sec D   ▸ ]
//   │  v1       │                   │  v1       │
//   │  v2       │                   │  v2       │
//   │  v3       │                   │  v3       │
//                                   │  v4       │
//
// Edges:
//
//   * Cada edge sale por el lateral DERECHO del source y entra por el
//     lateral IZQUIERDO del target — bezier suave en el espacio
//     horizontal entre ambos. Los control points son proporcionales a
//     la distancia para que la curva sea natural.
//
//   * Si varios edges llegan al mismo target o salen del mismo source,
//     sus anchors se DISTRIBUYEN VERTICALMENTE sobre el borde para
//     que cada uno se vea separado. Igual que el `off_map` de
//     `GraficarSecciones` cuando varias condiciones confluyen.
//
//   * Si target queda atrás del source (back-edge raro), la curva
//     arquea por arriba/abajo del bloque entero.
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

export type LaidOutEdge = {
  edge: GraphEdge;
  /** Path SVG `d` precomputado. */
  path: string;
  /** Punto medio del path — anclaje del tooltip de hover. */
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
  /** Ancho de cada columna top-level (sección o pregunta sin sección). */
  columnWidth: number;
  /** Altura del header (card colapsada). */
  rowHeight: number;
  /** Espacio horizontal entre columnas top-level. */
  columnGap: number;
  /** Espacio vertical entre header de sección y sus variables expandidas. */
  innerHeadGap: number;
  /** Espacio vertical entre variables internas. */
  innerRowGap: number;
  /** Indentación horizontal de las variables dentro de su sección. */
  childIndent: number;
  /** Margen exterior. */
  marginX: number;
  marginY: number;
  /** Radio de las esquinas de las flechas redondeadas. */
  cornerRadius: number;
};

const DEFAULT_OPTIONS: LayoutOptions = {
  columnWidth: 240,
  rowHeight: 60,
  columnGap: 56,
  innerHeadGap: 14,
  innerRowGap: 10,
  childIndent: 14,
  marginX: 48,
  marginY: 56,
  cornerRadius: 12,
};

export function layoutLogicGraph(
  graph: LogicGraph,
  expandedSectionIds: Set<string>,
  positionOverrides: Map<string, { x: number; y: number }> = new Map(),
  optionsOverride: Partial<LayoutOptions> = {},
): LaidOutGraph {
  const options = { ...DEFAULT_OPTIONS, ...optionsOverride };
  const { rootNodes, edges } = graph;

  if (rootNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const flatNodes: LaidOutNode[] = [];
  const positionByNodeId = new Map<string, LaidOutNode>();

  // ── 1. Layout horizontal: cada root node ocupa una columna ─────────
  // Recorremos los rootNodes y los colocamos lado a lado horizontalmente.
  // Si un root es sección expandida, sus children se despliegan
  // verticalmente debajo del header de la sección, indentados.
  let cursorX = options.marginX;

  const heightOfChildren = (node: GraphNode): number => {
    if (node.kind !== "section") return 0;
    if (node.children.length === 0) return 0;
    let h = 0;
    for (let i = 0; i < node.children.length; i += 1) {
      if (i > 0) h += options.innerRowGap;
      h += options.rowHeight; // children siempre se ven como rows colapsadas
    }
    return h;
  };

  const placeChild = (
    child: GraphNode,
    columnX: number,
    childY: number,
  ): number => {
    // Children se renderean a misma columna, indentados — el ancho útil
    // baja un poco para que se vea "dentro de" la sección.
    const placed: LaidOutNode = {
      node: child,
      x: columnX + options.childIndent,
      y: childY,
      width: options.columnWidth - options.childIndent * 2,
      height: options.rowHeight,
      depth: 1,
      visible: true,
    };
    flatNodes.push(placed);
    positionByNodeId.set(child.id, placed);
    return childY + options.rowHeight;
  };

  const registerHidden = (node: GraphNode, depth: number) => {
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
      for (const child of node.children) registerHidden(child, depth + 1);
    }
  };

  for (const root of rootNodes) {
    const x = cursorX;
    const y = options.marginY;
    const isExpanded =
      root.kind === "section" &&
      expandedSectionIds.has(root.id) &&
      root.children.length > 0;
    const totalHeight = isExpanded
      ? options.rowHeight + options.innerHeadGap + heightOfChildren(root)
      : options.rowHeight;

    const placed: LaidOutNode = {
      node: root,
      x,
      y,
      width: options.columnWidth,
      height: totalHeight,
      depth: 0,
      visible: true,
    };
    flatNodes.push(placed);
    positionByNodeId.set(root.id, placed);

    if (isExpanded) {
      let childY = y + options.rowHeight + options.innerHeadGap;
      for (let i = 0; i < root.children.length; i += 1) {
        if (i > 0) childY += options.innerRowGap;
        childY = placeChild(root.children[i]!, x, childY);
      }
    } else if (root.kind === "section") {
      // Sección colapsada: registrar children invisibles (para que las
      // edges puedan resolverse al ancestro visible).
      for (const child of root.children) registerHidden(child, 1);
    }

    cursorX = x + options.columnWidth + options.columnGap;
  }

  // ── 1.5 Aplicar overrides manuales ─────────────────────────────────
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

  // ── 3. Resolver edges + agrupar por target/source para offset ──────
  type ResolvedEdge = {
    edge: GraphEdge;
    src: LaidOutNode;
    tgt: LaidOutNode;
  };

  const resolved: ResolvedEdge[] = [];
  const seenPair = new Set<string>();
  for (const edge of edges) {
    const src = resolveVisible(edge.source);
    const tgt = resolveVisible(edge.target);
    if (!src || !tgt || src === tgt) continue;
    const key = `${src.node.id}->${tgt.node.id}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    resolved.push({ edge, src, tgt });
  }

  // Cuántos edges entran a cada target / salen de cada source.
  // Cuando hay varios, distribuimos sus anchors verticalmente sobre el
  // borde de la card para que cada flecha se vea separada (igual que
  // hace `GraficarSecciones` con su `off_map`).
  const edgesByTarget = new Map<string, ResolvedEdge[]>();
  const edgesBySource = new Map<string, ResolvedEdge[]>();
  for (const r of resolved) {
    if (!edgesByTarget.has(r.tgt.node.id)) edgesByTarget.set(r.tgt.node.id, []);
    edgesByTarget.get(r.tgt.node.id)!.push(r);
    if (!edgesBySource.has(r.src.node.id)) edgesBySource.set(r.src.node.id, []);
    edgesBySource.get(r.src.node.id)!.push(r);
  }

  /** Calcula el offset vertical para el i-ésimo de N edges en el borde
   *  de una card de altura `cardHeight`. Distribuye uniformemente
   *  dentro del 60% central (deja 20% arriba y abajo libres). */
  const anchorOffset = (
    indexInGroup: number,
    groupSize: number,
    cardHeight: number,
  ): number => {
    if (groupSize <= 1) return cardHeight / 2;
    const usable = Math.min(cardHeight * 0.6, options.rowHeight * 0.6);
    const start = (cardHeight - usable) / 2;
    return start + (indexInGroup * usable) / (groupSize - 1);
  };

  // ── 4. Construir paths ─────────────────────────────────────────────
  const laidOutEdges: LaidOutEdge[] = resolved.map((r) => {
    const targetGroup = edgesByTarget.get(r.tgt.node.id) ?? [r];
    const sourceGroup = edgesBySource.get(r.src.node.id) ?? [r];
    const tgtIdx = targetGroup.indexOf(r);
    const srcIdx = sourceGroup.indexOf(r);

    // Anclas. Para cards expandidas (section + children), los anchors se
    // pegan al header (rowHeight), no al alto total.
    const srcHeaderH = Math.min(r.src.height, options.rowHeight);
    const tgtHeaderH = Math.min(r.tgt.height, options.rowHeight);
    const fromY = r.src.y + anchorOffset(srcIdx, sourceGroup.length, srcHeaderH);
    const toY = r.tgt.y + anchorOffset(tgtIdx, targetGroup.length, tgtHeaderH);

    const path = routeEdge(
      {
        srcX: r.src.x + r.src.width,
        srcY: fromY,
        tgtX: r.tgt.x,
        tgtY: toY,
        srcBBox: r.src,
        tgtBBox: r.tgt,
      },
      options,
    );

    return {
      edge: r.edge,
      path: path.d,
      midX: path.midX,
      midY: path.midY,
      fromBBox: {
        x: r.src.x,
        y: r.src.y,
        width: r.src.width,
        height: srcHeaderH,
      },
      toBBox: {
        x: r.tgt.x,
        y: r.tgt.y,
        width: r.tgt.width,
        height: tgtHeaderH,
      },
    };
  });

  // ── 5. Tamaño total ────────────────────────────────────────────────
  let maxRight = options.marginX;
  let maxBottom = options.marginY;
  for (const placed of flatNodes) {
    if (!placed.visible) continue;
    const right = placed.x + placed.width;
    if (right > maxRight) maxRight = right;
    const bottom = placed.y + placed.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  const width = maxRight + options.marginX;
  const height = maxBottom + options.marginY;

  return { nodes: flatNodes, edges: laidOutEdges, width, height };
}

// ─────────────────────────────────────────────────────────────────────
// Routing de un edge en layout horizontal
// ─────────────────────────────────────────────────────────────────────
//
// Tres casos:
//
//   * Forward (target a la derecha del source): bezier suave en el
//     gutter horizontal. Control points a 50% de la distancia hacen
//     una curva natural.
//
//   * Same column (target en la misma columna que source): sale por
//     la derecha, arquea por la derecha y vuelve a entrar por la
//     derecha del target. Caso raro en layout horizontal — solo pasa
//     cuando dos variables internas de la misma sección se conectan.
//
//   * Back-edge (target a la izquierda del source): arco por arriba
//     o abajo del bloque entero, decidido según altura relativa.
// ─────────────────────────────────────────────────────────────────────

type RouteInput = {
  srcX: number;
  srcY: number;
  tgtX: number;
  tgtY: number;
  srcBBox: { x: number; y: number; width: number; height: number };
  tgtBBox: { x: number; y: number; width: number; height: number };
};

function routeEdge(
  r: RouteInput,
  options: LayoutOptions,
): { d: string; midX: number; midY: number } {
  const { srcX, srcY, tgtX, tgtY } = r;
  const dx = tgtX - srcX;

  // Forward edge — bezier estándar entre los dos lados.
  if (dx >= 24) {
    const half = dx * 0.5;
    const c1x = srcX + half;
    const c1y = srcY;
    const c2x = tgtX - half;
    const c2y = tgtY;
    const d = `M ${srcX} ${srcY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tgtX} ${tgtY}`;
    return { d, midX: (srcX + tgtX) / 2, midY: (srcY + tgtY) / 2 };
  }

  // Same-column o back-edge: arco por arriba o abajo.
  // Decidimos goUp/goDown según la altura relativa del target. Si están
  // a la misma altura, default a arriba.
  const goDown = tgtY > srcY + 4;
  const archDepth = Math.max(40, Math.min(140, Math.abs(tgtY - srcY) * 0.5 + 50));
  const archY = goDown
    ? Math.max(r.srcBBox.y + r.srcBBox.height, r.tgtBBox.y + r.tgtBBox.height) +
      archDepth
    : Math.min(r.srcBBox.y, r.tgtBBox.y) - archDepth;

  // Salida horizontal por la derecha del source, vuelta por arriba/abajo,
  // entrada por la derecha del target.
  const lateralReach = Math.max(60, Math.min(200, options.columnWidth * 0.55));
  const startX = srcX;
  const startY = srcY;
  const endX = tgtX + r.tgtBBox.width; // entra por la DERECHA del target
  const endY = tgtY;

  const c1x = startX + lateralReach;
  const c1y = archY;
  const c2x = endX + lateralReach;
  const c2y = archY;

  const d = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  return {
    d,
    midX: (startX + endX) / 2 + lateralReach * 0.5,
    midY: archY,
  };
}
