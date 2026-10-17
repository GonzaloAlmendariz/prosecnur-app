/**
 * Cuándo «Guardar receta» se puede pulsar y qué hace al pulsarlo.
 *
 * Sin cambios no sale el PUT: guardar sube `state_revision` y deja viejas las
 * fichas creadas, así que confiar en el `noop` del backend para un guardado
 * vacío pone en juego cada ficha vigente por un clic que no cambia nada.
 */

export type EntradaDelGuardado = {
  /** Hay borrador cargado. */
  hayBorrador: boolean;
  /** `state_revision` del módulo; sin ella no se guarda. */
  revision: number | null;
  conCambios: boolean;
  guardando: boolean;
  /** Unidades del plan cubiertas por fichas vigentes. */
  fichasCreadas: number;
};

export type EstadoDelGuardado = {
  habilitado: boolean;
  /** Por qué no se puede guardar (el `title` del botón), o `null`. */
  motivo: string | null;
  /** Qué hace el clic: avisar antes, guardar o nada. */
  accion: "confirmar" | "guardar" | null;
};

export const SIN_CAMBIOS_QUE_GUARDAR = "Sin cambios que guardar";

export function estadoDelGuardado(entrada: EntradaDelGuardado): EstadoDelGuardado {
  if (!entrada.hayBorrador || entrada.revision === null) {
    return { habilitado: false, motivo: "La receta todavía no está lista para guardarse", accion: null };
  }
  if (entrada.guardando) return { habilitado: false, motivo: "Guardando la receta", accion: null };
  if (!entrada.conCambios) return { habilitado: false, motivo: SIN_CAMBIOS_QUE_GUARDAR, accion: null };
  return { habilitado: true, motivo: null, accion: entrada.fichasCreadas > 0 ? "confirmar" : "guardar" };
}
