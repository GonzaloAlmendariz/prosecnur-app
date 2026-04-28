import { PlanGraphNode } from "./buildPlanGraph";

// Grilla determinística de 6 columnas por fila. Cada slide ocupa una
// celda. El layout se calcula en función del orden global de los slides
// y la sección a la que pertenecen — los slides reinician la columna a 0
// al inicio de cada nueva sección (definida por slides tipo
// `p_slide_seccion`).
//
// Snap to grid es siempre activo: al soltar un slide se cae a la celda
// más cercana. Sin layout libre.

export const COLS_PER_ROW = 6;
export const NODE_W = 220;
export const NODE_H = 160;
export const COL_GAP = 16;
export const ROW_GAP = 16;
export const SECTION_HEADER_H = 36;
export const SECTION_PAD = 12;
export const SECTION_VGAP = 24;

// Tamaño de celda (incluyendo gap interno)
export const CELL_W = NODE_W + COL_GAP;
export const CELL_H = NODE_H + ROW_GAP;

// Ancho total del contenedor de una sección con N columnas
export const SECTION_W = COLS_PER_ROW * NODE_W + (COLS_PER_ROW - 1) * COL_GAP + SECTION_PAD * 2;

export type SectionGroup = {
  /** id estable derivado del slide separador (o "intro" si los slides
   *  vienen antes del primer separador). */
  id: string;
  /** Título humano: del payload `titulo` del slide separador, o
   *  "Inicio" si es el grupo previo al primer separador. */
  title: string;
  /** Indica si esta sección arranca con un slide tipo p_slide_seccion. */
  isSeparator: boolean;
  /** Indices globales (en el plan completo) de los slides que componen
   *  esta sección. Incluye al separador en la posición 0 si aplica. */
  globalIndices: number[];
  /** Slides de esta sección. */
  nodes: PlanGraphNode[];
};

export type CanvasLayout = {
  groups: SectionGroup[];
  /** Map id de slide → posición (x, y) absoluta en el lienzo. */
  positions: Map<string, { x: number; y: number; col: number; row: number; sectionId: string }>;
  /** Map sección id → bbox del recuadro de la sección en el lienzo. */
  sectionBoxes: Map<string, { x: number; y: number; w: number; h: number; rows: number }>;
  width: number;
  height: number;
};

// Agrupa los nodos del plan en secciones. Una nueva sección comienza con
// cualquier slide tipo `p_slide_seccion`. Los slides al inicio del plan
// previos al primer separador pertenecen a una sección sintética
// "Inicio".
export function groupBySection(nodes: PlanGraphNode[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let current: SectionGroup | null = null;

  for (const node of nodes) {
    const isSep = node.slide.tipo === "p_slide_seccion";
    if (isSep || current === null) {
      // Nueva sección. El título solo se hereda del payload cuando el
      // slide es un separador real; los slides previos al primer
      // separador van a una sección sintética llamada "Inicio".
      const id = isSep ? `sec-${node.id}` : "sec-intro";
      const titulo = isSep
        ? (typeof node.slide.payload.titulo === "string" && node.slide.payload.titulo
            ? (node.slide.payload.titulo as string)
            : "Sección sin título")
        : "Inicio";
      current = {
        id,
        title: titulo,
        isSeparator: isSep,
        globalIndices: [],
        nodes: [],
      };
      groups.push(current);
    }
    current.nodes.push(node);
    current.globalIndices.push(node.index);
  }

  return groups;
}

// Calcula posiciones de cada slide y bboxes de cada sección.
export function planAutoLayout(nodes: PlanGraphNode[]): CanvasLayout {
  const groups = groupBySection(nodes);
  const positions = new Map<string, { x: number; y: number; col: number; row: number; sectionId: string }>();
  const sectionBoxes = new Map<string, { x: number; y: number; w: number; h: number; rows: number }>();

  let cursorY = 0;
  let maxX = 0;

  for (const group of groups) {
    const nodesInGroup = group.nodes;
    const rows = Math.max(1, Math.ceil(nodesInGroup.length / COLS_PER_ROW));
    const sectionH =
      SECTION_HEADER_H + SECTION_PAD * 2 + rows * NODE_H + (rows - 1) * ROW_GAP;
    const sectionX = 0;
    const sectionY = cursorY;

    sectionBoxes.set(group.id, {
      x: sectionX,
      y: sectionY,
      w: SECTION_W,
      h: sectionH,
      rows,
    });

    // Posicionar cada slide dentro de la sección
    nodesInGroup.forEach((node, i) => {
      const col = i % COLS_PER_ROW;
      const row = Math.floor(i / COLS_PER_ROW);
      const x = sectionX + SECTION_PAD + col * (NODE_W + COL_GAP);
      const y =
        sectionY + SECTION_HEADER_H + SECTION_PAD + row * (NODE_H + ROW_GAP);
      positions.set(node.id, { x, y, col, row, sectionId: group.id });
    });

    cursorY += sectionH + SECTION_VGAP;
    if (SECTION_W > maxX) maxX = SECTION_W;
  }

  return {
    groups,
    positions,
    sectionBoxes,
    width: maxX,
    height: Math.max(0, cursorY - SECTION_VGAP),
  };
}

// Encuentra la celda (sectionId, col, row, insertIndexLocal) más cercana
// a un punto (x, y) absoluto del lienzo. Devuelve también el "índice
// global" donde insertar un slide arrastrado (clamp 0..plan.length).
export function findDropTarget(
  layout: CanvasLayout,
  point: { x: number; y: number },
): { sectionId: string; localIndex: number; globalIndex: number } | null {
  // Encuentra primero la sección por bbox (la más cercana en Y; clamp).
  let chosen: { id: string; box: { x: number; y: number; w: number; h: number; rows: number } } | null = null;
  let bestDy = Infinity;
  for (const [id, box] of layout.sectionBoxes) {
    const cy = box.y + box.h / 2;
    const dy = Math.abs(point.y - cy);
    if (point.y >= box.y && point.y <= box.y + box.h) {
      chosen = { id, box };
      break;
    }
    if (dy < bestDy) {
      bestDy = dy;
      chosen = { id, box };
    }
  }
  if (!chosen) return null;

  const group = layout.groups.find((g) => g.id === chosen!.id);
  if (!group) return null;

  // Convierte (x, y) a (col, row) dentro de la sección.
  const localX = Math.max(0, point.x - chosen.box.x - SECTION_PAD);
  const localY = Math.max(
    0,
    point.y - chosen.box.y - SECTION_HEADER_H - SECTION_PAD,
  );

  let col = Math.round(localX / (NODE_W + COL_GAP));
  let row = Math.round(localY / (NODE_H + ROW_GAP));
  col = Math.max(0, Math.min(COLS_PER_ROW - 1, col));
  row = Math.max(0, Math.min(chosen.box.rows - 1, row));

  let localIndex = row * COLS_PER_ROW + col;
  localIndex = Math.max(0, Math.min(group.nodes.length, localIndex));

  // global index = primer global index de esta sección + localIndex
  const firstGlobal = group.globalIndices[0] ?? 0;
  const globalIndex = firstGlobal + localIndex;

  return { sectionId: chosen.id, localIndex, globalIndex };
}
