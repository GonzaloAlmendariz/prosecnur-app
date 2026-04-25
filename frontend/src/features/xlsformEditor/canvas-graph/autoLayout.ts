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
  // columnGap subió de 56 → 88 px: necesitamos espacio cómodo para
  // distribuir los rails Mode C (var↔var en gap entre columnas) sin
  // amontonarse. El usuario pidió explícitamente que el canvas no se
  // vea apretado.
  columnGap: 88,
  innerHeadGap: 14,
  innerRowGap: 10,
  childIndent: 14,
  marginX: 48,
  // marginY subió porque blockClearance creció — los lanes top/bottom
  // están más afuera del bloque, queremos que el viewport los muestre.
  marginY: 90,
  cornerRadius: 10,
  // mergeOffset 22 → 28: el stem final de entrada al target es más
  // visible (deja respiro entre la flecha y el borde del card).
  mergeOffset: 28,
  // lateralBreakout 18 → 24: el bump inicial es más generoso, da
  // sensación de "sale del card" más clara.
  lateralBreakout: 24,
  // blockClearance 28 → 48: el lane top/bottom queda más despegado
  // del bloque. Antes, con varios sub-rails apilados, los outermost
  // casi tocaban el viewport.
  blockClearance: 48,
};

// Constants para los nuevos modos de routing (sección de lane allocator
// más abajo). No están en `LayoutOptions` porque son del routing puro,
// no afectan layout de cards.
/** Separación vertical entre sub-rails en lanes top/bottom (Mode A/D). */
const SUB_Y_STEP = 16;
/** Separación entre carriles Mode B dentro del side-rail de una sección. */
const SIDE_RAIL_STEP = 12;
/** Offset base del primer Mode B rail respecto al borde de la sección. */
const SIDE_RAIL_BASE = 12;
/** Padding lateral del primer/último rail Mode C dentro del column gap. */
const GAP_RAIL_PADDING = 14;
/** Umbral de |dy| para promover Mode C (gap-step) a Mode D (lane). */
const ROW_PROXIMITY = 90;
/** Umbral de desbalance para mandar bundles Mode A al lane bottom. */
const LANE_BALANCE_THRESHOLD = 2;

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

  // ── 5. Routing en 4 modos según geometría ──────────────────────────
  //
  // Rediseño guiado por el dibujo a mano del usuario (canvas con secciones
  // A-F, edges amarillas/rojas/moradas/marrones). El algoritmo único
  // anterior mandaba TODAS las flechas por el lane global del bloque,
  // lo cual era detour absurdo para edges var↔var en la misma columna.
  //
  // Cuatro modos según geometría:
  //
  //   Mode A "section"   — target es sección. Lane top o bottom (load-
  //                        balanceado), entrada top-center o bottom-center.
  //   Mode B "side-rail" — var↔var misma columna. Carril lateral tight
  //                        (auto-balanceado izq/der según ocupación).
  //   Mode C "gap"       — var↔var columnas adyacentes con |dy| chico.
  //                        Carril dentro del column gap.
  //   Mode D "lane"      — todo lo demás (multi-columna o adjacent lejos).
  //                        Lane global como antes.
  //
  // Bundles (mismo color = misma `relevantExpression`) se preservan
  // PER MODO: un bundle inter-modo (ej. naranja con F1→P1 Mode C +
  // F1→E Mode A) tiene mismo color pero distintos allocators slot;
  // cada rama usa su path óptimo.

  // 5.1 Column index por nodo (necesario para Mode B y Mode C).
  // Las secciones root están ordenadas por su `x` absoluto. Cada
  // child de sección expandida hereda el column index del padre.
  // Top-level questions (sin sección padre) toman su propio column
  // index secuencial.
  const visibleRoots = flatNodes.filter((n) => n.visible && n.depth === 0);
  visibleRoots.sort((a, b) => a.x - b.x);
  const columnByNodeId = new Map<string, number>();
  const sectionByColumn: LaidOutNode[] = [];
  visibleRoots.forEach((root, idx) => {
    columnByNodeId.set(root.node.id, idx);
    sectionByColumn.push(root);
    if (root.node.kind === "section") {
      for (const child of root.node.children) {
        const placed = positionByNodeId.get(child.id);
        if (placed && placed.visible) {
          columnByNodeId.set(child.id, idx);
        }
      }
    }
  });

  // 5.2 Conteo de edges por expresión — define qué expresiones son
  // bundleables (≥2 edges) vs. genuinamente sueltas.
  const edgeCountByExpr = new Map<string, number>();
  for (const r of resolved) {
    const expr = r.tgt.node.relevantExpression ?? "";
    if (!expr) continue;
    edgeCountByExpr.set(expr, (edgeCountByExpr.get(expr) ?? 0) + 1);
  }
  const isBundledExpr = (expr: string): boolean =>
    !!expr && (edgeCountByExpr.get(expr) ?? 0) >= 2;

  // 5.3 Color index por orden de aparición (DFS por roots). Las
  // primeras 10 expresiones distintas reciben colores Tableau-10
  // garantizadamente únicos. Mismo color para edges con misma
  // `relevantExpression` aunque estén en distintos modos.
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

  // 5.4 Decisión de modo por edge.
  type EdgeMode = "section" | "side-rail" | "gap" | "lane";
  type EdgeMeta = {
    mode: EdgeMode;
    /** unitKey identifica la unidad de allocator. Edges en la misma
     *  unidad comparten geometría (bundle subway). Formato:
     *  `${mode}::${expr}` para bundleables, `loose:${i}` para sueltos. */
    unitKey: string;
    laneSide?: "top" | "bottom"; // Mode A, D
    laneY?: number;               // Mode A, D
    railX?: number;               // Mode B
    railSide?: "left" | "right";  // Mode B
    gapX?: number;                // Mode C
  };

  const edgeMeta: EdgeMeta[] = resolved.map((r, i) => {
    const expr = r.tgt.node.relevantExpression ?? "";
    let mode: EdgeMode;
    if (r.tgt.node.kind === "section") {
      mode = "section";
    } else {
      const srcCol = columnByNodeId.get(r.src.node.id);
      const tgtCol = columnByNodeId.get(r.tgt.node.id);
      if (srcCol == null || tgtCol == null) {
        mode = "lane";
      } else if (srcCol === tgtCol) {
        mode = "side-rail";
      } else if (Math.abs(srcCol - tgtCol) === 1) {
        const dy = Math.abs(
          (r.src.y + r.src.height / 2) - (r.tgt.y + r.tgt.height / 2),
        );
        mode = dy < ROW_PROXIMITY ? "gap" : "lane";
      } else {
        mode = "lane";
      }
    }
    // unitKey: bundleable si la expresión se comparte ≥2 edges Y todos
    // los edges del bundle caen en el mismo modo. Bundleable inter-modo
    // sería complicado y el usuario aceptó "solo color compartido" —
    // así que la unidad es por (modo + expresión).
    const unitKey = isBundledExpr(expr) ? `${mode}::${expr}` : `loose:${i}`;
    return { mode, unitKey };
  });

  // 5.5 Allocator de Mode A y D (lanes top/bottom con load-balance).
  // Para Mode D usamos midY del edge para decidir lane (igual que
  // antes). Para Mode A aplicamos load-balance: si top tiene 2+
  // unidades más que bottom, la siguiente unidad Mode A va a bottom.
  const blockMidY = (blockTop + blockBottom) / 2;
  type LaneUnitInfo = {
    key: string;
    side: "top" | "bottom";
    sortKey: number;
  };
  const laneUnits = new Map<string, LaneUnitInfo>();
  // Primera pasada: Mode D (decisión geométrica fija).
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (meta.mode !== "lane") return;
    if (laneUnits.has(meta.unitKey)) return;
    const srcMid = r.src.y + Math.min(r.src.height, options.rowHeight) / 2;
    const tgtMid = r.tgt.y + Math.min(r.tgt.height, options.rowHeight) / 2;
    const midY = (srcMid + tgtMid) / 2;
    const side: "top" | "bottom" = midY <= blockMidY ? "top" : "bottom";
    const span = Math.abs(
      (r.tgt.x + r.tgt.width / 2) - (r.src.x + r.src.width / 2),
    );
    laneUnits.set(meta.unitKey, { key: meta.unitKey, side, sortKey: span });
  });
  // Segunda pasada: Mode A con load-balance.
  let topCount = [...laneUnits.values()].filter((u) => u.side === "top").length;
  let botCount = [...laneUnits.values()].filter((u) => u.side === "bottom").length;
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (meta.mode !== "section") return;
    if (laneUnits.has(meta.unitKey)) return;
    // Default top; si top supera bottom por LANE_BALANCE_THRESHOLD,
    // mandamos a bottom.
    let side: "top" | "bottom" = "top";
    if (topCount - botCount >= LANE_BALANCE_THRESHOLD) {
      side = "bottom";
      botCount += 1;
    } else {
      topCount += 1;
    }
    const span = Math.abs(
      (r.tgt.x + r.tgt.width / 2) - (r.src.x + r.src.width / 2),
    );
    laneUnits.set(meta.unitKey, { key: meta.unitKey, side, sortKey: span });
  });
  // Asignación de subY: ordenar por span (cortos adentro, largos afuera).
  const topLaneUnits = [...laneUnits.values()]
    .filter((u) => u.side === "top")
    .sort((a, b) => a.sortKey - b.sortKey);
  const botLaneUnits = [...laneUnits.values()]
    .filter((u) => u.side === "bottom")
    .sort((a, b) => a.sortKey - b.sortKey);
  const subYByUnit = new Map<string, number>();
  topLaneUnits.forEach((u, idx) => {
    subYByUnit.set(u.key, blockTop - options.blockClearance - idx * SUB_Y_STEP);
  });
  botLaneUnits.forEach((u, idx) => {
    subYByUnit.set(
      u.key,
      blockBottom + options.blockClearance + idx * SUB_Y_STEP,
    );
  });

  // 5.6 Allocator de Mode C (gap-step rails dentro del column gap).
  // Cada par de columnas adyacentes tiene su propio gap; las unidades
  // Mode C que cruzan ese gap se distribuyen equiespaciadas.
  // Mapeo: gap-index (= min(srcCol, tgtCol)) → orden de unidades.
  const gapUnitsByGap = new Map<number, string[]>();
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (meta.mode !== "gap") return;
    const srcCol = columnByNodeId.get(r.src.node.id)!;
    const tgtCol = columnByNodeId.get(r.tgt.node.id)!;
    const gapIdx = Math.min(srcCol, tgtCol);
    if (!gapUnitsByGap.has(gapIdx)) gapUnitsByGap.set(gapIdx, []);
    const arr = gapUnitsByGap.get(gapIdx)!;
    if (!arr.includes(meta.unitKey)) arr.push(meta.unitKey);
  });
  const gapXByUnit = new Map<string, number>();
  for (const [gapIdx, units] of gapUnitsByGap) {
    const leftSection = sectionByColumn[gapIdx];
    const rightSection = sectionByColumn[gapIdx + 1];
    if (!leftSection || !rightSection) continue;
    const gapStart = leftSection.x + leftSection.width;
    const gapEnd = rightSection.x;
    const gapWidth = gapEnd - gapStart;
    const usable = Math.max(0, gapWidth - 2 * GAP_RAIL_PADDING);
    units.forEach((unitKey, idx) => {
      let x: number;
      if (units.length === 1) {
        x = gapStart + gapWidth / 2;
      } else {
        x = gapStart + GAP_RAIL_PADDING + (idx * usable) / (units.length - 1);
      }
      gapXByUnit.set(unitKey, x);
    });
  }

  // 5.7 Allocator de Mode B (side-rails con auto-balance izq/der).
  // Para cada sección, contamos las unidades Mode B que viven en esa
  // columna. Para cada una, elegimos lado (izq/der) según ocupación
  // de Mode C en los gaps adyacentes (lado con menos load gana).
  // Tie / leftmost → derecha. Rightmost → izquierda.
  const railUnitsByCol = new Map<number, string[]>();
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (meta.mode !== "side-rail") return;
    const col = columnByNodeId.get(r.src.node.id);
    if (col == null) return;
    if (!railUnitsByCol.has(col)) railUnitsByCol.set(col, []);
    const arr = railUnitsByCol.get(col)!;
    if (!arr.includes(meta.unitKey)) arr.push(meta.unitKey);
  });
  const railResolved = new Map<string, { x: number; side: "left" | "right" }>();
  for (const [col, units] of railUnitsByCol) {
    const section = sectionByColumn[col];
    if (!section) continue;
    const isLeftmost = col === 0;
    const isRightmost = col === sectionByColumn.length - 1;
    // Conteo de Mode C en gaps adyacentes (gap izq = col-1, der = col).
    const leftLoad = isLeftmost
      ? Number.POSITIVE_INFINITY
      : (gapUnitsByGap.get(col - 1)?.length ?? 0);
    const rightLoad = isRightmost
      ? Number.POSITIVE_INFINITY
      : (gapUnitsByGap.get(col)?.length ?? 0);
    let leftCount = 0;
    let rightCount = 0;
    units.forEach((unitKey) => {
      // Lado con menos load gana. Tie → derecha (preferencia natural).
      let side: "left" | "right";
      if (isRightmost) side = "left";
      else if (isLeftmost) side = "right";
      else if (leftLoad + leftCount < rightLoad + rightCount) {
        side = "left";
      } else {
        side = "right";
      }
      let x: number;
      if (side === "right") {
        x = section.x + section.width + SIDE_RAIL_BASE +
          rightCount * SIDE_RAIL_STEP;
        rightCount += 1;
      } else {
        x = section.x - SIDE_RAIL_BASE - leftCount * SIDE_RAIL_STEP;
        leftCount += 1;
      }
      railResolved.set(unitKey, { x, side });
    });
  }

  // 5.8 Resolver allocator outputs en cada EdgeMeta.
  resolved.forEach((r, i) => {
    const meta = edgeMeta[i]!;
    if (meta.mode === "section" || meta.mode === "lane") {
      const unit = laneUnits.get(meta.unitKey);
      if (unit) {
        meta.laneSide = unit.side;
        meta.laneY = subYByUnit.get(meta.unitKey);
      }
    } else if (meta.mode === "side-rail") {
      const rail = railResolved.get(meta.unitKey);
      if (rail) {
        meta.railX = rail.x;
        meta.railSide = rail.side;
      }
    } else if (meta.mode === "gap") {
      meta.gapX = gapXByUnit.get(meta.unitKey);
    }
  });

  // 5.9 Anchor Y por (source × unidad) — anti-peine.
  // Si un source tiene K edges en la misma unidad (bundle), todos
  // arrancan en el mismo Y → una sola línea visible.
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

  // 5.10 mergeOffset por (target × unidad) — anti-overlap en aproximación
  // al target. Antes el tramo V final (mergeX, laneY → mergeX, mergeY)
  // era el MISMO X para todas las flechas que entraban al mismo target,
  // así que se apilaban visualmente. Ahora cada unidad distinta que
  // termina en el mismo target recibe un stride creciente — el primer
  // edge tiene `mergeOffset` base, el segundo +8, el tercero +16, etc.
  // Edges en la misma unidad (bundle) comparten stride → mantienen el
  // overlap intencional del subway. Aplica a Modes A y D (los que usan
  // mergeOffset como stem).
  const MERGE_STRIDE = 8;
  const mergeOffsetByEdge = new Map<string, number>();
  const unitsByTarget = new Map<string, string[]>();
  const edgesByTargetUnit = new Map<string, ResolvedEdge[]>();
  resolved.forEach((r, i) => {
    const tId = r.tgt.node.id;
    const meta = edgeMeta[i]!;
    if (meta.mode !== "section" && meta.mode !== "lane") return;
    const composed = `${tId}::${meta.unitKey}`;
    if (!unitsByTarget.has(tId)) unitsByTarget.set(tId, []);
    if (!edgesByTargetUnit.has(composed)) {
      edgesByTargetUnit.set(composed, []);
      unitsByTarget.get(tId)!.push(meta.unitKey);
    }
    edgesByTargetUnit.get(composed)!.push(r);
  });
  for (const [tId, units] of unitsByTarget) {
    units.forEach((unitKey, idx) => {
      const offset = options.mergeOffset + idx * MERGE_STRIDE;
      for (const r of edgesByTargetUnit.get(`${tId}::${unitKey}`) ?? []) {
        mergeOffsetByEdge.set(
          `${r.src.node.id}->${r.tgt.node.id}`,
          offset,
        );
      }
    });
  }

  // ── 6. Construir paths con dispatcher por modo ─────────────────────
  const laidOutEdges: LaidOutEdge[] = resolved.map((r, i) => {
    const meta = edgeMeta[i]!;
    const expr = r.tgt.node.relevantExpression ?? "";
    const colorIdx = expr ? (expressionColorIndex.get(expr) ?? null) : null;

    const edgeKey = `${r.src.node.id}->${r.tgt.node.id}`;
    const sY =
      anchorYByEdge.get(edgeKey) ??
      r.src.y + Math.min(r.src.height, options.rowHeight) / 2;
    const sX = r.src.x + r.src.width;

    const effectiveMergeOffset =
      mergeOffsetByEdge.get(edgeKey) ?? options.mergeOffset;

    let pathInfo: { d: string; midX: number; midY: number };
    switch (meta.mode) {
      case "section":
        pathInfo = routeSectionTarget({
          src: r.src,
          tgt: r.tgt,
          srcX: sX,
          srcY: sY,
          laneY: meta.laneY!,
          laneSide: meta.laneSide!,
          mergeOffset: effectiveMergeOffset,
          options,
        });
        break;
      case "side-rail":
        pathInfo = routeSideRail({
          src: r.src,
          tgt: r.tgt,
          srcY: sY,
          railX: meta.railX!,
          railSide: meta.railSide!,
          options,
        });
        break;
      case "gap":
        pathInfo = routeGapStep({
          src: r.src,
          tgt: r.tgt,
          srcX: sX,
          srcY: sY,
          gapX: meta.gapX!,
          options,
        });
        break;
      case "lane":
      default:
        pathInfo = routeLongLane({
          src: r.src,
          tgt: r.tgt,
          srcX: sX,
          srcY: sY,
          laneY: meta.laneY!,
          laneSide: meta.laneSide!,
          mergeOffset: effectiveMergeOffset,
          options,
        });
        break;
    }

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
// Path generators — uno por modo
// ─────────────────────────────────────────────────────────────────────
//
// Cada generator construye el path SVG de su modo. Todos usan
// `appendSegment` para esquinas redondeadas. La decisión geométrica
// (lane, rail, gap) ya viene resuelta por el allocator del layout.
//
// ─────────────────────────────────────────────────────────────────────

/** Detecta `${X} != ''` (la expresión genérica del drag-arrow), local
 *  para no acoplar con `GraphEdgeArrow`. Idéntica a la que vive ahí. */
function isGenericExpressionLocal(expr: string): boolean {
  return /^\s*\$\{[^}]+\}\s*!=\s*''\s*$/.test(expr);
}

// ── Mode A: target sección — entrada top-center o bottom-center ──────

type RouteSectionInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcX: number;
  srcY: number;
  laneY: number;
  laneSide: "top" | "bottom";
  /** Stem length entre el merge point y el target. Per-edge stride
   *  asignado por el allocator de target (5.10) — varía por unidad
   *  para evitar que los V finales se apilen al mismo X. */
  mergeOffset: number;
  options: LayoutOptions;
};

function routeSectionTarget(input: RouteSectionInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const { src, tgt, srcX, srcY, laneY, laneSide, mergeOffset, options } = input;
  void src;
  const r = options.cornerRadius;

  // Entrada por top-center si lane es top, bottom-center si lane es
  // bottom. Stem `mergeOffset` (per-edge) antes del target.
  const tX = tgt.x + tgt.width / 2;
  let tY: number, mergeY: number;
  if (laneSide === "top") {
    tY = tgt.y;
    mergeY = tY - mergeOffset;
  } else {
    tY = tgt.y + tgt.height;
    mergeY = tY + mergeOffset;
  }

  const breakoutX = srcX + options.lateralBreakout;
  const segments: string[] = [`M ${srcX} ${srcY}`];
  appendSegment(segments, srcX, srcY, breakoutX, srcY, r);
  appendSegment(segments, breakoutX, srcY, breakoutX, laneY, r);
  appendSegment(segments, breakoutX, laneY, tX, laneY, r);
  appendSegment(segments, tX, laneY, tX, mergeY, r);
  appendSegment(segments, tX, mergeY, tX, tY, r);

  const tooltipPad = 22;
  const midX = (breakoutX + tX) / 2;
  const midY = laneSide === "top" ? laneY - tooltipPad : laneY + tooltipPad;
  return { d: segments.join(" "), midX, midY };
}

// ── Mode B: side-rail — var↔var en la misma columna ─────────────────

type RouteSideRailInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcY: number;
  railX: number;
  railSide: "left" | "right";
  options: LayoutOptions;
};

function routeSideRail(input: RouteSideRailInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const { src, tgt, srcY, railX, railSide, options } = input;
  const r = options.cornerRadius;

  // Salida y entrada: por la derecha (railSide=right) o por la
  // izquierda (railSide=left) de las cards.
  const srcExitX = railSide === "right" ? src.x + src.width : src.x;
  const tgtEntryX = railSide === "right" ? tgt.x + tgt.width : tgt.x;
  const tY = tgt.y + Math.min(tgt.height, options.rowHeight) / 2;

  const segments: string[] = [`M ${srcExitX} ${srcY}`];
  appendSegment(segments, srcExitX, srcY, railX, srcY, r);
  appendSegment(segments, railX, srcY, railX, tY, r);
  appendSegment(segments, railX, tY, tgtEntryX, tY, r);

  const midX = railX + (railSide === "right" ? 12 : -12);
  const midY = (srcY + tY) / 2;
  return { d: segments.join(" "), midX, midY };
}

// ── Mode C: gap-step — var→var en columnas adyacentes ───────────────

type RouteGapStepInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcX: number;
  srcY: number;
  gapX: number;
  options: LayoutOptions;
};

function routeGapStep(input: RouteGapStepInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const { src, tgt, srcX, srcY, gapX, options } = input;
  void src;
  const r = options.cornerRadius;

  // Forward: src está a la izq del tgt, salimos por la derecha del src,
  // entramos por la izq del tgt. (Si src está a la derecha — caso
  // simétrico — se intercambian, pero el allocator pone src en la
  // columna izq por convención de `gapIdx = min(srcCol, tgtCol)`.)
  const tX = srcX < tgt.x ? tgt.x : tgt.x + tgt.width;
  const tY = tgt.y + Math.min(tgt.height, options.rowHeight) / 2;

  const segments: string[] = [`M ${srcX} ${srcY}`];
  appendSegment(segments, srcX, srcY, gapX, srcY, r);
  appendSegment(segments, gapX, srcY, gapX, tY, r);
  appendSegment(segments, gapX, tY, tX, tY, r);

  const midX = gapX;
  const midY = (srcY + tY) / 2;
  return { d: segments.join(" "), midX, midY };
}

// ── Mode D: long lane — wrap por arriba o abajo del bloque entero ───
//
// Path único de 5 tramos:
//   M src.right, src.cy
//   L src.right + breakout, src.cy
//   L src.right + breakout, laneY
//   L mergeX, laneY
//   L mergeX, mergeY
//   L tgt.entryX, tgt.entryY
// Forward o back-edge a variable, siempre lateral. Cero cruces de
// cards. Es el routing original (renombrado de `routeViaLane`).

type RouteLongLaneInput = {
  src: LaidOutNode;
  tgt: LaidOutNode;
  srcX: number;
  srcY: number;
  laneY: number;
  laneSide: "top" | "bottom";
  /** Stem horizontal del último tramo de aproximación al target.
   *  Per-edge stride para evitar que múltiples flechas al mismo
   *  target se apilen al mismo X. */
  mergeOffset: number;
  options: LayoutOptions;
};

function routeLongLane(input: RouteLongLaneInput): {
  d: string;
  midX: number;
  midY: number;
} {
  const { src, tgt, srcX, srcY, laneY, laneSide, mergeOffset, options } = input;
  void src;
  const r = options.cornerRadius;

  // Forward (target a la der) → entrada lateral izq.
  // Back-edge (target a la izq) → entrada lateral der.
  let tX: number, tY: number, mergeX: number, mergeY: number;
  if (srcX < tgt.x) {
    tX = tgt.x;
    tY = tgt.y + tgt.height / 2;
    mergeX = tX - mergeOffset;
    mergeY = tY;
  } else {
    tX = tgt.x + tgt.width;
    tY = tgt.y + tgt.height / 2;
    mergeX = tX + mergeOffset;
    mergeY = tY;
  }

  const breakoutX = srcX + options.lateralBreakout;
  const segments: string[] = [`M ${srcX} ${srcY}`];
  appendSegment(segments, srcX, srcY, breakoutX, srcY, r);
  appendSegment(segments, breakoutX, srcY, breakoutX, laneY, r);
  appendSegment(segments, breakoutX, laneY, mergeX, laneY, r);
  appendSegment(segments, mergeX, laneY, mergeX, mergeY, r);
  appendSegment(segments, mergeX, mergeY, tX, tY, r);

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
