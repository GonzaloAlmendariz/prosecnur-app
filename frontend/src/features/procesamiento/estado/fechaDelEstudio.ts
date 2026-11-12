// Fechas cortas de Estado del estudio: "9 nov", y con el año cuando no es el
// actual ("9 nov 2025"). Los meses van escritos a mano: el Node de las pruebas
// no trae ICU completo y `toLocaleDateString("es-PE")` degrada a otro idioma.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"] as const;

/** El instante de una marca del motor ("2026-11-09T14:00:00Z"); `null` si no es una fecha. */
export function instanteDe(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!limpio || limpio === "NA") return null;
  // Un día sin hora es ese día en la zona del usuario, no la medianoche UTC (que en Lima es la víspera).
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio);
  if (dia) return new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])).getTime();
  const ms = Date.parse(limpio);
  return Number.isFinite(ms) ? ms : null;
}

/** "9 nov", o "9 nov 2025" si el año no es el de `hoy`. `null` si no es una fecha. */
export function fechaCorta(valor: unknown, hoy: Date = new Date()): string | null {
  const ms = instanteDe(valor);
  if (ms === null) return null;
  const fecha = new Date(ms);
  const dia = `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === hoy.getFullYear() ? dia : `${dia} ${fecha.getFullYear()}`;
}
