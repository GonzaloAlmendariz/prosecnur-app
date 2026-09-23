import { fmt } from "./kpisDeAulas";

/**
 * Lo que «Traer respuestas» retiró de la distribución de aplicadores, en una frase.
 *
 * Gonzalo, 2026-09-23: «¿y si le doy a actualizar en dos horas y ya se
 * aplicaron sin agenda otras aulas, éstas se van también?». Se van —el sync las
 * retira de los días siguientes— y la pantalla lo dice, para que no haya que
 * abrir el Sheets a comprobarlo. Un fallo se dice con su causa.
 */
export type RetiroDeLaDistribucion = {
  ok?: boolean;
  retiradas?: number;
  mensaje?: string;
  filas?: Array<{ pestana?: string; codigo?: string; fecha?: string }> | null;
};

export function fraseDelRetiro(
  retiro: RetiroDeLaDistribucion | null | undefined,
): { texto: string; tono: "ok" | "atencion" } | null {
  if (!retiro) return null;
  if (retiro.ok === false) {
    return {
      texto: `No se pudo limpiar la distribución de aplicadores: ${retiro.mensaje ?? "sin detalle"}.`,
      tono: "atencion",
    };
  }
  const n = Number(retiro.retiradas) || 0;
  if (n <= 0) return null;
  const filas = Array.isArray(retiro.filas) ? retiro.filas : [];
  const codigos = [...new Set(filas.map((f) => String(f?.codigo ?? "").trim()).filter(Boolean))];
  const cuales = codigos.length
    ? ` (${codigos.slice(0, 4).join(", ")}${codigos.length > 4 ? ` y ${fmt(codigos.length - 4)} más` : ""})`
    : "";
  return {
    texto: `La distribución de aplicadores dejó de listar ${n === 1 ? "1 fila" : `${fmt(n)} filas`} de cursos-horario ya aplicados o cerrados${cuales}.`,
    tono: "ok",
  };
}
