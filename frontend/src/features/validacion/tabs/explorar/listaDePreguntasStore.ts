import { create } from "zustand";

/**
 * Estado de la lista "Preguntas" de Explorar, efímero y por base: qué
 * secciones están plegadas, si el buscador está abierto y qué se escribió. Lo
 * comparten la cabecera del contenedor (lupa, expandir y comprimir) y la lista.
 * No se guarda en el proyecto.
 */
export type EstadoDeLaLista = {
  plegadas: string[];
  buscando: boolean;
  consulta: string;
};

export const ESTADO_INICIAL: EstadoDeLaLista = { plegadas: [], buscando: false, consulta: "" };

type Store = {
  porBase: Record<string, EstadoDeLaLista>;
  /** Pliega o despliega una sección. */
  alternar: (base: string, seccion: string) => void;
  /** Deja plegadas exactamente estas secciones (vacío: todas abiertas). */
  fijarPlegadas: (base: string, plegadas: string[]) => void;
  /** Abre estas secciones sin tocar las demás. */
  abrir: (base: string, secciones: string[]) => void;
  abrirBuscador: (base: string) => void;
  /** Cierra el buscador y borra lo escrito. */
  cerrarBuscador: (base: string) => void;
  /** Guarda lo escrito y abre las secciones con coincidencias. */
  buscar: (base: string, consulta: string, conCoincidencias: string[]) => void;
};

function cambiar(
  porBase: Record<string, EstadoDeLaLista>,
  base: string,
  cambio: (e: EstadoDeLaLista) => Partial<EstadoDeLaLista>,
): Record<string, EstadoDeLaLista> {
  const actual = porBase[base] ?? ESTADO_INICIAL;
  return { ...porBase, [base]: { ...actual, ...cambio(actual) } };
}

const sin = (lista: string[], quitar: string[]) => {
  const fuera = new Set(quitar);
  return lista.filter((n) => !fuera.has(n));
};

export const useListaDePreguntasStore = create<Store>((set) => ({
  porBase: {},
  alternar: (base, seccion) =>
    set((s) => ({
      porBase: cambiar(s.porBase, base, (e) => ({
        plegadas: e.plegadas.includes(seccion) ? sin(e.plegadas, [seccion]) : [...e.plegadas, seccion],
      })),
    })),
  fijarPlegadas: (base, plegadas) => set((s) => ({ porBase: cambiar(s.porBase, base, () => ({ plegadas })) })),
  abrir: (base, secciones) =>
    set((s) => {
      const actual = s.porBase[base] ?? ESTADO_INICIAL;
      if (!secciones.some((n) => actual.plegadas.includes(n))) return s;
      return { porBase: cambiar(s.porBase, base, (e) => ({ plegadas: sin(e.plegadas, secciones) })) };
    }),
  abrirBuscador: (base) => set((s) => ({ porBase: cambiar(s.porBase, base, () => ({ buscando: true })) })),
  cerrarBuscador: (base) => set((s) => ({ porBase: cambiar(s.porBase, base, () => ({ buscando: false, consulta: "" })) })),
  buscar: (base, consulta, conCoincidencias) =>
    set((s) => ({
      porBase: cambiar(s.porBase, base, (e) => ({
        consulta,
        plegadas: consulta.trim() ? sin(e.plegadas, conCoincidencias) : e.plegadas,
      })),
    })),
}));

/** El estado de la lista de una base. */
export function useEstadoDeLaLista(base: string): EstadoDeLaLista {
  return useListaDePreguntasStore((s) => s.porBase[base] ?? ESTADO_INICIAL);
}
