// La mesa de Carga entrega a la pestaña Bases lo que su cabecera necesita del
// riel (rótulo, ícono y estado de la pestaña): Bases dibuja su propia cabecera
// porque lleva sus cifras y "Agregar base" a la derecha del título, y esas cifras
// salen de la colección, que vive en la pestaña.

import { createContext, useContext } from "react";
import type { CargaWorkspaceContext, CargaWorkspaceTab } from "../../CargaWorkspaceModel";

export type CabeceraDeCarga = { activa: CargaWorkspaceTab; contexto: CargaWorkspaceContext };

export const CabeceraDeCargaContexto = createContext<CabeceraDeCarga | null>(null);

/** `null` fuera de la mesa de Carga: entonces la pestaña no dibuja cabecera propia. */
export function useCabeceraDeCarga(): CabeceraDeCarga | null {
  return useContext(CabeceraDeCargaContexto);
}

/** Las pestañas que dibujan su propia cabecera dentro de la mesa. */
export function pestanaConCabeceraPropia(activa: CargaWorkspaceTab): boolean {
  return activa === "bases";
}
