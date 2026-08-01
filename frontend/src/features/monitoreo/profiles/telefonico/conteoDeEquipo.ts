/**
 * Cuántas personas hay detrás de las filas de un bloque de equipo.
 *
 * Los bloques telefónicos del engine vienen por (Actor, Responsable), así que
 * una persona que cubre dos componentes ocupa dos filas. Contar filas y
 * llamarlas «responsables» convierte cuatro encuestadores en ocho: es lo que
 * decía «8 responsables» en el PDM Medios de Vida, donde el equipo son cuatro
 * personas con dos asignaciones cada una.
 *
 * La granularidad por asignación no es un error —«Producción por responsable y
 * asignación» la nombra en su título— pero el conteo tiene que decir la verdad
 * sobre lo que cuenta.
 */
export function resumenDeEquipo(nombres: string[]): {
  personas: number;
  asignaciones: number;
  etiqueta: string;
} {
  const limpios = nombres.map((nombre) => nombre.trim()).filter(Boolean);
  const personas = new Set(limpios.map((nombre) => nombre.toLocaleLowerCase("es"))).size;
  const asignaciones = limpios.length;
  const plural = (cantidad: number, singular: string, prural: string) => (
    `${cantidad} ${cantidad === 1 ? singular : prural}`
  );
  // Solo se nombran las asignaciones cuando aportan algo: si cada persona tiene
  // una, decir «4 responsables · 4 asignaciones» es ruido.
  const etiqueta = asignaciones > personas
    ? `${plural(personas, "responsable", "responsables")} · ${plural(asignaciones, "asignación", "asignaciones")}`
    : plural(personas, "responsable", "responsables");
  return { personas, asignaciones, etiqueta };
}
