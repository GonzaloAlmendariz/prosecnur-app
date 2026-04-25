// =============================================================================
// canvas-graph/buildGraph.ts — del workbook al grafo de visibilidad
// =============================================================================
// El canvas Obsidian-style se enfoca exclusivamente en VISIBILIDAD: qué
// pregunta o sección se condiciona a qué otra (campo `relevant` del
// XLSForm). Constraint, calculation, choice_filter y catálogos viven en
// el inspector — meterlos al canvas crea ruido sin sumar valor estructural.
//
// Modelo del grafo (rediseño post-feedback):
//
//   * Solo dos tipos de node:
//       - "section"  — begin_group / begin_repeat. Tiene `children` con las
//                      preguntas (y sub-secciones) que viven adentro.
//       - "question" — pregunta normal o calculate / note. Si es select_one
//                      o select_multiple guardamos `catalogContext` con el
//                      nombre y conteo del catálogo, para mostrarlo INLINE
//                      dentro de la card. NO hay nodo separado para catálogos.
//
//   * Solo un tipo de edge:
//       - "depends-on" — A.relevant referencia B → B → A. La conexión
//                        representa "B condiciona la aparición de A".
//                        Containment, uses-catalog, validates-with,
//                        calculates-from y filters-by ya no son edges
//                        del grafo: la jerarquía se renderiza como árbol
//                        colapsable, los demás campos solo viven en el
//                        inspector.
//
// El grafo es derivado puro (función del workbook + index). Mismo input
// → mismo output.
// =============================================================================

import type { BuilderStructure, CatalogSummary, ChoiceItem } from "../types";
import { collectRefs, parseExpression } from "../logic";

export type GraphNodeKind = "question" | "section";

/**
 * Contexto compacto del catálogo asignado a una pregunta select. Se
 * dibuja como mini-chip dentro de la card de la pregunta (sin que sea
 * un nodo separado del grafo).
 */
export type CatalogContext = {
  listName: string;
  itemCount: number;
  /** Hasta 5 opciones para mostrar como pista; el resto se resume en
   *  "+ N más". */
  preview: ChoiceItem[];
};

export type GraphNode = {
  /** Identificador único del nodo. `q:<rowIndex>` para preguntas y
   *  secciones — la única forma posible ahora que los catálogos no son
   *  nodos. */
  id: string;
  kind: GraphNodeKind;
  /** Nombre técnico (campo `name` del XLSForm). Único en el survey y se
   *  usa en expresiones ODK como `${name}`. */
  name: string;
  /** Texto visible del nodo (label de la pregunta / nombre de la sección). */
  title: string;
  /** Texto secundario que se muestra debajo del título. Para preguntas
   *  es el `name`; para secciones es `<name> · N preguntas dentro`. */
  subtitle: string;
  /** Tipo XLSForm. Para secciones: `begin_group` / `begin_repeat`.
   *  Para preguntas: `text`, `select_one`, `integer`, etc. */
  baseType: string;
  /** rowIndex original del survey — para que el canvas pueda saltar al
   *  inspector al click. */
  rowIndex: number;
  /** Para secciones: lista de hijos (preguntas y sub-secciones). Vacía
   *  si la sección no tiene contenido todavía. */
  children: GraphNode[];
  /** Para preguntas select_one / select_multiple: contexto del catálogo
   *  asignado, para mostrarlo inline en la card. */
  catalogContext?: CatalogContext;
  /** Color pastel HSL determinístico de la sección a la que pertenece
   *  el nodo (igual que `PreguntasPanel.tsx` en el módulo de carga).
   *  Para top-level nodes el color es null y la card mantiene fondo
   *  blanco. Para hijos de una sección expandida, el color tiñe sutil
   *  el fondo para que el ojo agrupe visualmente. */
  sectionColor: string | null;
  /** Expresión `relevant` cruda — para mostrar en el detail panel y en
   *  el hover del edge ("si X = Y"). Solo en los nodos que tienen
   *  visibilidad condicional. */
  relevantExpression: string | null;
  /** Visibilidad que esta pregunta/sección hereda implícitamente de
   *  algún ancestro sección con `relevant`. Si ningún ancestro tiene
   *  relevant, queda null. Si hay varios (anidados), guardamos la
   *  cadena más cercana → más lejana — así la card puede mostrar
   *  "heredado de Sección A (que a su vez depende de Sección B)".
   *
   *  Casos en los que es útil: imagine una sección "Datos del jefe"
   *  con `relevant = ${tiene_jefe} = 'si'`. Las preguntas dentro NO
   *  tienen relevant propio, pero implícitamente NO se muestran si
   *  `tiene_jefe ≠ 'si'`. Esto refleja esa cadena. */
  inheritedRelevant: Array<{
    /** Id del ancestro sección que aporta esta capa de visibilidad. */
    fromSectionId: string;
    /** Nombre técnico del ancestro — para que el caller sepa qué
     *  sección referenciar. */
    fromSectionName: string;
    /** Label visible del ancestro. */
    fromSectionLabel: string;
    /** Expresión `relevant` de ese ancestro. */
    expression: string;
  }>;
};

/**
 * Tipo de relación entre source y target. Aunque todos los edges del
 * canvas representan visibilidad (`relevant`), distinguimos qué nivel
 * granular tienen para que el usuario lea de un vistazo si la
 * dependencia es macro (sección → sección) o micro (variable → variable
 * dentro de la misma sección):
 *
 *   * "section-to-section"   — A y B son ambas secciones (macro).
 *   * "variable-to-section"  — una pregunta condiciona una sección
 *                              entera (afecta a todo lo que vive dentro).
 *   * "section-to-variable"  — una sección condiciona una pregunta
 *                              individual (raro pero sintácticamente
 *                              posible si el `relevant` referencia
 *                              `${seccion_name}`).
 *   * "variable-to-variable" — ambos extremos son preguntas (micro).
 */
export type EdgeRelationKind =
  | "section-to-section"
  | "variable-to-section"
  | "section-to-variable"
  | "variable-to-variable";

export type GraphEdge = {
  source: string;
  target: string;
  /** Visibilidad — único tipo lógico que el canvas modela. */
  kind: "depends-on";
  /** Granularidad de los extremos (sección/variable) para diferenciar
   *  visualmente edges macro vs micro. */
  relation: EdgeRelationKind;
};

export type LogicGraph = {
  /** Nodes top-level: secciones raíz + preguntas que NO están dentro de
   *  ninguna sección (caso raro pero posible — preguntas previas al
   *  primer begin_group, por ejemplo). */
  rootNodes: GraphNode[];
  /** Todos los edges depends-on, indexados por id de source/target. La
   *  resolución (a qué nodo "real" apunta el edge cuando hay sección
   *  colapsada en medio) se hace en el render. */
  edges: GraphEdge[];
  /** Indexa todos los nodos del árbol — incluso los anidados — para
   *  lookup O(1) en el render. */
  byId: Map<string, GraphNode>;
};

/**
 * Construye el grafo a partir del workbook ya estructurado.
 */
export function buildLogicGraph(
  structure: BuilderStructure,
  catalogs: CatalogSummary[],
): LogicGraph {
  // Indexamos catálogos para lookup rápido.
  const catalogMap = new Map<string, CatalogSummary>();
  for (const catalog of catalogs) {
    catalogMap.set(catalog.listName, catalog);
  }

  // -- 1. Crear todos los nodes (sin parent), con catalogContext donde aplique --
  const byId = new Map<string, GraphNode>();
  const nodeByVarName = new Map<string, GraphNode>();
  for (const node of structure.outline) {
    if (!node.name) continue;
    const isSection = node.kind === "section" || node.kind === "repeat";
    const id = `q:${node.rowIndex}`;
    const graphNode: GraphNode = {
      id,
      kind: isSection ? "section" : "question",
      name: node.name,
      title: node.label || node.name,
      subtitle: node.name,
      baseType: node.typeInfo.base,
      rowIndex: node.rowIndex,
      children: [],
      sectionColor: null, // se asigna en paso 5
      relevantExpression: node.relevant ? node.relevant : null,
      inheritedRelevant: [], // se calcula en paso 6
    };
    // Catalog context para selects.
    if (
      (node.typeInfo.base === "select_one" ||
        node.typeInfo.base === "select_multiple") &&
      node.typeInfo.listName
    ) {
      const catalog = catalogMap.get(node.typeInfo.listName);
      if (catalog) {
        graphNode.catalogContext = {
          listName: catalog.listName,
          itemCount: catalog.items.length,
          preview: catalog.items.slice(0, 5),
        };
      }
    }
    byId.set(id, graphNode);
    nodeByVarName.set(node.name, graphNode);
  }

  // -- 2. Construir el árbol: cada pregunta/sección apunta a su contenedor --
  // `structure.rowToSectionId` mapea rowIndex → id de su sección padre
  // ("section-<rowIndex_del_begin>" o "section-root" para top-level).
  const rootNodes: GraphNode[] = [];
  for (const outlineNode of structure.outline) {
    const node = byId.get(`q:${outlineNode.rowIndex}`);
    if (!node) continue;
    const sectionId = structure.rowToSectionId.get(outlineNode.rowIndex);
    if (!sectionId || sectionId === "section-root") {
      rootNodes.push(node);
      continue;
    }
    // El sectionId es del estilo `section-<beginRow>`; la sección está
    // en byId con id `q:<beginRow>`.
    const parentBeginRow = sectionId.replace(/^section-/, "");
    const parentNode = byId.get(`q:${parentBeginRow}`);
    if (parentNode && parentNode.kind === "section") {
      parentNode.children.push(node);
    } else {
      // Si por alguna razón no encontramos el padre (datos corruptos),
      // colocamos el nodo como root para no perderlo.
      rootNodes.push(node);
    }
  }

  // -- 3. Edges: solo `relevant` — lo que el usuario llama "lógica" --
  const edges: GraphEdge[] = [];
  for (const outlineNode of structure.outline) {
    const targetId = `q:${outlineNode.rowIndex}`;
    const targetNode = byId.get(targetId);
    if (!targetNode) continue;
    const expression = outlineNode.relevant;
    if (!expression || !expression.trim()) continue;
    const ast = parseExpression(expression);
    if (!ast) continue;
    const refs = collectRefs(ast);
    for (const refName of refs) {
      const sourceNode = nodeByVarName.get(refName);
      if (!sourceNode) continue;
      if (sourceNode.id === targetId) continue; // sin auto-loops
      // Tipo de relación según granularidad de los extremos. Útil para
      // diferenciar visualmente edges macro (sec↔sec) de micro (var↔var
      // dentro de la misma sección).
      const srcIsSection = sourceNode.kind === "section";
      const tgtIsSection = targetNode.kind === "section";
      const relation: EdgeRelationKind = srcIsSection && tgtIsSection
        ? "section-to-section"
        : !srcIsSection && tgtIsSection
          ? "variable-to-section"
          : srcIsSection && !tgtIsSection
            ? "section-to-variable"
            : "variable-to-variable";
      edges.push({
        source: sourceNode.id,
        target: targetId,
        kind: "depends-on",
        relation,
      });
    }
  }

  // -- 4. Subtítulo enriquecido para secciones colapsadas --
  // "<name técnico> · N preguntas dentro" (el campo `name` queda intacto).
  for (const node of byId.values()) {
    if (node.kind === "section") {
      const count = countQuestionsDeep(node);
      const noun = count === 1 ? "pregunta" : "preguntas";
      node.subtitle = `${node.name} · ${count} ${noun}`;
    }
  }

  // -- 5. Color por sección (hash determinístico igual a PreguntasPanel) --
  // Cada sección recibe un color pastel HSL único; sus hijos lo heredan.
  // Las top-level questions (sin sección padre) tienen color = null y
  // la card se queda con fondo blanco.
  for (const root of rootNodes) {
    if (root.kind === "section") {
      const color = pastelHueFromName(root.name);
      root.sectionColor = color;
      paintChildren(root, color);
    }
  }

  // -- 6. Visibilidad heredada de secciones ancestro --
  // Recorre el árbol top-down. Para cada nodo, si su sección padre tiene
  // `relevant`, esa condición se le agrega a `inheritedRelevant`. Como
  // bajamos recursivamente, cada nodo acumula la cadena de ancestros
  // condicionales (más cercano primero, más lejano al final).
  //
  // Ejemplo: sec_padre.relevant = ${X}=1, sec_hija.relevant = ${Y}=2,
  //          pregunta dentro de sec_hija → inheritedRelevant = [sec_hija, sec_padre].
  const inheritFrom = (
    parents: GraphNode["inheritedRelevant"],
    current: GraphNode,
  ): void => {
    current.inheritedRelevant = parents;
    if (current.kind === "section") {
      const next: GraphNode["inheritedRelevant"] = current.relevantExpression
        ? [
            {
              fromSectionId: current.id,
              fromSectionName: current.name,
              fromSectionLabel: current.title,
              expression: current.relevantExpression,
            },
            ...parents,
          ]
        : parents;
      for (const child of current.children) inheritFrom(next, child);
    }
  };
  for (const root of rootNodes) inheritFrom([], root);

  return { rootNodes, edges, byId };
}

/** Pinta recursivamente el `sectionColor` de los hijos de una sección. */
function paintChildren(parent: GraphNode, color: string) {
  for (const child of parent.children) {
    child.sectionColor = color;
    if (child.kind === "section") {
      // Sub-sección: si quiere, podríamos darle un tono distinto, pero
      // por simplicidad heredamos el del ancestro top-level.
      paintChildren(child, color);
    }
  }
}

/**
 * Hash determinístico nombre → color pastel HSL. Misma fórmula que usa
 * `PreguntasPanel.tsx` para que el ojo asocie las secciones del canvas
 * con las del módulo de Carga (consistencia cross-feature).
 */
function pastelHueFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 42%, 95%)`;
}

/** Cuenta recursivamente las preguntas (no secciones) dentro de un nodo. */
function countQuestionsDeep(node: GraphNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.kind === "question") count += 1;
    else count += countQuestionsDeep(child);
  }
  return count;
}
