// Estado de la vista de las pestañas de tablas que no cambia el archivo: qué
// cifras se leen en la tabla del centro. Es efímero (no se guarda en la config
// ni en la dirección): cambiarlo no pide nada al servicio, solo muestra u
// oculta columnas que ya llegaron.

import { create } from "zustand";

/** Qué cifras se leen en la tabla: los casos (o el N ponderado), el porcentaje o los dos. */
export type ModoDeCifras = "casos" | "porcentaje" | "ambos";

export type PestanaDeTablas = "frecuencias" | "cruces";

type VistaDeTablas = {
  cifras: Record<PestanaDeTablas, ModoDeCifras>;
  elegirCifras: (pestana: PestanaDeTablas, modo: ModoDeCifras) => void;
};

/** Como el prototipo: Frecuencias abre con las dos cifras; Cruces, con el porcentaje. */
export const CIFRAS_INICIALES: Readonly<Record<PestanaDeTablas, ModoDeCifras>> = { frecuencias: "ambos", cruces: "porcentaje" };

export const useVistaDeTablas = create<VistaDeTablas>((set) => ({
  cifras: { ...CIFRAS_INICIALES },
  elegirCifras: (pestana, modo) => set((s) => ({ cifras: { ...s.cifras, [pestana]: modo } })),
}));

/** La columna de casos se ve con "Casos" o "Ambos". */
export function seVenCasos(modo: ModoDeCifras): boolean {
  return modo !== "porcentaje";
}

/** La columna de porcentaje se ve con "Porcentaje" o "Ambos". */
export function seVePorcentaje(modo: ModoDeCifras): boolean {
  return modo !== "casos";
}
