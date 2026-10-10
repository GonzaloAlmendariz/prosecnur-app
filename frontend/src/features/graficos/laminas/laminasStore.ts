// Estado UI efímero de la pestaña Láminas (F6.1). El plan vive en `usePlanStore` y en el backend; aquí sólo lo que la
// vista recuerda mientras está abierta: qué parte se mira, qué sección del inspector, qué ramas del árbol están
// cerradas, la búsqueda y lo que el motor contó de cada lámina ya vista (para el punto de estado del árbol).

import { create } from "zustand";
import type { EstadoSalida } from "./estadoLamina";

export type SeccionInspector = "contenido" | "composicion" | "graficos" | "estado";

export type ResumenLamina = { estado: EstadoSalida | null; partes: number; avisos: number };

type LaminasUiStore = {
  /** Parte «(cont.)» activa, 1-based; vuelve a 1 al cambiar de lámina. */
  parte: number;
  seccionInspector: SeccionInspector;
  consulta: string;
  cerrados: Record<string, true>;
  /** Por id de lámina, lo que dijo la última vista previa. Se olvida al cambiar de sesión (recarga). */
  resumenes: Record<string, ResumenLamina>;
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
    if (prev && prev.estado === r.estado && prev.partes === r.partes && prev.avisos === r.avisos) return s;
    return { resumenes: { ...s.resumenes, [slideId]: r } };
  }),
}));
