import { create } from "zustand";

/**
 * Filtros de Control › Por resolver: estado de interfaz efímero. El caso
 * elegido sí es dirección (`panel=caso&foco=<response_id>`).
 */
type EstadoDeFiltros = {
  /** `null` = el tipo con que abre la bandeja (el primero que espera decisión). */
  tipo: string | null;
  publico: string | null;
  elegirTipo: (tipo: string | null) => void;
  elegirPublico: (publico: string | null) => void;
};

export const useFiltrosPorResolver = create<EstadoDeFiltros>()((set) => ({
  tipo: null,
  publico: null,
  elegirTipo: (tipo) => set({ tipo }),
  elegirPublico: (publico) => set({ publico }),
}));
