/** El resumen del historial de ruteos plegado: cuántos sorteos hay y si uno es la muestra en uso. */
export const resumenHistorial = (n: number, hayEnUso: boolean) =>
  n === 0 ? "Sin sorteos todavía" : `${n} sorteo${n === 1 ? "" : "s"}${hayEnUso ? (n === 1 ? ", en uso" : ", uno en uso") : ", ninguno en uso"}`;
