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
  /** Índice del color de Tableau-10 según orden de aparición de la
   *  expresión `relevant`. `null` para expresiones genéricas
   *  (`${X} != ''`) — esas usan el color neutro. Antes el color se
   *  derivaba de un hash con colisiones; ahora las primeras 10
   *  expresiones distintas reciben colores únicos garantizados. */
  colorIndex: number | null;
  fromBBox: { x: number; y: number; width: number; height: number };
  toBBox: { x: number; y: number; width: number; height: number };
};

export type LaidOutGraph = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
  /** Mapa expresión → índice de color (orden de aparición). Útil
   *  fuera del layout cuando se quiera colorear chips/legends que
   *  hacen referencia a una expresión. */
  expressionColorIndex: Map<string, number>;
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
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      expressionColorIndex: new Map(),
    };
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
  // Cuando una sección root tiene override, sus hijos visibles deben
  // moverse JUNTO con ella (calculamos delta y lo propagamos). Sin esto
  // el header se desliza y las preguntas de la sección quedan
  // estáticas, rompiendo la unidad visual del bloque.
  if (positionOverrides.size > 0) {
    for (const placed of flatNodes) {
      if (!placed.visible) continue;
      if (placed.depth !== 0) continue; // hijos se desplazan por delta
      const override = positionOverrides.get(placed.node.id);
      if (!override) continue;
      const dx = override.x - placed.x;
      const dy = override.y - placed.y;
      placed.x = override.x;
      placed.y = override.y;
      if (placed.node.kind === "section") {
        for (const child of placed.node.children) {
          const placedChild = positionByNodeId.get(child.id);
          if (placedChild && placedChild.visible) {
            placedChild.x += dx;
            placedChild.y += dy;
          }
        }
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
  let blockTop = Infinity;
  let blockBottom = -Infinity;
  for (const placed of flatNodes) {
    if (!placed.visible) continue;
    if (placed.y < blockTop) blockTop = placed.y;
    if (placed.y + placed.height > blockBottom) blockBottom = placed.y + placed.height;
  }
  if (!isFinite(blockTop)) blockTop = options.marginY;
  if (!isFinite(blockBottom)) blockBottom = options.marginY + options.rowHeight;

  // ── 5. Routing unificado: lane allocator + path único ──────────────
  // Rediseño completo. Antes había dos rutas (`routeOrthogonal` y
  // `routeBundled`) con varias ramas (`sameColumn`, `forward`,
  // `back-edge`, `goAbove` heurístico). Esa lógica generaba loops
  // de 360° cuando una rama se equivocaba (típico: target a la
  // derecha pero el path elegía lane inferior cuando arriba era
  // mucho más corto), y permitía que dos edges loose con misma
  // geometría pintaran encima.
  //
  // El nuevo modelo es un solo algoritmo:
  //
  //   1. Cada edge tiene UN lane: superior (`top`) o inferior
  //      (`bottom`). La elección es geométrica:
  //        · target sección → siempre lane SUPERIOR (entrada
  //          top-center, ya tiene que llegar por arriba).
  //        · target variable → lane más cercano al midY del
  //          edge (promedio de src.cy y tgt.cy).
  //
  //   2. Cada edge pertenece a una "unidad de lane":
  //        · Si su `relevantExpression` es compartida por ≥2
  //          edges en total: unidad = el bundle de la expresión.
  //          Todos los edges del bundle comparten subY → overlap
  //          intencional (efecto subway).
  //        · Si no: unidad = el edge mismo (loose).
  //
  //   3. Lane allocator asigna un subY único a cada unidad
  //      (separación 9px). Edges del mismo bundle reusan el subY;
  //      loose distintos quedan en sub-lanes adyacentes pero
  //      visualmente diferenciables. Cero superposición de líneas
  //      con misma geometría.
  //
  //   4. Path único, 5 tramos: src.right → breakout → laneY →
  //      mergeX,laneY → mergeX,mergeY → entry. Sin ramas, sin
  //      sorpresas. Para target sección añade un tramo extra
  //      hacia el top-center (V final).
  //
  // El anchor Y se distribuye por (source × unidad) — un source
  // con 4 flechas al mismo bundle genera UNA línea (no 4) porque
  // todas comparten la misma unidad.

  // 5.1 Conteo de edges por expresión — define qué expresiones son
  // bundleables (≥2 edges) vs. genuinamente sueltas.
  const edgeCountByExpr = new Map<string, number>();
  for (const r of resolved) {
    const expr = r.tgt.node.relevantExpression ?? "";
    if (!expr) continue;
    edgeCountByExpr.set(expr, (edgeCountByExpr.get(expr) ?? 0) + 1);
  }
  const isBundledExpr = (expr: string): boolean =>
    !!expr && (edgeCountByExpr.get(expr) ?? 0) >= 2;

  // 5.2 Determinar lane side + unitKey por edge.
  type EdgeMeta = {
    side: "top" | "bottom";
    unitKey: string;
  };
  const blockMidY = (blockTop + blockBottom) / 2;
  const edgeMeta: EdgeMeta[] = resolved.map((r, i) => {
    const expr = r.tgt.node.relevantExpression ?? "";
    let side: "top" | "bottom";
    if (r.tgt.node.kind === "section") {
      side = "top";
    } else {
      const srcMid = r.src.y + Math.min(r.src.height, options.rowHeight) / 2;
      const tgtMid = r.tgt.y + Math.min(r.tgt.height, options.rowHeight) / 2;
      const midY = (srcMid + tgtMid) / 2;
      side = midY <= blockMidY ? "top" : "bottom";
    }
    const unitKey = isBundledExpr(expr) ? `b:${expr}` : `loose:${i}`;
    return { side, unitKey };
  });

  // 5.3 Lane allocator: subY único por unidad, separación 9px.
  // Las unidades del mismo lado se ordenan según un proxy de
  // "longitud del recorrido horizontal" — más cortas adentro
  // (cerca del bloque), más largas afuera. Esto reduce cruces.
  const SUB_Y_STEP = 9;
  type UnitInfo = {
    key: string;
    side: "top" | "bottom";
    sortKey: number; // proxy de longitud del recorrido
  };
  const unitsByKey = new Map<string, UnitInfo>();
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (unitsByKey.has(meta.unitKey)) return;
    const span = Math.abs(
      (r.tgt.x + r.tgt.width / 2) - (r.src.x + r.src.width / 2),
    );
    unitsByKey.set(meta.unitKey, {
      key: meta.unitKey,
      side: meta.side,
      sortKey: span,
    });
  });
  const topUnits = [...unitsByKey.values()]
    .filter((u) => u.side === "top")
    .sort((a, b) => a.sortKey - b.sortKey);
  const botUnits = [...unitsByKey.values()]
    .filter((u) => u.side === "bottom")
    .sort((a, b) => a.sortKey - b.sortKey);
  const subYByUnit = new Map<string, number>();
  topUnits.forEach((u, idx) => {
    subYByUnit.set(u.key, blockTop - options.blockClearance - idx * SUB_Y_STEP);
  });
  botUnits.forEach((u, idx) => {
    subYByUnit.set(
      u.key,
      blockBottom + options.blockClearance + idx * SUB_Y_STEP,
    );
  });

  // 5.4 Anchor Y por (source × unidad) — anti-peine.
  // Si un source tiene K edges en la misma unidad (bundle), todos
  // arrancan en el mismo Y → una sola línea visible. Si tiene
  // edges en N unidades distintas, distribuye N anchors.
  const anchorYByEdge = new Map<string, number>();
  const unitsBySource = new Map<string, string[]>();
  const edgesBySourceUnit = new Map<string, ResolvedEdge[]>();
  resolved.forEach((r, i) => {
    const sId = r.src.node.id;
    const meta = edgeMeta[i]!;
    const composed = `${sId}::${meta.unitKey}`;
    if (!unitsBySource.has(sId)) unitsBySource.set(sId, []);
    if (!edgesBySourceUnit.has(composed)) {
      edgesBySourceUnit.set(composed, []);
      unitsBySource.get(sId)!.push(meta.unitKey);
    }
    edgesBySourceUnit.get(composed)!.push(r);
  });
  for (const [sId, units] of unitsBySource) {
    const placed = positionByNodeId.get(sId);
    if (!placed || !placed.visible) continue;
    const headerH = Math.min(placed.height, options.rowHeight);
    units.forEach((unitKey, gIdx) => {
      let yOffset: number;
      if (units.length === 1) {
        yOffset = headerH / 2;
      } else {
        const usable = headerH * 0.6;
        const start = (headerH - usable) / 2;
        yOffset = start + (gIdx * usable) / (units.length - 1);
      }
      const y = placed.y + yOffset;
      for (const r of edgesBySourceUnit.get(`${sId}::${unitKey}`) ?? []) {
        anchorYByEdge.set(`${r.src.node.id}->${r.tgt.node.id}`, y);
      }
    });
  }

  // 5.5 Color index por orden de aparición (DFS por roots). Las
  // primeras 10 expresiones distintas reciben colores Tableau-10
  // garantizadamente únicos. A partir de la 11 se reciclan, pero
  // antes era hash mod 10 con colisiones desde la primera.
  const expressionColorIndex = new Map<string, number>();
  const visitForColor = (n: GraphNode) => {
    const expr = n.relevantExpression;
    if (
      expr &&
      !isGenericExpressionLocal(expr) &&
      !expressionColorIndex.has(expr)
    ) {
      expressionColorIndex.set(expr, expressionColorIndex.size);
    }
    for (const c of n.children) visitForColor(c);
  };
  for (const r of rootNodes) visitForColor(r);

  // ── 6. Construir paths con el algoritmo único ──────────────────────
  const laidOutEdges: LaidOutEdge[] = resolved.map((r, i) => {
    const meta = edgeMeta[i]!;
    const laneY = subYByUnit.get(meta.unitKey)!;
    const expr = r.tgt.node.relevantExpression ?? "";
    const colorIdx = expr ? (expressionColorIndex.get(expr) ?? null) : null;

    const edgeKey = `${r.src.node.id}->${r.tgt.node.id}`;
    const sY =
      anchorYByEdge.get(edgeKey) ??
      r.src.y + Math.min(r.src.height, options.rowHeight) / 2;
    const sX = r.src.x + r.src.width;

    const pathInfo = routeViaLane({
      src: r.src,
      tgt: r.tgt,
      srcX: sX,
      srcY: sY,
      laneY,
      laneSide: meta.side,
      options,
    });

    const tgtHeaderH = Math.min(r.tgt.height, options.rowHeight);
    const srcHeaderH = Math.min(r.src.height, options.rowHeight);
    return {
      edge: r.edge,
      path: pathInfo.d,
      midX: pathInfo.midX,
      midY: pathInfo.midY,
      colorIndex: colorIdx,
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

  return {
    nodes: flatNodes,
    edges: laidOutEdges,
    width,
    height,
    expressionColorIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Routing único: src → breakout → laneY → mergeX,laneY → mergeX,mergeY → entry
// ─────────────────────────────────────────────────────────────────────
//
// Un solo path para TODOS los edges, sin ramas heurísticas. El lane
// (top/bottom + sub-Y específico) ya viene decidido por el lane
// allocator de `layoutLogicGraph`. Aquí solo se construye la
// geometría:
//
//   M src.right, src.cy
//   L src.right + breakout, src.cy        ← breakout horizontal
//   L src.right + breakout, laneY         ← V al lane
//   L mergeX, laneY                       ← H a lo largo del lane
//   L mergeX, mergeY                      ← V hasta el merge
//   L tgt.entryX, tgt.entryY              ← entrada (lateral o top)
//
// Para target sección la entrada es por TOP — añade un quinto tramo
// vertical hacia el header. Para variable la entrada es por izq
// (forward) o der (back-edge), siempre lateral.
//
// El path siempre pasa por el lane (arriba o abajo del bloque entero
// de cards), nunca por dentro del bloque. Resultado: cero cruces de
// cards, cero loops de 360°.
// ─────────────────────────────────────────────────────────────────────

type RouteViaLaneInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcX: number;
  srcY: number;
  laneY: number;
  laneSide: "top" | "bottom";
  options: LayoutOptions;
};

/** Detecta `${X} != ''` (la expresión genérica del drag-arrow), local
 *  para no acoplar con `GraphEdgeArrow`. Idéntica a la que vive ahí. */
function isGenericExpressionLocal(expr: string): boolean {
  return /^\s*\$\{[^}]+\}\s*!=\s*''\s*$/.test(expr);
}

function routeViaLane(input: RouteViaLaneInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const { src, tgt, srcX, srcY, laneY, laneSide, options } = input;
  void src;
  const r = options.cornerRadius;

  // Punto de entrada al target.
  let tX: number, tY: number, mergeX: number, mergeY: number;
  let entry: "top" | "left" | "right";
  if (tgt.node.kind === "section") {
    tX = tgt.x + tgt.width / 2;
    tY = tgt.y;
    mergeX = tX;
    mergeY = tY - options.mergeOffset;
    entry = "top";
  } else {
    if (srcX < tgt.x) {
      tX = tgt.x;
      tY = tgt.y + tgt.height / 2;
      mergeX = tX - options.mergeOffset;
      mergeY = tY;
      entry = "left";
    } else {
      tX = tgt.x + tgt.width;
      tY = tgt.y + tgt.height / 2;
      mergeX = tX + options.mergeOffset;
      mergeY = tY;
      entry = "right";
    }
  }

  const breakoutX = srcX + options.lateralBreakout;
  const segments: string[] = [`M ${srcX} ${srcY}`];

  // Tramo 1: breakout (siempre hacia la derecha del source).
  appendSegment(segments, srcX, srcY, breakoutX, srcY, r);
  // Tramo 2: V hacia el lane.
  appendSegment(segments, breakoutX, srcY, breakoutX, laneY, r);
  // Tramo 3: H a lo largo del lane.
  appendSegment(segments, breakoutX, laneY, mergeX, laneY, r);
  // Tramo 4: V hacia el merge.
  appendSegment(segments, mergeX, laneY, mergeX, mergeY, r);
  // Tramo 5: entrada al target.
  if (entry === "top") {
    appendSegment(segments, mergeX, mergeY, tX, tY, r);
  } else {
    // Lateral (left o right): mergeX,mergeY ya está alineado
    // verticalmente con el target — el último tramo es horizontal
    // hasta el lateral.
    appendSegment(segments, mergeX, mergeY, tX, tY, r);
  }

  // Tooltip: centro del lane con padding según el lado.
  const tooltipPad = 22;
  const midX = (breakoutX + mergeX) / 2;
  const midY = laneSide === "top" ? laneY - tooltipPad : laneY + tooltipPad;
  return { d: segments.join(" "), midX, midY };
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
