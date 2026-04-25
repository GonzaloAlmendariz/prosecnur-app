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
  layerGap: 90,
  rowGap: 16,
  innerGap: 12,
  childIndent: 18,
  marginX: 40,
  marginY: 40,
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

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const root of rootNodes) {
    if ((inDeg.get(root.id) ?? 0) === 0) {
      layer.set(root.id, 0);
      queue.push(root.id);
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const myLayer = layer.get(id) ?? 0;
    for (const next of adjOut.get(id) ?? []) {
      const candidate = myLayer + 1;
      if (candidate > (layer.get(next) ?? -1)) {
        layer.set(next, candidate);
        queue.push(next);
      }
    }
  }
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

  const resolveVisible = (id: string): LaidOutNode | null => {
    const placed = positionByNodeId.get(id);
    if (!placed) return null;
    if (placed.visible) return placed;
    // Caminar hacia arriba en el árbol del grafo.
    const findParent = (target: GraphNode): GraphNode | null => {
      const visit = (current: GraphNode): GraphNode | null => {
        for (const child of current.children) {
          if (child.id === target.id) return current;
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      for (const root of rootNodes) {
        if (root.id === target.id) return null;
        const found = visit(root);
        if (found) return found;
      }
      return null;
    };
    let cursor: GraphNode | null = placed.node;
    while (cursor) {
      const visible = positionByNodeId.get(cursor.id);
      if (visible && visible.visible) return visible;
      cursor = findParent(cursor);
    }
    return null;
  };

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
    laidOutEdges.push({
      edge,
      fromX: fromVisible.x + fromVisible.width,
      fromY: fromVisible.y + Math.min(fromVisible.height, options.rowHeight) / 2,
      toX: toVisible.x,
      toY: toVisible.y + Math.min(toVisible.height, options.rowHeight) / 2,
    });
  }

  return {
    nodes: flatNodes,
    edges: laidOutEdges,
    width: canvasWidth,
    height: maxLayerBottom + options.marginY,
  };
}
