// Store del lienzo (ADR 0047).
//
// Undo/redo copiado del patrón ya probado de `features/graficos/store.ts`:
// pilas `past`/`future`, helper `dirty()` que empuja el estado ACTUAL antes de
// aplicar el cambio, y `future` vaciado en cada edición nueva.
//
// Qué entra al snapshot y qué no:
//
//   - Entran nodos y aristas. Es el contenido.
//   - NO entra el viewport. Mover la cámara no es una acción deshacible, y si
//     lo fuera, `Cmd+Z` después de explorar el lienzo desharía el paneo en vez
//     del último cambio real. Misma decisión que Gráficos.
//   - NO entra la selección. Deshacer no debería cambiar qué está elegido.

import { create } from "zustand";

import type { CanvasArista, CanvasLienzo, CanvasNodo } from "../../../api/bitacora";
import { altoDeNodo } from "./ramificacion";

/** Tope de historial. Mismo valor que Gráficos, por la misma razón: memoria. */
const MAX_HISTORY = 30;

type Snapshot = { nodes: CanvasNodo[]; edges: CanvasArista[] };

export type ModoLienzo = "seleccion" | "conectando";

type CanvasState = {
  lienzoId: string;
  nodes: CanvasNodo[];
  edges: CanvasArista[];

  seleccion: Set<string>;
  /** Nodo con foco de teclado. Distinto de la selección: se navega sin elegir. */
  enfocado: string | null;
  /** Nodo en edición de texto. */
  editando: string | null;
  modo: ModoLienzo;

  past: Snapshot[];
  future: Snapshot[];
  /** Hay cambios sin guardar. Lo consume el autosave. */
  sucio: boolean;
  /** Se bombea al hidratar; los derivados lo usan de key. */
  version: number;

  hidratar: (lienzo: CanvasLienzo) => void;
  setNodes: (nodes: CanvasNodo[]) => void;
  setEdges: (edges: CanvasArista[]) => void;
  /** Aplica sin tocar el historial. Para el arrastre en vuelo. */
  moverEnVivo: (posiciones: ReadonlyMap<string, { x: number; y: number }>) => void;
  /** Marca el punto de deshacer ANTES de empezar un gesto. */
  marcarHistorial: () => void;

  seleccionar: (ids: Set<string>) => void;
  enfocar: (id: string | null) => void;
  editar: (id: string | null) => void;
  setModo: (modo: ModoLienzo) => void;

  undo: () => void;
  redo: () => void;
  limpiarSucio: () => void;
  resetForSession: () => void;
};

function snapshot(s: Pick<CanvasState, "nodes" | "edges">): Snapshot {
  return { nodes: s.nodes, edges: s.edges };
}

const INICIAL = {
  lienzoId: "",
  nodes: [] as CanvasNodo[],
  edges: [] as CanvasArista[],
  seleccion: new Set<string>(),
  enfocado: null,
  editando: null,
  modo: "seleccion" as ModoLienzo,
  past: [] as Snapshot[],
  future: [] as Snapshot[],
  sucio: false,
};

export const useCanvasStore = create<CanvasState>((set) => ({
  ...INICIAL,
  version: 0,

  hidratar: (lienzo) =>
    set((s) => ({
      lienzoId: lienzo.id,
      // Un lienzo guardado antes de que el cuadro reservara su franja de
      // anotaciones trae altos que ya no alcanzan para su propio contenido. Se
      // corrigen al entrar en vez de migrar el `.pulso`: el alto es una medida
      // derivada de lo que la tarjeta muestra, no un dato del usuario.
      nodes: lienzo.nodes.map((n) =>
        n.type === "referencia"
          ? { ...n, h: Math.max(n.h, altoDeNodo(n.ref?.target_type === "modulo" ? "modulo" : "entrada", (n.items ?? []).length)) }
          : n,
      ),
      edges: lienzo.edges,
      // Cambiar de lienzo tira el historial: deshacer a través de dos lienzos
      // distintos produciría un estado que nunca existió.
      past: [],
      future: [],
      seleccion: new Set(),
      enfocado: null,
      editando: null,
      sucio: false,
      version: s.version + 1,
    })),

  setNodes: (nodes) =>
    set((s) => ({
      nodes,
      past: [...s.past, snapshot(s)].slice(-MAX_HISTORY),
      future: [],
      sucio: true,
    })),

  setEdges: (edges) =>
    set((s) => ({
      edges,
      past: [...s.past, snapshot(s)].slice(-MAX_HISTORY),
      future: [],
      sucio: true,
    })),

  // Sin historial a propósito: un arrastre produce decenas de posiciones por
  // segundo y cada una sería una entrada. El punto de deshacer se marca UNA vez
  // al empezar el gesto, con `marcarHistorial`.
  moverEnVivo: (posiciones) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = posiciones.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
      sucio: true,
    })),

  marcarHistorial: () =>
    set((s) => ({
      past: [...s.past, snapshot(s)].slice(-MAX_HISTORY),
      future: [],
    })),

  seleccionar: (seleccion) => set({ seleccion }),
  enfocar: (enfocado) => set({ enfocado }),
  editar: (editando) => set({ editando }),
  setModo: (modo) => set({ modo }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previo = s.past[s.past.length - 1];
      return {
        nodes: previo.nodes,
        edges: previo.edges,
        past: s.past.slice(0, -1),
        future: [...s.future, snapshot(s)].slice(-MAX_HISTORY),
        sucio: true,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const siguiente = s.future[s.future.length - 1];
      return {
        nodes: siguiente.nodes,
        edges: siguiente.edges,
        past: [...s.past, snapshot(s)].slice(-MAX_HISTORY),
        future: s.future.slice(0, -1),
        sucio: true,
      };
    }),

  limpiarSucio: () => set({ sucio: false }),
  resetForSession: () => set((s) => ({ ...INICIAL, seleccion: new Set(), version: s.version + 1 })),
}));
