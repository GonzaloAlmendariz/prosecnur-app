// Vaciar el plan (C14), puro: cuándo se puede, qué ofrece el menú ⋯ y la regla única de que sólo vacía tras confirmar.
// Lo usan la barra de Láminas y el header del Editor de la era ggplot a través de `useVaciarPlan`; no hay otra copia.

import type { Disponibilidad, DisponibilidadCompartir } from "./disponibilidadCompartir";

export const MOTIVO_VACIAR_SIN_LAMINAS = "El plan ya está vacío: no hay láminas que quitar.";
export const MENSAJE_PLAN_VACIADO = "Plan vaciado. Deshacer lo revierte.";

/** Disponible según el alcance y, además, sólo si hay láminas que quitar. */
export function disponibilidadVaciarPlan(d: DisponibilidadCompartir, nLaminas: number): Disponibilidad {
  if (!d.vaciarPlan.habilitado) return d.vaciarPlan;
  return nLaminas > 0 ? d.vaciarPlan : { habilitado: false, motivo: MOTIVO_VACIAR_SIN_LAMINAS };
}

export type ItemVaciarMenu = { etiqueta: string; detalle: string; habilitado: boolean };

export function itemVaciarMenu(d: Disponibilidad): ItemVaciarMenu {
  return {
    etiqueta: "Vaciar el plan…",
    detalle: d.habilitado ? "Quita todas las láminas; pide confirmación y se deshace" : d.motivo,
    habilitado: d.habilitado,
  };
}

export type EstadoVaciar = { pendiente: boolean; mensaje: string };
export type AccionVaciar =
  | { tipo: "pedir" }
  | { tipo: "cancelar" }
  | { tipo: "hecho" }
  | { tipo: "limpiar-mensaje" };

export const ESTADO_VACIAR_INICIAL: EstadoVaciar = { pendiente: false, mensaje: "" };

export function vaciarReducer(estado: EstadoVaciar, accion: AccionVaciar): EstadoVaciar {
  switch (accion.tipo) {
    case "pedir": return { pendiente: true, mensaje: "" };
    case "cancelar": return { ...estado, pendiente: false };
    case "hecho": return { pendiente: false, mensaje: MENSAJE_PLAN_VACIADO };
    case "limpiar-mensaje": return { ...estado, mensaje: "" };
  }
}

/**
 * La única puerta al `reset` del store: vacía sólo con una confirmación explícita y si el alcance y el plan lo permiten.
 * Devuelve si vació.
 */
export function vaciarSiConfirmado(confirmado: boolean, disponibilidad: Disponibilidad, reset: () => void): boolean {
  if (!confirmado || !disponibilidad.habilitado) return false;
  reset();
  return true;
}
