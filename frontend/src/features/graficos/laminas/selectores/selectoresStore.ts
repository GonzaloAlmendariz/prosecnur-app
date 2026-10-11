// Estado UI efímero de los selectores de tipo (F6.2). Qué panel está abierto y qué lámina o ranura se cambia viven en
// la dirección (`panel`, `foco`); aquí sólo lo que el analista va eligiendo dentro del diálogo.

import { create } from "zustand";
import type { SlideType } from "../../../../api/graficos";
import type { FamiliaGrafico } from "./tiposGrafico";
import type { IntencionLamina } from "./tiposLamina";

/** «cambiar» la lámina del foco o «insertar» una nueva detrás de ella. */
export type ModoSelectorLamina = "cambiar" | "insertar";

type SelectoresUi = {
  modoLamina: ModoSelectorLamina;
  intencion: IntencionLamina | null;
  candidato: SlideType | null;
  variante: string | null;
  /** Segundo paso de «Usar esta lámina» cuando hay gráficos o textos que no caben. */
  confirmando: boolean;
  familia: FamiliaGrafico | null;
  candidatoGrafico: string | null;
  /** Al abrir el selector de lámina: modo y elección limpia (la intención la deriva el diálogo de la lámina). */
  prepararLamina: (modo: ModoSelectorLamina) => void;
  elegirIntencion: (i: IntencionLamina) => void;
  elegirCandidato: (tipo: SlideType, variante: string | null) => void;
  elegirVariante: (v: string) => void;
  setConfirmando: (c: boolean) => void;
  prepararGrafico: () => void;
  elegirFamilia: (f: FamiliaGrafico) => void;
  elegirGrafico: (nombre: string) => void;
};

export const useSelectoresUi = create<SelectoresUi>((set) => ({
  modoLamina: "cambiar",
  intencion: null,
  candidato: null,
  variante: null,
  confirmando: false,
  familia: null,
  candidatoGrafico: null,
  prepararLamina: (modoLamina) => set({ modoLamina, intencion: null, candidato: null, variante: null, confirmando: false }),
  elegirIntencion: (intencion) => set({ intencion, candidato: null, variante: null, confirmando: false }),
  elegirCandidato: (candidato, variante) => set({ candidato, variante, confirmando: false }),
  elegirVariante: (variante) => set({ variante, confirmando: false }),
  setConfirmando: (confirmando) => set({ confirmando }),
  prepararGrafico: () => set({ familia: null, candidatoGrafico: null }),
  elegirFamilia: (familia) => set({ familia, candidatoGrafico: null }),
  elegirGrafico: (candidatoGrafico) => set({ candidatoGrafico }),
}));
