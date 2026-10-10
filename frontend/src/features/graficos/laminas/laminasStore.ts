// Estado UI efímero de la pestaña Láminas (F6.1). El plan vive en `usePlanStore` y en el backend; aquí sólo lo que la
// vista recuerda mientras está abierta: qué parte se mira, qué sección del inspector, qué ramas del árbol están
// cerradas, la búsqueda y lo que el motor contó de cada lámina ya vista (para el punto de estado del árbol).

import { create } from "zustand";
import type { EstadoSalida } from "./estadoLamina";

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
  estructuraVisible: boolean;
  alternarEstructura: () => void;
  /** Preferencia de la sesión: el inspector oculto en el marco ancho (la lámina gana su ancho). */
  inspectorOculto: boolean;
  setInspectorOculto: (v: boolean) => void;
  /**
   * «Insertar después de esta lámina» abre la biblioteca de láminas del editor, que agrega al final. Mientras la
   * biblioteca está abierta, lo que se inserte se acomoda detrás de `despuesDe` (y en cadena, si se insertan varias).
   */
  insercion: { despuesDe: string; previos: string[]; vioPanel: boolean } | null;
  /** Editor ancho abierto desde una tarjeta de gráfico (bloques de multiapiladas o filtros), sobre visor e inspector. */
  editorAmplio: { tipo: "bloques" | "filtros"; slideId: string; slot: string } | null;
  setEditorAmplio: (e: { tipo: "bloques" | "filtros"; slideId: string; slot: string } | null) => void;
  setInsercion: (i: { despuesDe: string; previos: string[]; vioPanel: boolean } | null) => void;
  setZoom: (z: ZoomVisor) => void;
  alternarTira: () => void;
  registrarMiniatura: (slideId: string, png: string) => void;
  setParte: (parte: number) => void;
  setSeccionInspector: (s: SeccionInspector) => void;
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
  estructuraVisible: true,
  inspectorOculto: false,
  setInspectorOculto: (inspectorOculto) => set({ inspectorOculto }),
  insercion: null,
  editorAmplio: null,
  setEditorAmplio: (editorAmplio) => set({ editorAmplio }),
  setInsercion: (insercion) => set({ insercion }),
  alternarEstructura: () => set((s) => ({ estructuraVisible: !s.estructuraVisible })),
  setZoom: (zoom) => set({ zoom }),
  alternarTira: () => set((s) => ({ tiraVisible: !s.tiraVisible })),
  registrarMiniatura: (slideId, png) => set((s) => (s.miniaturas[slideId] === png ? s : { miniaturas: { ...s.miniaturas, [slideId]: png } })),
  setParte: (parte) => set({ parte: Math.max(1, Math.floor(parte)) }),
  setSeccionInspector: (seccionInspector) => set({ seccionInspector }),
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
