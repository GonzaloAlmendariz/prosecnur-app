import type {
  MonitoreoAulasProyeccionFila,
  MonitoreoAulasProyeccionMetas,
} from "../../../../api/monitoreo";

/** Los dos mandos de la pestaña: contra qué meta, y con qué tasa se proyecta. */
export type MandoMeta = "muestra" | "sobremuestra";
export type MandoTasa = "diseno" | "obtenida";

/**
 * La combinación elegida, sacada del payload — **nunca derivada en la pantalla**.
 *
 * El motor emite las cuatro ya calculadas (`monitoreo_aulas_proyeccion_payload()`)
 * y esto sólo elige una. Es a propósito: en cuanto la UI calculara una a partir
 * de otra habría dos sitios produciendo la misma cifra, que es exactamente cómo
 * empezaron los tres fallos del 2026-09-09.
 *
 * Devuelve `null` —no `[]`— cuando el estudio no declara cuotas o la
 * combinación no vino: **«no se sabe» no es «no llega»**, y la pantalla tiene
 * que poder decir cuál de las dos es (C3).
 */
export function proyeccionElegida(
  payload: MonitoreoAulasProyeccionMetas | null | undefined,
  meta: MandoMeta,
  tasa: MandoTasa,
): MonitoreoAulasProyeccionFila[] | null {
  if (!payload || typeof payload !== "object") return null;
  const clave = `${meta}_${tasa}` as keyof MonitoreoAulasProyeccionMetas;
  const filas = payload[clave];
  if (!Array.isArray(filas)) return null;
  const limpias = filas.filter(
    (f): f is MonitoreoAulasProyeccionFila =>
      Boolean(f) && typeof f === "object" && typeof f.facultad === "string" && f.facultad.trim() !== "",
  );
  return limpias.length ? limpias : null;
}

/**
 * De qué se sostiene la tasa obtenida, para escribirlo junto al mando.
 *
 * No hay umbral que la vuelva fiable —se midió y ninguno lo hacía—, así que en
 * vez de un semáforo que mienta se enseña el material: sobre cuántas aulas y
 * cuántos elegibles descansa, y a qué distancia queda de la del diseño.
 */
export function respaldoDeLaTasa(filas: MonitoreoAulasProyeccionFila[] | null): {
  aulas: number;
  elegibles: number;
  facultadesSinTasaPropia: number;
} | null {
  if (!filas || !filas.length) return null;
  return {
    aulas: filas.reduce((n, f) => n + (Number(f.aulas_aplicadas) || 0), 0),
    elegibles: filas.reduce((n, f) => n + (Number(f.elegibles_aplicados) || 0), 0),
    // Una facultad que cae a la del diseño porque la suya no se puede calcular
    // es justo la que un promedio escondería.
    facultadesSinTasaPropia: filas.filter((f) => f.tasa_es_del_diseno).length,
  };
}

/**
 * El supuesto que se escribe al pie. Sale del DATO, no de la pantalla: el motor
 * lo emite con cada fila para que no existan dos redacciones del mismo aviso.
 * Vacío = no hay nada que advertir; nunca se inventa una frase aquí.
 */
export function supuestosAlPie(filas: MonitoreoAulasProyeccionFila[] | null): string[] {
  if (!filas || !filas.length) return [];
  const vistos: string[] = [];
  for (const f of filas) {
    for (const s of [f.supuesto_meta, f.supuesto_sexo]) {
      const t = (s ?? "").trim();
      if (t && !vistos.includes(t)) vistos.push(t);
    }
  }
  return vistos;
}
