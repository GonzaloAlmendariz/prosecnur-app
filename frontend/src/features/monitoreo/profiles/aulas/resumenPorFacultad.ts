import type {
  MonitoreoAulasPorFacultad,
  MonitoreoAulasRespuestasCuenta,
} from "../../../../api/monitoreo";

/**
 * Las tres cosas que él pide de un vistazo, por facultad.
 *
 * Dictado (2026-09-09): «en resumen… quiero ver las respuestas efectivas de las
 * facultades, quiero ver las aulas, quiero ver cuántas se han aplicado; es el
 * primer alcance que yo tengo cuando entro a avance».
 *
 * Ninguna de las tres estaba: el bloque de respuestas daba el TOTAL y filtraba
 * de una facultad en una, y las aulas por facultad sólo vivían en Metas. Aquí
 * se cruzan los dos bloques que el motor YA emite —`respuestas_desglose` y
 * `aulas_por_facultad`— sin calcular ninguna cifra nueva: cualquier suma que se
 * hiciera aquí sería la segunda expresión de algo que ya existe.
 */
export type FilaDeResumen = {
  facultad: string;
  /** Respuestas que cuentan. */
  efectivas: number;
  /** Todas las que llegaron atribuidas a esa facultad. */
  observadas: number;
  /** Titulares del sorteo; `null` cuando el bloque de aulas no la trae. */
  planificadas: number | null;
  aplicadas: number | null;
};

/**
 * Cruza los dos bloques y ordena por EFECTIVAS, de mayor a menor.
 *
 * El orden es el del volumen de trabajo hecho, que es lo que un resumen tiene
 * que enseñar primero; buscar una facultad concreta es lo que hace el selector
 * de la cabecera, y por eso aquí no manda el alfabeto.
 *
 * Una facultad presente en un bloque y no en el otro NO se descarta: entra con
 * `null` en lo que falte. Descartarla escondería una facultad entera por un
 * hueco de datos, que es peor que enseñar un guion.
 */
export function resumenPorFacultad(
  respuestas: ReadonlyArray<MonitoreoAulasRespuestasCuenta & { facultad: string }> | null | undefined,
  aulas: ReadonlyArray<MonitoreoAulasPorFacultad> | null | undefined,
): FilaDeResumen[] {
  const porNombre = new Map<string, FilaDeResumen>();
  const clave = (n: string) => n.trim().toUpperCase();

  for (const r of respuestas ?? []) {
    const nombre = (r?.facultad ?? "").trim();
    if (!nombre) continue;
    porNombre.set(clave(nombre), {
      facultad: nombre,
      efectivas: Number(r.efectivas) || 0,
      observadas: Number(r.observadas) || 0,
      planificadas: null,
      aplicadas: null,
    });
  }
  for (const a of aulas ?? []) {
    const nombre = (a?.facultad ?? "").trim();
    if (!nombre) continue;
    const fila = porNombre.get(clave(nombre)) ?? {
      facultad: nombre, efectivas: 0, observadas: 0, planificadas: null, aplicadas: null,
    };
    fila.planificadas = Number(a.planificadas) || 0;
    fila.aplicadas = Number(a.aplicadas) || 0;
    porNombre.set(clave(nombre), fila);
  }

  return [...porNombre.values()].sort((x, y) => y.efectivas - x.efectivas
    || (y.aplicadas ?? 0) - (x.aplicadas ?? 0)
    || x.facultad.localeCompare(y.facultad, "es"));
}
