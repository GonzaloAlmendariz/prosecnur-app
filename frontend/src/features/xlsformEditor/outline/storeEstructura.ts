import { create } from "zustand";
import type { FiltroRapido } from "./modeloEstructura";

// Estado UI efímero de la Estructura del Constructor (2026-10-17): qué secciones están plegadas y qué se busca.
// Sobrevive a cambiar de pestaña y vuelve a cero al recargar o al abrir OTRO formulario (o proyecto): el estado es
// de un formulario, y una búsqueda o un plegado de uno no deben aparecer en el siguiente. Las secciones se recuerdan
// por su código (la fila cambia al mover o insertar); sin código, por su fila.

export const clavePlegado = (name: string, rowIndex: number) => (name ? `n:${name}` : `f:${rowIndex}`);

type EstadoEstructura = {
  /** Formulario al que pertenece el estado (null: ninguno todavía). */
  formulario: string | null;
  plegadas: ReadonlySet<string>;
  consulta: string;
  filtro: FiltroRapido;
  alternarPlegada: (clave: string) => void;
  fijarPlegada: (clave: string, plegada: boolean) => void;
  plegarTodas: (claves: readonly string[]) => void;
  desplegarTodas: () => void;
  setConsulta: (consulta: string) => void;
  setFiltro: (filtro: FiltroRapido) => void;
  limpiarBusqueda: () => void;
  /** Deja el estado en cero si pertenece a otro formulario. */
  abrirFormulario: (formulario: string | null) => void;
};

const INICIAL = { plegadas: new Set<string>() as ReadonlySet<string>, consulta: "", filtro: "todas" as FiltroRapido };

/** Lo que se pinta para `formulario`: si el estado guardado es de otro, el inicial (hasta que `abrirFormulario`
 * lo reinicie). Así no se ve ni un cuadro con la búsqueda del formulario anterior. */
export function estadoDe(s: EstadoEstructura, formulario: string | null): typeof INICIAL {
  return s.formulario === formulario ? s : INICIAL;
}

export const useEstructuraStore = create<EstadoEstructura>((set) => ({
  formulario: null,
  ...INICIAL,
  alternarPlegada: (clave) =>
    set((s) => {
      const next = new Set(s.plegadas);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return { plegadas: next };
    }),
  fijarPlegada: (clave, plegada) =>
    set((s) => {
      if (s.plegadas.has(clave) === plegada) return s;
      const next = new Set(s.plegadas);
      if (plegada) next.add(clave);
      else next.delete(clave);
      return { plegadas: next };
    }),
  plegarTodas: (claves) => set({ plegadas: new Set(claves) }),
  desplegarTodas: () => set({ plegadas: new Set<string>() }),
  setConsulta: (consulta) => set({ consulta }),
  setFiltro: (filtro) => set({ filtro }),
  limpiarBusqueda: () => set({ consulta: "", filtro: "todas" }),
  abrirFormulario: (formulario) => set((s) => (s.formulario === formulario ? s : { formulario, ...INICIAL, plegadas: new Set<string>() })),
}));
