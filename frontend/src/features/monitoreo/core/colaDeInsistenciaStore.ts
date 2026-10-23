import { create } from "zustand";
import { FILTROS_INICIALES, type FiltrosDeCola } from "./colaDeInsistenciaModel";

/**
 * Filtros de la cola de insistencia: estado de interfaz efímero, no del
 * proyecto. Sobrevive al cambio de pestaña dentro de la sesión y no viaja en
 * el `.pulso`. El caso elegido sí es dirección (`panel=caso&foco=…`).
 */
type EstadoDeFiltros = {
  filtros: FiltrosDeCola;
  cambiar: (parcial: Partial<FiltrosDeCola>) => void;
  limpiar: () => void;
};

export const useFiltrosDeCola = create<EstadoDeFiltros>()((set) => ({
  filtros: FILTROS_INICIALES,
  cambiar: (parcial) => set((estado) => ({ filtros: { ...estado.filtros, ...parcial } })),
  limpiar: () => set({ filtros: FILTROS_INICIALES }),
}));
