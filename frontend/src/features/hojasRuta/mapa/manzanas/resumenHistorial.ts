/** El resumen del historial de ruteos plegado: cuántos sorteos hay y si uno es la muestra en uso. */
export const resumenHistorial = (n: number, hayEnUso: boolean) =>
  n === 0 ? "Sin sorteos todavía" : `${n} sorteo${n === 1 ? "" : "s"}${hayEnUso ? (n === 1 ? ", en uso" : ", uno en uso") : ", ninguno en uso"}`;

/**
 * La etiqueta de un ruteo viene del motor cosida con punto medio (U+00B7) entre fecha, N y
 * manzanas, y así quedó guardada en los ruteos viejos: en pantalla se separa con comas (contrato P3).
 */
export const etiquetaRuteo = (label: string) => label.split(/\s*\u00b7\s*/).filter(Boolean).join(", ");
