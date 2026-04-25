// =============================================================================
// canvas-graph/autoLayout.ts — layout horizontal + routing ortogonal con merge
// =============================================================================
// Iteración tras feedback del usuario:
//
//   * Las flechas son ORTOGONALES (segmentos H y V con esquinas
//     redondeadas), no beziers diagonales. Líneas rectas que viajan
//     por encima o por debajo del bloque de cards, nunca atravesándolo.
//
//   * Las flechas que terminan en una SECCIÓN entran por el TOP-CENTER
//     del header — visualmente "desembocan arriba en el medio". Las
//     que terminan en una VARIABLE entran por el lateral (izq forward,
//     der back-edge).
//
//   * MERGE POINT: cuando varios edges convergen al mismo target,
//     todos comparten el último tramo justo antes del target. El
//     efecto visual es Sankey/subway: las flechas se UNEN en una
//     sola línea antes de entrar.
//
//   * Para var↔var dentro de la MISMA sección expandida, hacemos
//     bezier arqueada por la derecha (más legible que un U-turn
//     ortogonal en espacio chico).
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
  /** Punto medio sugerido para anclar el tooltip — siempre OFFSET
   *  respecto al trazo para no chocar con cards. */
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
  columnWidth: number;
  rowHeight: number;
  columnGap: number;
  innerHeadGap: number;
  innerRowGap: number;
  childIndent: number;
  marginX: number;
  marginY: number;
  cornerRadius: number;
  /** Distancia entre el merge point y el target — es la longitud del
   *  "stem" final que comparten todas las flechas convergentes. */
  mergeOffset: number;
  /** Cuánto se sale lateral del source antes de subir/bajar — define
   *  la primera esquina del path ortogonal. */
  lateralBreakout: number;
  /** Distancia mínima de un lane horizontal por encima/debajo del
   *  bloque de cards para evitar atravesarlo. */
  blockClearance: number;
};

const DEFAULT_OPTIONS: LayoutOptions = {
  columnWidth: 240,
  rowHeight: 60,
  columnGap: 56,
  innerHeadGap: 14,
  innerRowGap: 10,
  childIndent: 14,
  marginX: 48,
  marginY: 70,
  cornerRadius: 10,
  mergeOffset: 22,
  lateralBreakout: 18,
  blockClearance: 28,
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

  // ── 1. Layout horizontal (idéntico a la versión anterior) ──────────
  let cursorX = options.marginX;

  const heightOfChildren = (node: GraphNode): number => {
    if (node.kind !== "section" || node.children.length === 0) return 0;
    let h = 0;
    for (let i = 0; i < node.children.length; i += 1) {
      if (i > 0) h += options.innerRowGap;
      h += options.rowHeight;
    }
    return h;
  };

  const placeChild = (
    child: GraphNode,
    columnX: number,
    childY: number,
  ): number => {
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

  // ── 2. Resolver edges al ancestro visible ──────────────────────────
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

  // ── 3. Resolver y agrupar por target ───────────────────────────────
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

  const edgesByTarget = new Map<string, ResolvedEdge[]>();
  for (const r of resolved) {
    if (!edgesByTarget.has(r.tgt.node.id)) edgesByTarget.set(r.tgt.node.id, []);
    edgesByTarget.get(r.tgt.node.id)!.push(r);
  }

  // ── 4. Bounding box vertical del bloque visible (para lanes) ───────
  // Lanes horizontales viajan ENCIMA o DEBAJO de todos los nodos
  // visibles, no entre ellos — así nunca atraviesan cards.
  let blockTop = Infinity;
  let blockBottom = -Infinity;
  for (const placed of flatNodes) {
    if (!placed.visible) continue;
    if (placed.y < blockTop) blockTop = placed.y;
    if (placed.y + placed.height > blockBottom) blockBottom = placed.y + placed.height;
  }
  if (!isFinite(blockTop)) blockTop = options.marginY;
  if (!isFinite(blockBottom)) blockBottom = options.marginY + options.rowHeight;

  // ── 5. Construir paths ─────────────────────────────────────────────
  const laidOutEdges: LaidOutEdge[] = resolved.map((r) => {
    const targetGroup = edgesByTarget.get(r.tgt.node.id) ?? [r];

    // Distribución de la salida en el source: si N edges salen del
    // mismo source, distribuimos verticalmente para que cada flecha
    // se vea separada en su origen aunque convergen al mismo merge
    // point del target.
    const sourceGroup = resolved.filter((e) => e.src.node.id === r.src.node.id);
    const srcIdx = sourceGroup.indexOf(r);
    const srcAnchor = anchorOnRight(r.src, srcIdx, sourceGroup.length, options.rowHeight);

    const tgtIdx = targetGroup.indexOf(r);
    const isSection = r.tgt.node.kind === "section";

    const pathInfo = routeOrthogonal({
      src: r.src,
      tgt: r.tgt,
      srcAnchor,
      tgtIsSection: isSection,
      tgtIdxInGroup: tgtIdx,
      tgtGroupSize: targetGroup.length,
      blockTop,
      blockBottom,
      options,
    });

    const tgtHeaderH = Math.min(r.tgt.height, options.rowHeight);
    const srcHeaderH = Math.min(r.src.height, options.rowHeight);
    return {
      edge: r.edge,
      path: pathInfo.d,
      midX: pathInfo.midX,
      midY: pathInfo.midY,
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

  // ── 6. Tamaño total ────────────────────────────────────────────────
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

/**
 * Distribuye verticalmente el ancla en el lateral derecho de una card
 * cuando hay varios edges saliendo. Para 1 edge → centro. Para N edges
 * → distribuidos en el 60% central del header.
 */
function anchorOnRight(
  card: LaidOutNode,
  indexInGroup: number,
  groupSize: number,
  headerH: number,
): { x: number; y: number } {
  const cardHeaderH = Math.min(card.height, headerH);
  let yOffset: number;
  if (groupSize <= 1) {
    yOffset = cardHeaderH / 2;
  } else {
    const usable = cardHeaderH * 0.6;
    const start = (cardHeaderH - usable) / 2;
    yOffset = start + (indexInGroup * usable) / (groupSize - 1);
  }
  return { x: card.x + card.width, y: card.y + yOffset };
}

// ─────────────────────────────────────────────────────────────────────
// Routing ortogonal — segmentos H/V con esquinas redondeadas.
// ─────────────────────────────────────────────────────────────────────
//
// Tres casos principales:
//
//   1. Forward (target a la derecha del source) + entrada top-center
//      a sección: H → V → H breve hasta el merge → V hasta el header.
//
//   2. Forward + entrada lateral a variable: H → V → H entrando por
//      el lateral izquierdo del target.
//
//   3. Back-edge / same-column: U-turn por arriba o abajo del bloque.
//
// Para var↔var dentro de una misma sección expandida (no es ninguno
// de los anteriores tal cual), el U-turn funciona también.
// ─────────────────────────────────────────────────────────────────────

type RouteInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcAnchor: { x: number; y: number };
  tgtIsSection: boolean;
  tgtIdxInGroup: number;
  tgtGroupSize: number;
  blockTop: number;
  blockBottom: number;
  options: LayoutOptions;
};

function routeOrthogonal(input: RouteInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const {
    src,
    tgt,
    srcAnchor,
    tgtIsSection,
    blockTop,
    blockBottom,
    options,
  } = input;
  const r = options.cornerRadius;
  const sX = srcAnchor.x;
  const sY = srcAnchor.y;

  // Punto de entrada al target. Para sección, top-center con stem
  // (mergeOffset arriba). Para variable, lateral izquierdo o derecho
  // según la geometría (forward vs back-edge).
  let tX: number;
  let tY: number;
  let mergeX: number;
  let mergeY: number;
  let entryDir: "top" | "left" | "right";

  if (tgtIsSection) {
    tX = tgt.x + tgt.width / 2;
    tY = tgt.y;
    mergeX = tX;
    mergeY = tY - options.mergeOffset;
    entryDir = "top";
  } else {
    const enterFromLeft = sX <= tgt.x - 8;
    if (enterFromLeft) {
      tX = tgt.x;
      tY = tgt.y + tgt.height / 2;
      mergeX = tX - options.mergeOffset;
      mergeY = tY;
      entryDir = "left";
    } else {
      tX = tgt.x + tgt.width;
      tY = tgt.y + tgt.height / 2;
      mergeX = tX + options.mergeOffset;
      mergeY = tY;
      entryDir = "right";
    }
  }

  // Decidimos cuál routing usar para llegar al merge point.
  const dx = mergeX - sX;
  const dy = mergeY - sY;
  const sameColumn = Math.abs(dx) < 30 && entryDir !== "top";

  // ─── Routing ────────────────────────────────────────────────────
  const segments: string[] = [`M ${sX} ${sY}`];
  let midX: number;
  let midY: number;

  if (sameColumn) {
    // Caso: misma columna o muy cerca. U-turn por la derecha del
    // source a la altura del target.
    const ext = options.lateralBreakout * 2;
    const turnX = sX + ext;
    appendSegment(segments, sX, sY, turnX, sY, r); // H breve
    appendSegment(segments, turnX, sY, turnX, mergeY, r); // V
    appendSegment(segments, turnX, mergeY, mergeX, mergeY, r); // H al merge
    appendSegment(segments, mergeX, mergeY, tX, tY, r); // entrada
    midX = turnX + 4;
    midY = (sY + mergeY) / 2;
  } else if (dx > 0 || (entryDir === "top" && dx > -options.columnWidth)) {
    // Forward o casi-forward. Path en L horizontal + vertical.
    // Decidimos si el codo va antes o después del cruce.

    if (entryDir === "top") {
      // Entra por arriba: H → V (subiendo al stem) → entrada vertical.
      // Verificamos que el camino no choca con otras cards entre
      // medio. Si la diferencia vertical es chica, podemos ir directo
      // al lane horizontal por encima del bloque y bajar al stem.
      const goAbove =
        sY > blockTop + 24 && // hay espacio arriba
        Math.abs(dx) > options.columnWidth * 0.6; // suficientemente lejos
      if (goAbove) {
        const laneY = blockTop - options.blockClearance;
        const ext = sX + options.lateralBreakout;
        appendSegment(segments, sX, sY, ext, sY, r);
        appendSegment(segments, ext, sY, ext, laneY, r);
        appendSegment(segments, ext, laneY, mergeX, laneY, r);
        appendSegment(segments, mergeX, laneY, mergeX, mergeY, r);
        appendSegment(segments, mergeX, mergeY, tX, tY, r); // stem
        midX = (ext + mergeX) / 2;
        midY = laneY;
      } else {
        // Path simple: H hasta mergeX, V hasta mergeY, entra al top.
        appendSegment(segments, sX, sY, mergeX, sY, r);
        appendSegment(segments, mergeX, sY, mergeX, mergeY, r);
        appendSegment(segments, mergeX, mergeY, tX, tY, r);
        midX = mergeX + 12;
        midY = (sY + mergeY) / 2;
      }
    } else {
      // Entrada lateral: simple L o "step".
      // Si dx > 0: H sale a (mergeX, sY), V baja a (mergeX, mergeY),
      //           H entra por izquierda del target.
      // Si dx ≈ 0: ya cubierto en sameColumn arriba.
      appendSegment(segments, sX, sY, mergeX, sY, r);
      appendSegment(segments, mergeX, sY, mergeX, mergeY, r);
      appendSegment(segments, mergeX, mergeY, tX, tY, r);
      midX = (sX + mergeX) / 2;
      midY = (sY + mergeY) / 2;
    }
  } else {
    // Back-edge: target detrás del source. U-turn POR ARRIBA o por
    // ABAJO según orientación.
    const goAbove = sY <= mergeY + 8; // si target está arriba o al mismo nivel, vamos por arriba
    const laneY = goAbove
      ? blockTop - options.blockClearance
      : blockBottom + options.blockClearance;
    const ext = sX + options.lateralBreakout;
    appendSegment(segments, sX, sY, ext, sY, r);
    appendSegment(segments, ext, sY, ext, laneY, r);
    appendSegment(segments, ext, laneY, mergeX, laneY, r);
    appendSegment(segments, mergeX, laneY, mergeX, mergeY, r);
    appendSegment(segments, mergeX, mergeY, tX, tY, r);
    midX = (ext + mergeX) / 2;
    midY = laneY;
  }

  // Anclaje del tooltip — un poco "fuera" del trazo para no chocar
  // con cards. Si midY está cerca del bloque, lo subimos/bajamos.
  const tooltipOffset = 14;
  const tooltipY =
    midY < blockTop ? midY - tooltipOffset : midY > blockBottom ? midY + tooltipOffset : midY;

  return { d: segments.join(" "), midX, midY: tooltipY };
}

/**
 * Agrega un segmento ortogonal (horizontal o vertical) con esquina
 * redondeada al final si la dirección cambia. La esquina solo se
 * inserta si no es el primer punto y hay cambio de dirección. Para
 * simplicidad, siempre agregamos arc + line; el SVG renderiza bien
 * incluso con radios chicos.
 */
function appendSegment(
  segments: string[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  r: number,
): void {
  // Solo agregamos un L recto sin esquina aquí — las esquinas las
  // cubre la curva implícita entre segmentos consecutivos cuando hay
  // cambio de dirección. Para tener esquinas redondeadas REALES
  // tendríamos que insertar arcos entre cada par de segmentos.
  // Hacemos eso a continuación.
  const len = segments.length;
  if (len === 1) {
    // Primer L después del M. Sin curva.
    segments.push(`L ${toX} ${toY}`);
    return;
  }
  // Inspeccionamos el último L para ver si hay cambio de dirección
  // y aplicar la esquina redondeada con arc.
  const lastL = segments[len - 1]!;
  const m = lastL.match(/^L\s+(-?[\d.]+)\s+(-?[\d.]+)$/);
  if (!m) {
    segments.push(`L ${toX} ${toY}`);
    return;
  }
  const prevX = parseFloat(m[1]!);
  const prevY = parseFloat(m[2]!);
  const dx0 = prevX - fromX; // dirección del segmento previo (no la usamos directamente; fromX/fromY son el punto de inicio del nuevo segmento que es el final del previo)
  // Si fromX/fromY no coinciden con el final del segmento previo,
  // confiamos y ajustamos.
  void dx0;

  // Calculamos la dirección del segmento nuevo y del previo para
  // detectar codo.
  // El segmento previo termina en (fromX, fromY) y el nuevo va a
  // (toX, toY). El segmento previo PROVIENE de (prevPrevX, prevPrevY)
  // si lo encontramos. Por simplicidad: si los dos segmentos son
  // perpendiculares, intercalamos un arc.

  // Buscamos el segmento anterior al `lastL` para saber de dónde venía.
  // Si len === 2 (M + L), el "anterior" es el M.
  let prevStartX: number, prevStartY: number;
  if (len === 2) {
    const mLine = segments[0]!;
    const mm = mLine.match(/^M\s+(-?[\d.]+)\s+(-?[\d.]+)$/);
    if (!mm) {
      segments.push(`L ${toX} ${toY}`);
      return;
    }
    prevStartX = parseFloat(mm[1]!);
    prevStartY = parseFloat(mm[2]!);
  } else {
    // Recuperamos el último punto de inicio.
    const prev2 = segments[len - 2]!;
    const m2 = prev2.match(
      /(?:M|L|A\s+[\d.]+\s+[\d.]+\s+\d+\s+\d+\s+\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)$/,
    );
    if (!m2) {
      segments.push(`L ${toX} ${toY}`);
      return;
    }
    prevStartX = parseFloat(m2[1]!);
    prevStartY = parseFloat(m2[2]!);
  }

  const prevDx = fromX - prevStartX;
  const prevDy = fromY - prevStartY;
  const newDx = toX - fromX;
  const newDy = toY - fromY;

  // Si los dos segmentos están en la MISMA dirección (no hay codo),
  // simplemente extendemos.
  const sameDir =
    (Math.abs(prevDx) > 0.5 && Math.abs(newDx) > 0.5 && Math.sign(prevDx) === Math.sign(newDx) && Math.abs(prevDy) < 0.5 && Math.abs(newDy) < 0.5) ||
    (Math.abs(prevDy) > 0.5 && Math.abs(newDy) > 0.5 && Math.sign(prevDy) === Math.sign(newDy) && Math.abs(prevDx) < 0.5 && Math.abs(newDx) < 0.5);
  if (sameDir) {
    // Simplemente reemplazamos el último L extendiéndolo.
    segments[len - 1] = `L ${toX} ${toY}`;
    return;
  }

  // Codo perpendicular: ajustamos el L previo para terminar antes del
  // codo, insertamos arc, y agregamos el nuevo L.
  const radius = Math.min(
    r,
    Math.abs(prevDx) / 2,
    Math.abs(prevDy) / 2,
    Math.abs(newDx) / 2,
    Math.abs(newDy) / 2,
  );
  if (radius < 1) {
    // Espacio insuficiente — codo recto sin redondear.
    segments.push(`L ${toX} ${toY}`);
    return;
  }
  // Punto donde el L previo termina (antes del codo).
  let preCornerX = fromX;
  let preCornerY = fromY;
  if (Math.abs(prevDx) > 0.5) {
    preCornerX = fromX - Math.sign(prevDx) * radius;
  } else {
    preCornerY = fromY - Math.sign(prevDy) * radius;
  }
  // Punto donde el nuevo L empieza (después del codo).
  let postCornerX = fromX;
  let postCornerY = fromY;
  if (Math.abs(newDx) > 0.5) {
    postCornerX = fromX + Math.sign(newDx) * radius;
  } else {
    postCornerY = fromY + Math.sign(newDy) * radius;
  }
  // sweep flag del arc: depende de la orientación del codo.
  // Convención: sweep=1 (CW) si el cambio de dirección es en sentido
  // horario, sweep=0 (CCW) si es antihorario.
  // Para un codo H→V que va a la derecha-abajo (prevDx>0, newDy>0):
  // CW (sweep=1).
  const sweep = orthogonalSweep(prevDx, prevDy, newDx, newDy);

  // Ajustamos el último L para que termine en preCorner.
  segments[len - 1] = `L ${preCornerX} ${preCornerY}`;
  segments.push(
    `A ${radius} ${radius} 0 0 ${sweep} ${postCornerX} ${postCornerY}`,
  );
  segments.push(`L ${toX} ${toY}`);
}

function orthogonalSweep(
  prevDx: number,
  prevDy: number,
  newDx: number,
  newDy: number,
): 0 | 1 {
  // Producto cruzado 2D: positivo = CCW, negativo = CW.
  const cross = prevDx * newDy - prevDy * newDx;
  return cross > 0 ? 1 : 0;
}
