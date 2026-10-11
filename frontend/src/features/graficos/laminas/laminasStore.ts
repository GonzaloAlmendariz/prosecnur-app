// Estado UI efímero de la pestaña Láminas (F6.1). El plan vive en `usePlanStore` y en el backend; aquí sólo lo que la
// vista recuerda mientras está abierta: qué parte se mira, qué sección del inspector, qué ramas del árbol están
// cerradas, la búsqueda y lo que el motor contó de cada lámina ya vista (para el punto de estado del árbol).

import { create } from "zustand";
import type { EstadoSalida } from "./estadoLamina";
import type { Lateral } from "./lateralLaminas";

export type SeccionInspector = "contenido" | "composicion" | "graficos" | "estado";

export type ResumenLamina = { estado: EstadoSalida | null; partes: number; avisos: number; avisosTexto?: string[] };

/** «ajustar» encaja la lámina entera en el lienzo; los demás la agrandan sobre ese ajuste y el lienzo se desplaza. */
export type ZoomVisor = "ajustar" | "125" | "150";

type LaminasUiStore = {
  /** Parte «(cont.)» activa, 1-based; vuelve a 1 al cambiar de lámina. */
  parte: number;
  seccionInspector: SeccionInspector;
  consulta: string;
  cerrados: Record<string, true>;
  /** Por id de lámina, lo que dijo la última vista previa. Se olvida al cambiar de sesión (recarga). */
  resumenes: Record<string, ResumenLamina>;
  /** Imagen de la parte 1 de cada lámina ya vista: la tira la usa en vez de pedir renders en masa. */
  miniaturas: Record<string, string>;
  zoom: ZoomVisor;
  tiraVisible: boolean;
  /** Plegar la Estructura deja a la lámina el ancho de esa columna (la tira sigue navegando). */
  /** Lateral abierto que se recuerda por sesión (Estructura e Inspector se excluyen); null = la lámina a todo lo ancho. */
  lateral: Lateral | null;
  setLateral: (l: Lateral | null) => void;
  /** Editor ancho abierto desde una tarjeta de gráfico (bloques de multiapiladas o filtros), sobre visor e inspector. */
  editorAmplio: { tipo: "bloques" | "filtros"; slideId: string; slot: string } | null;
  setEditorAmplio: (e: { tipo: "bloques" | "filtros"; slideId: string; slot: string } | null) => void;
  setZoom: (z: ZoomVisor) => void;
  alternarTira: () => void;
  registrarMiniatura: (slideId: string, png: string) => void;
  setParte: (parte: number) => void;
  setSeccionInspector: (s: SeccionInspector) => void;
  /** Láminas en las que se pidió «Ver cómo queda»: sólo ésas lanzan la vista previa del motor. */
  vistasPedidas: Record<string, true>;
  pedirVista: (slideId: string) => void;
  setConsulta: (q: string) => void;
  alternarNodo: (id: string) => void;
  fijarCerrados: (ids: string[]) => void;
  registrarResumen: (slideId: string, r: ResumenLamina) => void;
};

export const useLaminasUi = create<LaminasUiStore>((set) => ({
  parte: 1,
  seccionInspector: "contenido",
  consulta: "",
  cerrados: {},
  resumenes: {},
  miniaturas: {},
  zoom: "ajustar",
  tiraVisible: true,
  lateral: "estructura",
  setLateral: (lateral) => set({ lateral }),
  editorAmplio: null,
  setEditorAmplio: (editorAmplio) => set({ editorAmplio }),
  setZoom: (zoom) => set({ zoom }),
  alternarTira: () => set((s) => ({ tiraVisible: !s.tiraVisible })),
  registrarMiniatura: (slideId, png) => set((s) => (s.miniaturas[slideId] === png ? s : { miniaturas: { ...s.miniaturas, [slideId]: png } })),
  setParte: (parte) => set({ parte: Math.max(1, Math.floor(parte)) }),
  setSeccionInspector: (seccionInspector) => set({ seccionInspector }),
  vistasPedidas: {},
  pedirVista: (slideId) => set((s) => (s.vistasPedidas[slideId] ? s : { vistasPedidas: { ...s.vistasPedidas, [slideId]: true } })),
  setConsulta: (consulta) => set({ consulta }),
  alternarNodo: (id) => set((s) => {
    const cerrados = { ...s.cerrados };
    if (cerrados[id]) delete cerrados[id];
    else cerrados[id] = true;
    return { cerrados };
  }),
  fijarCerrados: (ids) => set({ cerrados: Object.fromEntries(ids.map((id) => [id, true as const])) }),
  registrarResumen: (slideId, r) => set((s) => {
    const prev = s.resumenes[slideId];
    if (prev && prev.estado === r.estado && prev.partes === r.partes && prev.avisos === r.avisos
      && (prev.avisosTexto ?? []).join("\n") === (r.avisosTexto ?? []).join("\n")) return s;
    return { resumenes: { ...s.resumenes, [slideId]: r } };
  }),
}));
