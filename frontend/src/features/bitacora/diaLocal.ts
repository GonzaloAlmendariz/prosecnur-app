/**
 * Día calendario LOCAL de un instante ISO, en `AAAA-MM-DD`.
 *
 * `iso.slice(0, 10)` toma el día UTC, y con eso una entrada de las 20:21 del 28
 * en Lima aparecía bajo el 29 mientras su hora seguía diciendo 20:21. Agrupar
 * por un día y mostrar la hora de otro es la trampa de husos que nombra el
 * ADR 0047: las dos cosas tienen que salir del mismo reloj.
 *
 * Vive fuera del timeline porque el nodo de referencia del lienzo muestra la
 * misma fecha y arrastraba el mismo desfase.
 */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin-fecha";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
