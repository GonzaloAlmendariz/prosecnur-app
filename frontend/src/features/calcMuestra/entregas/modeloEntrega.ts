// Cálculo de muestra sobre el kit de entregables (ADR 0133, fase 5): lo que el
// módulo agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_CALC_MUESTRA`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `TITULO_REPORTE`: un mismo nombre para el reporte en las tres mesas (antes
//   «Reporte metodológico» en aulas y «Reporte del diseño» en las generales).

import type { EstadoGeneracion } from "../../../components/entregables/tipos";

export const MODULO_CALC_MUESTRA = "Cálculo de muestra";
export const TITULO_REPORTE = "Reporte metodológico";

/** Lo que una tarjeta necesita de una generación que vive en la página: su estado y cómo cerrarla. */
export type EntregaEnPantalla = { estado: EstadoGeneracion; onCerrar: () => void };

/** Las tres piezas del paquete de defensa, cada una con su contenedor (la memoria JSON la arma el front). */
export type PaqueteDefensaEntregas = {
  reporte: EntregaEnPantalla;
  anexo: EntregaEnPantalla;
  memoria: EntregaEnPantalla;
};

/** Nombre del archivo de la memoria del paquete de defensa (archivo local del kit; ver memoriaDefensa.ts). */
export function nombreMemoriaDefensa(fecha: Date = new Date()): string {
  return `memoria-defensa-${fecha.toISOString().slice(0, 10)}.json`;
}
