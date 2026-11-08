// Estado UI efímero del mazo «Resumen ejecutivo». Que el panel está abierto vive en la dirección (`panel`); aquí sólo lo
// que el analista va ajustando antes de insertar: públicos y su orden, indicador, referencia, qué propuestas eligió y en
// qué orden, las reglas que editó y qué tarjeta tiene abierta la edición. Nada viene elegido: el mazo arranca vacío.

import { create } from "zustand";
import type { ReglaPreguntas } from "../../../../api/graficosRegla";
import { alternarPublico, moverA, ordenPublicos, REFERENCIA_POR_DEFECTO } from "./modeloMazo";

type MazoUi = {
  /** `null`: todas las bases del estudio. */
  publicos: string[] | null;
  /** El orden de los públicos (el de las filas del panorama); `null`: el del estudio. */
  orden: string[] | null;
  /** `null`: el primero que el estudio permite (Top Two Box). */
  indicador: string | null;
  referencia: number;
  /** Las propuestas que el analista marcó. Arranca vacío. */
  elegidas: Record<string, true>;
  /** El orden de las propuestas que dejó el analista (ids); `null`: el que propone el mazo. */
  ordenPropuestas: string[] | null;
  reglas: Record<string, ReglaPreguntas>;
  editando: string | null;
  /** Al abrir desde un botón: todo de vuelta a la propuesta, sin ninguna elegida. */
  preparar: () => void;
  alternarPublico: (base: string, todas: readonly string[]) => void;
  /** Lleva `desde` al lugar de `hasta` dentro de `todas` (en su orden actual). */
  moverPublico: (desde: string, hasta: string, todas: readonly string[]) => void;
  elegirIndicador: (id: string) => void;
  ponerReferencia: (n: number) => void;
  alternarElegida: (id: string) => void;
  elegirTodas: (ids: readonly string[]) => void;
  elegirNinguna: () => void;
  /** Fija el orden de las propuestas (los ids, en el orden nuevo). */
  ordenarPropuestas: (ids: readonly string[]) => void;
  ponerRegla: (id: string, regla: ReglaPreguntas) => void;
  editar: (id: string | null) => void;
};

const inicial = () => ({
  publicos: null, orden: null, indicador: null, referencia: REFERENCIA_POR_DEFECTO,
  elegidas: {}, ordenPropuestas: null, reglas: {}, editando: null,
}) satisfies Partial<MazoUi>;

export const useMazoResumenUi = create<MazoUi>((set) => ({
  ...inicial(),
  preparar: () => set(inicial()),
  // Cambiar de públicos cambia las propuestas: las reglas editadas eran de otras candidatas.
  alternarPublico: (base, todas) => set((s) => {
    const ordenadas = ordenPublicos(s.orden, todas);
    return { publicos: alternarPublico(s.publicos ?? ordenadas, base, ordenadas), reglas: {}, editando: null };
  }),
  // Ordenar no cambia las candidatas: las reglas editadas siguen valiendo.
  moverPublico: (desde, hasta, todas) => set((s) => ({ orden: moverA(ordenPublicos(s.orden, todas), desde, hasta) })),
  elegirIndicador: (indicador) => set({ indicador }),
  ponerReferencia: (referencia) => set({ referencia }),
  alternarElegida: (id) => set((s) => {
    const elegidas = { ...s.elegidas };
    if (elegidas[id]) delete elegidas[id];
    else elegidas[id] = true;
    return { elegidas };
  }),
  elegirTodas: (ids) => set({ elegidas: Object.fromEntries(ids.map((id) => [id, true as const])) }),
  elegirNinguna: () => set({ elegidas: {} }),
  ordenarPropuestas: (ids) => set({ ordenPropuestas: [...ids] }),
  ponerRegla: (id, regla) => set((s) => ({ reglas: { ...s.reglas, [id]: regla } })),
  editar: (editando) => set({ editando }),
}));
