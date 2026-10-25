import type { EstadoDelModo } from "../shell/BarraDelModo";

/**
 * Piezas de la barra del modo que no dependen del modo: el corte corto y la
 * píldora de estado. Nacieron en `profiles/telefonico/navegacion/barraTelefonica.ts`;
 * viven aquí para que Acreditación (y quien siga) no copie ni importe del
 * perfil telefónico.
 */

/** «27/07/26 09:04», sin la coma que pone el locale. */
export function corteCorto(valor: string | null | undefined): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${dos(fecha.getFullYear() % 100)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function estadoDelModo({
  actualizando,
  cargando,
  hayEstado,
  generationStatus,
  pendienteDeRecalcular,
  error,
}: {
  actualizando: boolean;
  cargando: boolean;
  hayEstado: boolean;
  generationStatus: string;
  pendienteDeRecalcular: boolean;
  error: string;
}): EstadoDelModo {
  if (actualizando) return { clave: "actualizando" };
  if (error) return { clave: "fallo", detalle: error };
  if (generationStatus === "failed" || generationStatus === "partial") return { clave: "fallo" };
  if (!hayEstado || cargando) return { clave: "preparando" };
  // Sin un quinto estado (§2a): el tablero aún no refleja los cambios, y el
  // menú lo dice en «Recalcular».
  if (pendienteDeRecalcular || generationStatus === "stale") return { clave: "preparando", detalle: "Hay cambios sin recalcular" };
  return { clave: "al-dia" };
}
