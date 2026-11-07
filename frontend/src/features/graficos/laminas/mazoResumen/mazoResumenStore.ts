// Estado UI efímero del mazo «Resumen ejecutivo». Que el panel está abierto vive en la dirección (`panel`); aquí sólo lo
// que el analista va ajustando antes de insertar: públicos, indicador, referencia, qué propuestas quitó, las reglas que
// editó y qué tarjeta tiene abierta la edición.

import { create } from "zustand";
import type { ReglaPreguntas } from "../../../../api/graficosRegla";
import { alternarPublico, REFERENCIA_POR_DEFECTO } from "./modeloMazo";

type MazoUi = {
  /** `null`: todas las bases del estudio. */
  publicos: string[] | null;
  /** `null`: el primero que el estudio permite (Top Two Box). */
  indicador: string | null;
  referencia: number;
  quitadas: Record<string, true>;
  reglas: Record<string, ReglaPreguntas>;
  editando: string | null;
  /** Al abrir desde un botón: todo de vuelta a la propuesta. */
  preparar: () => void;
  alternarPublico: (base: string, todas: readonly string[]) => void;
  elegirIndicador: (id: string) => void;
  ponerReferencia: (n: number) => void;
  alternarQuitada: (id: string) => void;
  ponerRegla: (id: string, regla: ReglaPreguntas) => void;
  editar: (id: string | null) => void;
};

const INICIAL = {
  publicos: null, indicador: null, referencia: REFERENCIA_POR_DEFECTO, quitadas: {}, reglas: {}, editando: null,
} satisfies Partial<MazoUi>;

export const useMazoResumenUi = create<MazoUi>((set) => ({
  ...INICIAL,
  preparar: () => set({ ...INICIAL, quitadas: {}, reglas: {} }),
  // Cambiar de públicos cambia las propuestas: las reglas editadas eran de otras candidatas.
  alternarPublico: (base, todas) => set((s) => ({ publicos: alternarPublico(s.publicos ?? todas, base, todas), reglas: {}, editando: null })),
  elegirIndicador: (indicador) => set({ indicador }),
  ponerReferencia: (referencia) => set({ referencia }),
  alternarQuitada: (id) => set((s) => {
    const quitadas = { ...s.quitadas };
    if (quitadas[id]) delete quitadas[id];
    else quitadas[id] = true;
    return { quitadas, editando: s.editando === id ? null : s.editando };
  }),
  ponerRegla: (id, regla) => set((s) => ({ reglas: { ...s.reglas, [id]: regla } })),
  editar: (editando) => set({ editando }),
}));
