/**
 * Fusiona las filas de una misma persona que llegan partidas por actor.
 *
 * Los bloques telefónicos del engine vienen por (Actor, Responsable), así que
 * quien cubre dos componentes ocupa dos filas. Las tarjetas de producción las
 * mostraban como si fueran ocho encuestadores con cargas muy desiguales —40 y
 * 6— cuando el equipo son cuatro personas con 46, 45, 46 y 46 casos, que es
 * como lo resume la tabla dinámica del propio estudio.
 *
 * Se aplica DESPUÉS del merge por (responsable · actor), no en su lugar: aquel
 * junta columnas complementarias de cuatro bloques distintos sobre la misma
 * entidad y por eso sobrescribe; acá las entidades son distintas y hay que
 * sumar. Colapsar los dos pasos en uno sumaría lo que el primero solo copia.
 */

/** Conteos que se suman entre las filas de una misma persona. */
const CONTEOS = [
  "Casos asignados",
  "Barridos",
  "No barridos",
  "Efectivas",
  "Sin efectiva",
] as const;

/**
 * Derivadas que se descartan: un ratio no se suma.
 *
 * Sumar «40% incidencias» con «0% incidencias» daría 40%, y promediarlos daría
 * 20% — las dos cifras falsas, porque el ratio de la persona sale de sus
 * totales, no de sus tramos. Se borran y quien consume las recalcula desde los
 * conteos ya sumados.
 */
const DERIVADAS = ["Ratio incidencias", "% sin efectiva", "Ratio sin efectiva"] as const;

function comoNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function fusionarResponsablesPorPersona(
  filas: Array<Record<string, unknown>>,
  claveDe: (fila: Record<string, unknown>) => string,
  actorDe: (fila: Record<string, unknown>) => string,
): Array<Record<string, unknown>> {
  const porPersona = new Map<string, { fila: Record<string, unknown>; actores: Set<string> }>();

  filas.forEach((fila) => {
    const clave = claveDe(fila);
    if (!clave) return;
    const existente = porPersona.get(clave);
    if (!existente) {
      const copia = { ...fila };
      const actor = actorDe(fila);
      const actores = new Set<string>();
      if (actor) actores.add(actor);
      porPersona.set(clave, { fila: copia, actores });
      return;
    }
    CONTEOS.forEach((columna) => {
      const previo = comoNumero(existente.fila[columna]);
      const nuevo = comoNumero(fila[columna]);
      if (previo == null && nuevo == null) return;
      existente.fila[columna] = (previo ?? 0) + (nuevo ?? 0);
    });
    const actor = actorDe(fila);
    if (actor) existente.actores.add(actor);
  });

  return Array.from(porPersona.values()).map(({ fila, actores }) => {
    // Solo se conserva la etiqueta de actor cuando esa persona tiene una sola:
    // elegir la primera de varias afirmaría algo falso sobre su carga.
    if (actores.size === 1) fila.Actor = [...actores][0];
    else delete fila.Actor;
    if (actores.size > 1) DERIVADAS.forEach((columna) => delete fila[columna]);
    return fila;
  });
}
