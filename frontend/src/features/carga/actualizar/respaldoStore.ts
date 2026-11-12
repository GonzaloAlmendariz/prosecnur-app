// La copia para volver de cada base, tal como la devolvió el motor al aplicar o
// en la última vista previa. Estado UI efímero: la copia vive en la sesión del
// backend y no viaja en el `.pulso`. La clave lleva el `sid`, así que otro
// proyecto u otra sesión no heredan el botón "Volver a la versión anterior".

import { create } from "zustand";
import type { RespaldoDeActualizacion } from "../../../api/cargaActualizar";
import { getSession } from "../../../api/core";

type RespaldosState = {
  porBase: Record<string, RespaldoDeActualizacion | null>;
  guardar: (base: string, respaldo: RespaldoDeActualizacion | null) => void;
};

export function claveDeRespaldo(base: string, sid: string | null = getSession()): string {
  return `${sid ?? ""}::${base}`;
}

export const useRespaldos = create<RespaldosState>((set) => ({
  porBase: {},
  guardar: (base, respaldo) => set((s) => ({ porBase: { ...s.porBase, [claveDeRespaldo(base)]: respaldo } })),
}));

export function useRespaldoDe(base: string): RespaldoDeActualizacion | null {
  return useRespaldos((s) => s.porBase[claveDeRespaldo(base)] ?? null);
}
