/**
 * Dónde se concentra la brecha del sorteo, para que Estratos deje de ser una
 * tabla de 73 filas y conteste de un vistazo la pregunta que le toca.
 *
 * **El denominador es el problema de este panel y por eso el view-model lo
 * publica.** La brecha por estrato se mide contra la META POR CURSO-HORARIO —la
 * suma de lo que cada curso-horario debe traer— y no contra la cuota del
 * estudio. Medido sobre HSVG26ULT2 el 2026-09-09: los 73 estratos suman 3 076 de
 * brecha mientras la banda de KPIs, dos paneles más arriba, dice «faltan 2 288».
 * Las válidas coinciden (212 en los dos) y los cursos-horario también (174), así
 * que no es un error de cuenta: un estrato es `facultad × sexo × tamaño` y sus
 * brechas NO se compensan entre tramos de tamaño, mientras la cuota se mide
 * sobre `facultad × sexo`. Publicar «faltan 3 076» sin decirlo es la misma
 * contradicción que ya obligó a renombrar los dos «Cumplimiento» de Avance.
 *
 * `AulasBrechaEstratoChart` —que sigue sin montar— ya avisaba de esto en su
 * docblock y por eso no se monta: además dibuja «mayoría hombres / mayoría
 * mujeres», que es justo el corte que Gonzalo descartó el 2026-08-29.
 */

export type EstratoConBrecha = {
  /** Ya traducido por `etiquetaDeEstrato()`: la clave del motor no es etiqueta. */
  etiqueta: string;
  brecha: number;
  validas: number;
  cursosHorario: number;
};

export type BrechaConcentrada = {
  /** Los que se dibujan, de más brecha a menos. */
  cabeza: ReadonlyArray<EstratoConBrecha>;
  /** Cuántos quedan fuera del dibujo y cuánta brecha se llevan. */
  restantes: number;
  brechaRestante: number;
  brechaTotal: number;
  /** Qué porcentaje de la brecha total está en `cabeza`. Entero. */
  concentracionPct: number;
  estratos: number;
  /** Estratos que todavía no tienen ninguna respuesta. */
  sinEmpezar: number;
};

function numero(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function brechaConcentrada(
  filas: ReadonlyArray<Record<string, unknown>>,
  cuantos = 12,
): BrechaConcentrada {
  const todos: EstratoConBrecha[] = filas.map((f) => ({
    etiqueta: String(f.stratum ?? f.estrato ?? "").trim() || "Sin estrato declarado",
    brecha: numero(f.brecha),
    validas: numero(f.respuestas_validas),
    cursosHorario: numero(f.aulas),
  }));

  const brechaTotal = todos.reduce((n, e) => n + e.brecha, 0);
  // Sólo entran los que TIENEN brecha: un estrato ya cerrado en una lista
  // titulada «dónde falta más» es ruido con barra de cero.
  const conBrecha = todos.filter((e) => e.brecha > 0).sort((a, b) => b.brecha - a.brecha);
  const cabeza = conBrecha.slice(0, Math.max(1, cuantos));
  const brechaEnCabeza = cabeza.reduce((n, e) => n + e.brecha, 0);

  return {
    cabeza,
    restantes: conBrecha.length - cabeza.length,
    brechaRestante: brechaTotal - brechaEnCabeza,
    brechaTotal,
    concentracionPct: brechaTotal > 0 ? Math.round((100 * brechaEnCabeza) / brechaTotal) : 0,
    estratos: todos.length,
    sinEmpezar: todos.filter((e) => e.validas <= 0).length,
  };
}
