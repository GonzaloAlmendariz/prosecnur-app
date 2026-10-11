// Estado UI efímero del editor del índice (A5 rebanada 2b, W2). El índice vive en el payload de la lámina (plan →
// backend); aquí sólo lo que el editor recuerda mientras se edita:
// - el borrador, cuando la última edición no se pudo guardar (un título con «:» o «|» y subcapítulos) o lleva líneas
//   que el payload no representa (un capítulo recién añadido, sin título). Se ata a la `firmaIndice` del payload que
//   tenía al escribirse: si el payload cambia por otra vía (deshacer, otro editor) el borrador se descarta solo;
// - qué capítulo eligió ícono (la biblioteca es `panel=iconos`; el capítulo no es una dimensión de la dirección).

import { create } from "zustand";
import type { IndiceEditable } from "./modeloIndice";

export type BorradorIndice = { slideId: string; firma: string; indice: IndiceEditable };

type IndiceUiStore = {
  borrador: BorradorIndice | null;
  /** Capítulo (0-based) cuyo ícono se elige en la biblioteca. */
  capituloIcono: number | null;
  setBorrador: (b: BorradorIndice | null) => void;
  setCapituloIcono: (i: number | null) => void;
};

export const useIndiceUi = create<IndiceUiStore>((set) => ({
  borrador: null,
  capituloIcono: null,
  setBorrador: (borrador) => set({ borrador }),
  setCapituloIcono: (capituloIcono) => set({ capituloIcono }),
}));

/** El borrador si sigue correspondiendo a esta lámina y a su payload actual; si no, `null`. */
export function borradorVigente(borrador: BorradorIndice | null, slideId: string, firma: string): IndiceEditable | null {
  return borrador && borrador.slideId === slideId && borrador.firma === firma ? borrador.indice : null;
}
