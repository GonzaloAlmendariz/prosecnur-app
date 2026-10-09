/**
 * Dónde se concentra lo que falta, sobre **el estrato de verdad**.
 *
 * Gonzalo, el 2026-09-09 y por segunda vez: «deja de asumir que mayoría hombres
 * o mayoría mujeres son estratos reales, no lo son. Los estratos son hombre y
 * mujer de cada facultad, punto». La primera fue el 2026-08-29 —«cómo vas a
 * poner mayoría hombres o mayoría mujeres cuando eso no me interesa; lo que me
 * interesa es cuántos hombres y cuántas mujeres»— y quedó escrita en el docblock
 * de `AulasBrechaEstratoChart`. La primera versión de este view-model se
 * construyó igual sobre `avance_por_estrato`, que es la clave del SORTEO
 * (`facultad / sexo dominante del aula / tramo de tamaño`): el sexo de ahí es el
 * del aula, no el del alumno.
 *
 * **Y el eje equivocado traía su propio descuadre.** Sobre la clave del sorteo
 * lo que falta suma 3 076 mientras la banda de KPIs dice «faltan 2 288», porque
 * sus brechas no se compensan entre tramos de tamaño. Sobre las 30 celdas
 * reales, medido sobre HSVG26ULT2 el 2026-09-09: cuota 2 500, logrado 212,
 * falta 2 288. **Cuadra exacto con la banda**, así que el aviso de denominador
 * que llevaba la versión anterior sobraba: era un artefacto del eje, no un
 * hecho del dato.
 */

export type CeldaDeCuota = {
  /** «DERECHO · Mujeres», ya legible. */
  etiqueta: string;
  falta: number;
  logrado: number;
  cuota: number;
};

export type BrechaConcentrada = {
  cabeza: ReadonlyArray<CeldaDeCuota>;
  restantes: number;
  faltaRestante: number;
  faltaTotal: number;
  /** Qué porcentaje de lo que falta está en `cabeza`. Entero. */
  concentracionPct: number;
  celdas: number;
  /** Celdas que todavía no tienen ninguna respuesta. */
  sinEmpezar: number;
};

function numero(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

/** `M`/`F` del motor a la palabra que usa el resto del perfil. */
export function sexoDeLaCelda(sex: unknown): string {
  const s = String(sex ?? "").trim().toUpperCase();
  if (s === "F" || s === "MUJER" || s === "MUJERES") return "Mujeres";
  if (s === "M" || s === "HOMBRE" || s === "HOMBRES") return "Hombres";
  return "Sin sexo declarado";
}

export function brechaConcentrada(
  filas: ReadonlyArray<Record<string, unknown>>,
  cuantos = 12,
): BrechaConcentrada {
  const todas: CeldaDeCuota[] = filas.map((f) => {
    const cuota = numero(f.cuota);
    const logrado = numero(f.logrado);
    const facultad = String(f.faculty ?? f.facultad ?? "").trim() || "Sin facultad declarada";
    return {
      etiqueta: `${facultad} · ${sexoDeLaCelda(f.sex ?? f.sexo)}`,
      // Lo que falta HOY, no la brecha después de proyectar: el panel dice
      // dónde hay que ir, y una celda que «va a llegar» con reservas que aún no
      // han salido a campo sigue necesitando esas encuestas.
      falta: Math.max(0, cuota - logrado),
      logrado,
      cuota,
    };
  });

  const faltaTotal = todas.reduce((n, c) => n + c.falta, 0);
  // Sólo entran las que TIENEN algo que falta: una celda ya cumplida en una
  // lista titulada «dónde falta más» es ruido con barra de cero.
  const abiertas = todas.filter((c) => c.falta > 0).sort((a, b) => b.falta - a.falta);
  const cabeza = abiertas.slice(0, Math.max(1, cuantos));
  const faltaEnCabeza = cabeza.reduce((n, c) => n + c.falta, 0);

  return {
    cabeza,
    restantes: abiertas.length - cabeza.length,
    faltaRestante: faltaTotal - faltaEnCabeza,
    faltaTotal,
    concentracionPct: faltaTotal > 0 ? Math.round((100 * faltaEnCabeza) / faltaTotal) : 0,
    celdas: todas.length,
    sinEmpezar: todas.filter((c) => c.logrado <= 0).length,
  };
}
