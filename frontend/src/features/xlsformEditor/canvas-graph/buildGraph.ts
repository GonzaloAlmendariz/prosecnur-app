// =============================================================================
// canvas-graph/buildGraph.ts — del workbook al grafo de dependencias
// =============================================================================
// Recorre la estructura + lógica del workbook y produce un grafo dirigido
// de nodes y edges. Lo que nos interesa visualizar:
//
//   * Preguntas (kind=question/note/calculate) — nodes individuales.
//   * Secciones (kind=section/repeat) — nodes contenedor visible.
//   * Catálogos — nodes para `select_one X` / `select_multiple X`.
//
//   * Edges tipadas:
//     - "depends-on" — A.relevant referencia B → B → A.
//     - "validates-with" — A.constraint usa B → B → A.
//     - "calculates-from" — A.calculation usa B → B → A.
//     - "filters-by" — A.choice_filter usa B → B → A.
//     - "uses-catalog" — A es select_X foo → catalog(foo) → A.
//     - "contains" — sección S agrupa pregunta P → S → P.
//
// El grafo es derivado puro (función del workbook + index) y se rebuilds
// en cada cambio. No hay layout aquí — solo topología.
// =============================================================================

import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { collectRefs, parseExpression } from "../logic";

export type GraphNodeKind = "question" | "section" | "catalog";

export type GraphNode = {
  /** Identificador único del nodo en el grafo. Para preguntas/secciones
   *  usamos `q:<rowIndex>`; para catálogos `cat:<listName>`. */
  id: string;
  kind: GraphNodeKind;
  /** Texto principal del nodo (label de la pregunta o nombre del catálogo). */
  title: string;
  /** Texto secundario (nombre técnico para preguntas, conteo de opciones
   *  para catálogos). */
  subtitle: string;
  /** Tipo XLSForm para preguntas (`text`, `select_one`, …). Para
   *  catálogos: "catalog". Para secciones: `begin_group`/`begin_repeat`. */
  baseType: string;
  /** Solo para preguntas/secciones: el rowIndex original del survey. */
  rowIndex?: number;
  /** Solo para catálogos: el listName. */
  listName?: string;
  /** Cantidad de edges entrantes (in-degree) — útil para layout. */
  inDegree: number;
  /** Cantidad de edges salientes (out-degree). */
  outDegree: number;
};

export type GraphEdgeKind =
  | "depends-on"
  | "validates-with"
  | "calculates-from"
  | "filters-by"
  | "uses-catalog"
  | "contains";

export type GraphEdge = {
  /** Origen → Destino. Convención semántica: el origen es lo que
   *  "alimenta" o "contiene" al destino. */
  source: string;
  target: string;
  kind: GraphEdgeKind;
};

export type LogicGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * Construye el grafo a partir del workbook ya estructurado. La función es
 * pura — mismo input → mismo output.
 */
export function buildLogicGraph(
  structure: BuilderStructure,
  catalogs: CatalogSummary[],
): LogicGraph {
  const nodes: GraphNode[] = [];
  const nodeById = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // -- 1. Crear nodos para cada fila relevante (preguntas + secciones) ----
  // Mapas auxiliares para resolver edges por nombre.
  const nodeByVarName = new Map<string, GraphNode>();
  for (const node of structure.outline) {
    if (!node.name) continue;
    const isCatalogQuestion =
      node.typeInfo.base === "select_one" ||
      node.typeInfo.base === "select_multiple";
    const isSectionLike = node.kind === "section" || node.kind === "repeat";
    const id = `q:${node.rowIndex}`;
    const graphNode: GraphNode = {
      id,
      kind: isSectionLike ? "section" : "question",
      title: node.label || node.name,
      subtitle: node.name,
      baseType: node.typeInfo.base,
      rowIndex: node.rowIndex,
      inDegree: 0,
      outDegree: 0,
    };
    nodes.push(graphNode);
    nodeById.set(id, graphNode);
    nodeByVarName.set(node.name, graphNode);

    // Para preguntas select_*, conectaremos al catálogo más abajo.
    void isCatalogQuestion;
  }

  // -- 2. Crear nodos para los catálogos ---------------------------------
  for (const catalog of catalogs) {
    const id = `cat:${catalog.listName}`;
    const graphNode: GraphNode = {
      id,
      kind: "catalog",
      title: catalog.listName,
      subtitle: `${catalog.items.length} ${
        catalog.items.length === 1 ? "opción" : "opciones"
      }`,
      baseType: "catalog",
      listName: catalog.listName,
      inDegree: 0,
      outDegree: 0,
    };
    nodes.push(graphNode);
    nodeById.set(id, graphNode);
  }

  // -- 3. Edges: containment (sección → pregunta) -------------------------
  for (const node of structure.outline) {
    if (node.kind === "section" || node.kind === "repeat") {
      // El span cubre [begin, end]. Las filas dentro pertenecen a esta
      // sección. Pero un grupo NO es padre de sub-grupos directamente —
      // queremos solo edges padre→hijo inmediato, no transitivo.
      // Heurística simple: para cada pregunta dentro del span cuya
      // sectionId apunte a este begin, conectamos.
      const span = structure.spans.get(node.rowIndex);
      if (!span) continue;
      const sectionId = `section-${node.rowIndex}`;
      for (const candidate of structure.outline) {
        if (candidate.rowIndex <= span.start) continue;
        if (candidate.rowIndex >= span.end) continue;
        if (candidate.sectionId !== sectionId) continue;
        edges.push({
          source: `q:${node.rowIndex}`,
          target: `q:${candidate.rowIndex}`,
          kind: "contains",
        });
      }
    }
  }

  // -- 4. Edges: dependencias por expresión -------------------------------
  for (const node of structure.outline) {
    const targetId = `q:${node.rowIndex}`;
    if (!nodeById.has(targetId)) continue;
    pushExpressionDeps(node.relevant, "depends-on", targetId);
    pushExpressionDeps(node.constraint, "validates-with", targetId);
    pushExpressionDeps(node.calculation, "calculates-from", targetId);
    pushExpressionDeps(node.choiceFilter, "filters-by", targetId);
  }

  function pushExpressionDeps(
    expression: string,
    kind: GraphEdgeKind,
    targetId: string,
  ) {
    if (!expression || !expression.trim()) return;
    const ast = parseExpression(expression);
    if (!ast) return;
    const refs = collectRefs(ast);
    for (const refName of refs) {
      const sourceNode = nodeByVarName.get(refName);
      if (!sourceNode) continue;
      // No emitimos auto-loops (ej. `${self} != ''` en su propio relevant).
      if (sourceNode.id === targetId) continue;
      edges.push({ source: sourceNode.id, target: targetId, kind });
    }
  }

  // -- 5. Edges: select_* → catálogo --------------------------------------
  for (const node of structure.outline) {
    if (
      (node.typeInfo.base === "select_one" ||
        node.typeInfo.base === "select_multiple") &&
      node.typeInfo.listName
    ) {
      const catId = `cat:${node.typeInfo.listName}`;
      const qId = `q:${node.rowIndex}`;
      if (nodeById.has(catId) && nodeById.has(qId)) {
        edges.push({ source: catId, target: qId, kind: "uses-catalog" });
      }
    }
  }

  // -- 6. Calcular in/out degree ------------------------------------------
  for (const edge of edges) {
    const src = nodeById.get(edge.source);
    const tgt = nodeById.get(edge.target);
    if (src) src.outDegree += 1;
    if (tgt) tgt.inDegree += 1;
  }

  return { nodes, edges };
}
