// Lo que dejó la última exportación (avisos del motor) y la validación previa (avisos antes de exportar). La página los
// guarda aquí y el panel «Avisos del informe» los muestra: antes se pintaban como dos bloques fijos sobre el editor que
// empujaban todo hacia abajo (Gonzalo, 2026-10-14: «pensé que era un botón que se abría en el sidebar»).
import { create } from "zustand";

type Estado = {
  motor: string[];
  previos: string[];
  ponerMotor: (avisos: readonly string[]) => void;
  ponerPrevios: (avisos: readonly string[]) => void;
};

export const useAvisosExportacion = create<Estado>((set) => ({
  motor: [],
  previos: [],
  ponerMotor: (avisos) => set({ motor: avisos.filter(Boolean) }),
  ponerPrevios: (avisos) => set({ previos: avisos.filter(Boolean) }),
}));
