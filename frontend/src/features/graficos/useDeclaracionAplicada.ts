// Avisos de la siembra del informe compartido (`preflight.equivalencias.avisos`, ADR 0096): hoy, las bases que no entran
// por no tener release aprobada. GraficosPage los recibe del preflight y los deja aquí para que Láminas los muestre sin
// volver a pedirlo.
//
// ADR 0102: la matriz de equivalencias ya no arma láminas, así que no hay «declaración aplicada» que contrastar ni aviso
// de desfase; el hook conserva su nombre y su forma para sus cuatro consumidores.
//
// Estado UI efímero (zustand): los avisos se derivan del backend y se vuelven a pedir al montar; nada se persiste.

import { useMemo } from "react";
import { create } from "zustand";
import type { GraficosAvisoEquivalencias } from "../../api/graficos";

type AvisosStore = {
  avisosSiembra: GraficosAvisoEquivalencias[];
  fijarAvisosSiembra: (avisos: readonly GraficosAvisoEquivalencias[]) => void;
};

const useAvisosStore = create<AvisosStore>((set) => ({
  avisosSiembra: [],
  fijarAvisosSiembra: (avisos) => set({ avisosSiembra: [...avisos] }),
}));

/** Lo fija GraficosPage con lo que trae el preflight del compartido (y lo vacía fuera de él). */
export function fijarAvisosSiembraCompartido(avisos: readonly GraficosAvisoEquivalencias[]): void {
  const previos = useAvisosStore.getState().avisosSiembra;
  const iguales = previos.length === avisos.length
    && previos.every((a, i) => a.code === avisos[i]?.code && a.message === avisos[i]?.message);
  if (!iguales) useAvisosStore.getState().fijarAvisosSiembra(avisos);
}

export type DeclaracionAplicada = {
  /** Los avisos de la siembra del compartido, sin repetir. */
  avisos: string[];
};

export function useDeclaracionAplicada(): DeclaracionAplicada {
  const avisosSiembra = useAvisosStore((s) => s.avisosSiembra);
  return useMemo(() => ({ avisos: [...new Set(avisosSiembra.map((a) => a.message))] }), [avisosSiembra]);
}
