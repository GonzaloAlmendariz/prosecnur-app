// =============================================================================
// canvas-graph/autoLayout.ts — algoritmo de capas para posicionar nodos
// =============================================================================
// Sugiyama-light: capas por longest-path desde fuentes (in-degree=0),
// dentro de cada capa los nodos se ordenan por orden de aparición original
// (preguntas) o alfabético (catálogos).
//
// Sin librerías externas — el algoritmo es suficiente para grafos de los
// instrumentos del corpus (≤ ~150 nodos). Para grafos más grandes habría
// que pasar a `dagre` o `elk`, pero nos ahorramos ~30 KB gz por ahora.
// =============================================================================

import type { GraphEdge, GraphNode, LogicGraph } from "./buildGraph";

export type LaidOutNode = GraphNode & {
  /** Posición x absoluta (px) en el canvas. */
  x: number;
  /** Posición y absoluta (px). */
  y: number;
  /** Capa (depth desde fuentes). */
  layer: number;
};

export type LaidOutEdge = GraphEdge & {
  /** Endpoints calculados (centros de los nodos respectivos). */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type LaidOutGraph = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
};

/**
 * Configuración del layout. Los defaults producen un grafo legible para
 * formularios típicos (ESPP, GIZ, HST). Para RMS (4 niveles, 59 listas)
 * conviene aumentar `layerGap` y achicar `nodeWidth`.
 */
export type LayoutOptions = {
  nodeWidth: number;
  nodeHeight: number;
  layerGap: number;
  rowGap: number;
  marginX: number;
  marginY: number;
};

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 200,
  nodeHeight: 56,
  layerGap: 80,
  rowGap: 14,
  marginX: 40,
  marginY: 40,
};

export function layoutLogicGraph(
  graph: LogicGraph,
  optionsOverride: Partial<LayoutOptions> = {},
): LaidOutGraph {
  const options = { ...DEFAULT_OPTIONS, ...optionsOverride };
  const { nodes, edges } = graph;

  if (nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // -- 1. Calcular capas via longest-path desde fuentes (in-degree=0) ----
  // Filtramos las edges "contains" del cálculo de capas porque crearían
  // capas artificiales (la sección "contiene" sus preguntas pero
  // visualmente queremos las preguntas debajo de las cosas que las
  // alimentan, no debajo de su sección contenedora).
  const adjOut = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    adjOut.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (edge.kind === "contains") continue;
    adjOut.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      layer.set(node.id, 0);
      queue.push(node.id);
    }
  }

  // BFS por capas (longest path entre fuentes).
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

  // Cualquier nodo sin capa (raro: un ciclo) lo plantamos en capa 0.
  for (const node of nodes) {
    if (!layer.has(node.id)) layer.set(node.id, 0);
  }

  // -- 2. Agrupar por capa, ordenar dentro de cada capa ------------------
  const byLayer = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const l = layer.get(node.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(node);
  }
  for (const arr of byLayer.values()) {
    arr.sort((a, b) => {
      // Catálogos al fondo de su capa.
      if (a.kind !== b.kind) {
        if (a.kind === "catalog") return 1;
        if (b.kind === "catalog") return -1;
        if (a.kind === "section") return -1;
        if (b.kind === "section") return 1;
      }
      // Por rowIndex si ambos son preguntas/secciones.
      if (a.rowIndex != null && b.rowIndex != null) {
        return a.rowIndex - b.rowIndex;
      }
      return a.title.localeCompare(b.title);
    });
  }

  const layerCount = Math.max(...byLayer.keys()) + 1;

  // -- 3. Asignar coordenadas --------------------------------------------
  const laidOutNodes: LaidOutNode[] = [];
  const positions = new Map<string, { x: number; y: number }>();

  for (let l = 0; l < layerCount; l += 1) {
    const inLayer = byLayer.get(l) ?? [];
    const layerHeight = inLayer.length * options.nodeHeight + (inLayer.length - 1) * options.rowGap;
    const startY = options.marginY + maxLayerHeight(byLayer, options) / 2 - layerHeight / 2;

    for (let i = 0; i < inLayer.length; i += 1) {
      const node = inLayer[i]!;
      const x = options.marginX + l * (options.nodeWidth + options.layerGap);
      const y = startY + i * (options.nodeHeight + options.rowGap);
      const placed: LaidOutNode = { ...node, x, y, layer: l };
      laidOutNodes.push(placed);
      positions.set(node.id, {
        x: x + options.nodeWidth / 2,
        y: y + options.nodeHeight / 2,
      });
    }
  }

  // -- 4. Calcular endpoints de cada edge --------------------------------
  const laidOutEdges: LaidOutEdge[] = edges.map((edge) => {
    const from = positions.get(edge.source) ?? { x: 0, y: 0 };
    const to = positions.get(edge.target) ?? { x: 0, y: 0 };
    return { ...edge, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y };
  });

  // -- 5. Tamaño total del canvas ----------------------------------------
  const width =
    options.marginX * 2 + layerCount * options.nodeWidth + (layerCount - 1) * options.layerGap;
  const height = options.marginY * 2 + maxLayerHeight(byLayer, options);

  return { nodes: laidOutNodes, edges: laidOutEdges, width, height };
}

function maxLayerHeight(
  byLayer: Map<number, GraphNode[]>,
  options: LayoutOptions,
): number {
  let max = 0;
  for (const arr of byLayer.values()) {
    const h = arr.length * options.nodeHeight + (arr.length - 1) * options.rowGap;
    if (h > max) max = h;
  }
  return max;
}
