/**
 * Los cursos-horario que faltan por aplicar, agrupados por facultad.
 *
 * El panel «Cada curso-horario contra su propio margen» los listaba uno a uno:
 * 161 renglones de «CH 1 · planificada · CIENCIAS E INGENIERIA · prevista
 * 51.9 % de 28 elegibles» en cuatro columnas de texto micro. Gonzalo, el
 * 2026-09-09: «toda la parte de abajo de aquí también». Una lista de 161 códigos
 * no se lee: lo que se quiere saber de un pendiente es DÓNDE está y CUÁNTO
 * promete, y eso son doce líneas.
 *
 * **La prevista del grupo se PONDERA por elegibles, no se promedia.** Un
 * curso-horario de 60 alumnos al 40 % y otro de 10 al 80 % no dan un grupo al
 * 60 %: dan 32 de 70, o sea 46 %. Promediar tasas de tamaños distintos es el
 * error que ya obligó a corregir la tasa por facultad, y aquí volvería a
 * contradecir al rótulo.
 *
 * Alcanzar cada curso-horario suelto sigue siendo posible —la tabla «Avance por
 * curso-horario» de Resumen los trae con su selector de rol—, así que resumir
 * aquí no esconde nada: cambia una lista ilegible por la cuenta que se busca.
 */

export type PendienteDeFacultad = {
  facultad: string;
  cursosHorario: number;
  elegibles: number;
  /** Ponderada por elegibles, en tanto por uno. `null` si nadie la declara. */
  tasaPrevista: number | null;
  /**
   * **El estado operativo literal, y no es decorativo.** «agendada» es un
   * curso-horario con fecha puesta y «planificada» uno que nadie ha agendado
   * todavía: son dos remedios distintos —uno se espera, el otro se agenda— y
   * agrupar sin ellos convierte 161 pendientes en un montón indistinto. Lo
   * exigía ya el contrato de `senalesPorAula.test.tsx`, que pedía «el estado
   * literal de cada uno, visible en su grupo».
   */
  estados: ReadonlyArray<{ estado: string; n: number }>;
};

type AulaPendiente = {
  facultad?: string | null;
  elegibles?: number | null;
  tasaPrevista?: number | null;
  estadoOperativo?: string | null;
};

export function pendientesPorFacultad(
  aulas: ReadonlyArray<AulaPendiente>,
): PendienteDeFacultad[] {
  const acumulado = new Map<string, {
    facultad: string; cursosHorario: number; elegibles: number;
    // Numerador y denominador de la ponderación, por separado: sólo entran en
    // la tasa los cursos-horario que declaran LAS DOS cosas.
    esperadas: number; elegiblesConTasa: number; estados: Map<string, number>;
  }>();

  for (const a of aulas) {
    const facultad = String(a.facultad ?? "").trim() || "Sin facultad declarada";
    let f = acumulado.get(facultad);
    if (!f) {
      f = { facultad, cursosHorario: 0, elegibles: 0, esperadas: 0, elegiblesConTasa: 0, estados: new Map() };
      acumulado.set(facultad, f);
    }
    f.cursosHorario += 1;
    const estado = String(a.estadoOperativo ?? "").trim() || "aún sin gestión";
    f.estados.set(estado, (f.estados.get(estado) ?? 0) + 1);
    const elegibles = Number(a.elegibles);
    if (Number.isFinite(elegibles) && elegibles > 0) {
      f.elegibles += elegibles;
      // `a.tasaPrevista != null` ANTES de `Number()`: `Number(null)` es 0 y
      // `isFinite(0)` es true, así que sin esta comprobación un curso-horario
      // que no declara tasa votaba con un cero y hundía la del grupo. Lo cazó
      // el test, no la revisión.
      const tasa = a.tasaPrevista != null ? Number(a.tasaPrevista) : Number.NaN;
      if (Number.isFinite(tasa)) {
        f.esperadas += tasa * elegibles;
        f.elegiblesConTasa += elegibles;
      }
    }
  }

  return [...acumulado.values()]
    .map((f) => ({
      facultad: f.facultad,
      cursosHorario: f.cursosHorario,
      elegibles: f.elegibles,
      tasaPrevista: f.elegiblesConTasa > 0 ? f.esperadas / f.elegiblesConTasa : null,
      estados: [...f.estados.entries()]
        .map(([estado, n]) => ({ estado, n }))
        .sort((x, y) => y.n - x.n || x.estado.localeCompare(y.estado, "es")),
    }))
    // De más pendientes a menos: la facultad con más por aplicar es la que hay
    // que agendar primero, y es lo que se busca al abrir esta lista.
    .sort((a, b) => b.cursosHorario - a.cursosHorario || b.elegibles - a.elegibles);
}
