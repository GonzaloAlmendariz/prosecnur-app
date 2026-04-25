// =============================================================================
// canvas-graph/autoLayout.ts — layout jerárquico para el grafo
// =============================================================================
// Posicionamiento de los nodes con dos consideraciones nuevas:
//
//   1. Secciones colapsables: cuando una sección está colapsada, ocupa una
//      sola fila (la card del header). Cuando está expandida, su altura
//      crece para acomodar las cards de las preguntas / sub-secciones
//      dentro. El layout calcula altura dinámica.
//
//   2. Edges depends-on solo: el orden por capas se calcula a partir de
//      las dependencias entre los nodes top-level + visibles (preguntas
//      que están dentro de secciones expandidas). Si un node está
//      "oculto" porque su sección padre está colapsada, lo representa la
//      sección padre en el grafo.
//
// El algoritmo es "Sugiyama-light" otra vez: BFS por capas desde fuentes
// (in-degree=0) en el grafo aplanado de visible nodes, dentro de cada
// capa orden por aparición original. Sin librerías externas — los
// formularios del corpus rondan los 50-150 nodes.
// =============================================================================

import type { GraphEdge, GraphNode, LogicGraph } from "./buildGraph";

/** Geometría calculada para un nodo (top-level o anidado). */
export type LaidOutNode = {
  node: GraphNode;
  /** Posición absoluta en el lienzo. Para nodos hijos, es absoluta también
   *  (no relativa al padre — el render usa transform por nodo). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Profundidad en el árbol: 0 = raíz, 1 = dentro de una sección, etc. */
  depth: number;
  /** Si este node es un descendiente "expuesto" porque su sección padre
   *  está expandida. Cuando false, el node no se renderiza pero su
   *  representante visual es el ancestro colapsado más cercano. */
  visible: boolean;
};

export type LaidOutEdge = {
  edge: GraphEdge;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Bounding box del nodo origen (para que el edge router sepa cómo
   *  esquivarlo cuando es back-edge o same-layer). */
  fromBBox: { x: number; y: number; width: number; height: number };
  toBBox: { x: number; y: number; width: number; height: number };
};

export type LaidOutGraph = {
  /** Todos los nodes con sus posiciones — incluyendo los ocultos. La UI
   *  filtra por `visible` al renderizar. */
  nodes: LaidOutNode[];
  /** Edges proyectadas: si el source o target original está oculto, se
   *  reemplaza por el ancestro colapsado más cercano. */
  edges: LaidOutEdge[];
  width: number;
  height: number;
};

export type LayoutOptions = {
  nodeWidth: number;
  /** Altura de la "tarjeta" (header en secciones, body en preguntas). */
  rowHeight: number;
  /** Espacio horizontal entre capas. */
  layerGap: number;
  /** Espacio vertical entre rows en una misma capa. */
  rowGap: number;
  /** Espacio vertical interno entre header y children de una sección
   *  expandida. */
  innerGap: number;
  /** Espacio horizontal extra que indenta los hijos respecto al padre. */
  childIndent: number;
  marginX: number;
  marginY: number;
};

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 220,
  rowHeight: 56,
  // El gap entre capas era 90 — apretado, las flechas no tenían espacio
  // para arquear y terminaban atravesando los nodos vecinos. 160 deja
  // suficiente margen para que el edge router dibuje beziers limpios
  // dentro del gutter horizontal sin tocar otros nodos.
  layerGap: 160,
  rowGap: 18,
  innerGap: 12,
  childIndent: 18,
  marginX: 48,
  // El margen vertical sube para que las back-edges puedan arquear por
  // arriba/abajo del bloque entero sin tocar el header del overlay.
  marginY: 60,
};

export function layoutLogicGraph(
  graph: LogicGraph,
  expandedSectionIds: Set<string>,
  optionsOverride: Partial<LayoutOptions> = {},
): LaidOutGraph {
  const options = { ...DEFAULT_OPTIONS, ...optionsOverride };
  const { rootNodes, edges } = graph;

  if (rootNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Helper: ¿este nodo es "visible" (no está oculto dentro de una sección
  // colapsada de algún ancestro)? Recursivamente: visible si todos los
  // ancestros sección están expandidos.
  // Para implementarlo simple, recorremos el árbol y vamos marcando.

  // -- 1. Para cada root, calcular su altura y posiciones de hijos
  // (recursivo sobre la expansión). --
  const flatNodes: LaidOutNode[] = [];
  const heightOf = (node: GraphNode, depth: number): number => {
    if (node.kind !== "section") return options.rowHeight;
    const isExpanded = expandedSectionIds.has(node.id);
    if (!isExpanded || node.children.length === 0) return options.rowHeight;
    let inner = 0;
    for (let i = 0; i < node.children.length; i += 1) {
      if (i > 0) inner += options.rowGap;
      inner += heightOf(node.children[i]!, depth + 1);
    }
    return options.rowHeight + options.innerGap + inner + options.innerGap;
  };

  /** Coloca un nodo en (x, y) y, recursivamente, a sus hijos si está
   *  expandido. Devuelve la altura total ocupada. */
  const placeNode = (
    node: GraphNode,
    x: number,
    y: number,
    depth: number,
    visible: boolean,
  ): number => {
    const isSection = node.kind === "section";
    const isExpanded =
      isSection &&
      expandedSectionIds.has(node.id) &&
      node.children.length > 0;
    const totalHeight = heightOf(node, depth);

    flatNodes.push({
      node,
      x,
      y,
      width: options.nodeWidth,
      height: isSection && isExpanded ? totalHeight : options.rowHeight,
      depth,
      visible,
    });

    if (isExpanded) {
      // Posicionamos los children debajo del header de la sección.
      let childY = y + options.rowHeight + options.innerGap;
      const childX = x + options.childIndent;
      for (const child of node.children) {
        const childHeight = heightOf(child, depth + 1);
        placeNode(child, childX, childY, depth + 1, true);
        childY += childHeight + options.rowGap;
      }
    } else if (isSection) {
      // Sección colapsada: registramos sus children como invisibles para
      // que las edges puedan resolverse al ancestro visible.
      for (const child of node.children) {
        registerHidden(child, depth + 1);
      }
    }

    return totalHeight;
  };

  /** Registra un descendiente sin posicionarlo (porque está dentro de una
   *  sección colapsada). Se llama recursivo. */
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
    if (node.kind === "section") {
      for (const child of node.children) {
        registerHidden(child, depth + 1);
      }
    }
  };

  // -- 2. Calcular capas top-level por longest-path entre roots --
  // Para cada root, capa basada en deps a otros roots.
  const inDeg = new Map<string, number>();
  const adjOut = new Map<string, string[]>();
  for (const root of rootNodes) {
    inDeg.set(root.id, 0);
    adjOut.set(root.id, []);
  }
  // Hacemos un set para resolver edges al ancestro top-level más cercano.
  const topLevelAncestor = new Map<string, string>();
  const populateAncestor = (node: GraphNode, ancestorId: string) => {
    topLevelAncestor.set(node.id, ancestorId);
    for (const child of node.children) populateAncestor(child, ancestorId);
  };
  for (const root of rootNodes) populateAncestor(root, root.id);

  for (const edge of edges) {
    const srcRoot = topLevelAncestor.get(edge.source);
    const tgtRoot = topLevelAncestor.get(edge.target);
    if (!srcRoot || !tgtRoot || srcRoot === tgtRoot) continue;
    adjOut.get(srcRoot)?.push(tgtRoot);
    inDeg.set(tgtRoot, (inDeg.get(tgtRoot) ?? 0) + 1);
  }

  // Kahn's algorithm: orden topológico estable que termina SIEMPRE,
  // incluso si el grafo tiene ciclos (caso real con instrumentos donde
  // dos preguntas se condicionan mutuamente — visto en GIZ_INST.xlsx).
  // El BFS por longest-path anterior se colgaba en loops si había ciclos.
  //
  // Algoritmo: cada nodo recibe layer = 1 + max(layer de los predecesores
  // ya procesados). Procesamos un nodo cuando su `remainingIn` llega a 0.
  // Si quedan nodos sin procesar al final → forman parte de un ciclo;
  // los asignamos a capa 0 (mejor que colgarse).
  const layer = new Map<string, number>();
  const remainingIn = new Map<string, number>();
  for (const root of rootNodes) {
    remainingIn.set(root.id, inDeg.get(root.id) ?? 0);
  }
  const queue: string[] = [];
  for (const root of rootNodes) {
    if ((remainingIn.get(root.id) ?? 0) === 0) {
      layer.set(root.id, 0);
      queue.push(root.id);
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const myLayer = layer.get(id) ?? 0;
    for (const next of adjOut.get(id) ?? []) {
      // Cada predecesor procesado aumenta el max-layer del sucesor.
      const proposed = Math.max(layer.get(next) ?? 0, myLayer + 1);
      layer.set(next, proposed);
      // Decrementamos in-degree restante; si llega a 0, listo para procesar.
      const left = (remainingIn.get(next) ?? 1) - 1;
      remainingIn.set(next, left);
      if (left <= 0) queue.push(next);
    }
  }
  // Cualquier nodo sin layer = parte de un ciclo o desconectado. Capa 0.
  for (const root of rootNodes) {
    if (!layer.has(root.id)) layer.set(root.id, 0);
  }

  // -- 3. Ordenar roots por capa, layout vertical de cada capa. --
  const byLayer = new Map<number, GraphNode[]>();
  for (const root of rootNodes) {
    const l = layer.get(root.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(root);
  }
  const layerCount = Math.max(...byLayer.keys()) + 1;

  // Posicionamos cada capa.
  let canvasWidth = options.marginX;
  let maxLayerBottom = 0;
  for (let l = 0; l < layerCount; l += 1) {
    const inLayer = byLayer.get(l) ?? [];
    const x = options.marginX + l * (options.nodeWidth + options.layerGap);
    let y = options.marginY;
    for (const root of inLayer) {
      const heightHere = heightOf(root, 0);
      placeNode(root, x, y, 0, true);
      y += heightHere + options.rowGap;
    }
    if (y - options.rowGap > maxLayerBottom) maxLayerBottom = y - options.rowGap;
    canvasWidth = x + options.nodeWidth + options.marginX;
  }

  // -- 4. Resolver edges: cada edge va del nodo visible más cercano al
  // visible más cercano. --
  const positionByNodeId = new Map<string, LaidOutNode>();
  for (const placed of flatNodes) positionByNodeId.set(placed.node.id, placed);

  // Mapa hijo→padre construido UNA vez recorriendo el árbol — antes
  // findParent recorría todo el árbol para cada llamada (O(N²) en el
  // peor caso). Con este map cada lookup es O(1).
  const parentByChildId = new Map<string, GraphNode>();
  const seenForParent = new Set<string>();
  const indexParents = (n: GraphNode) => {
    if (seenForParent.has(n.id)) return; // defensa contra ciclos del árbol
    seenForParent.add(n.id);
    for (const child of n.children) {
      parentByChildId.set(child.id, n);
      indexParents(child);
    }
  };
  for (const root of rootNodes) indexParents(root);

  const resolveVisible = (id: string): LaidOutNode | null => {
    let cursor: GraphNode | null = graphNodeById(id);
    let safety = 64; // tope absoluto contra árboles patológicos
    while (cursor && safety-- > 0) {
      const placed = positionByNodeId.get(cursor.id);
      if (placed && placed.visible) return placed;
      cursor = parentByChildId.get(cursor.id) ?? null;
    }
    return null;
  };
  function graphNodeById(id: string): GraphNode | null {
    const placed = positionByNodeId.get(id);
    return placed ? placed.node : null;
  }

  const laidOutEdges: LaidOutEdge[] = [];
  const seenPair = new Set<string>(); // dedupe colapsado
  for (const edge of edges) {
    const fromVisible = resolveVisible(edge.source);
    const toVisible = resolveVisible(edge.target);
    if (!fromVisible || !toVisible) continue;
    if (fromVisible === toVisible) continue;
    const key = `${fromVisible.node.id}->${toVisible.node.id}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    // bbox = el rect del header (siempre `rowHeight` de altura) que es
    // donde queremos que las flechas se anclen, no la altura total de la
    // sección expandida.
    const fromHeaderH = Math.min(fromVisible.height, options.rowHeight);
    const toHeaderH = Math.min(toVisible.height, options.rowHeight);
    laidOutEdges.push({
      edge,
      fromX: fromVisible.x + fromVisible.width,
      fromY: fromVisible.y + fromHeaderH / 2,
      toX: toVisible.x,
      toY: toVisible.y + toHeaderH / 2,
      fromBBox: {
        x: fromVisible.x,
        y: fromVisible.y,
        width: fromVisible.width,
        height: fromHeaderH,
      },
      toBBox: {
        x: toVisible.x,
        y: toVisible.y,
        width: toVisible.width,
        height: toHeaderH,
      },
    });
  }

  return {
    nodes: flatNodes,
    edges: laidOutEdges,
    width: canvasWidth,
    height: maxLayerBottom + options.marginY,
  };
}
