import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { avanceEnRespuestas, type AvanceEnRespuestas } from "./avanceEnRespuestas";

/**
 * Cómo va cada facultad contra la meta del plan.
 *
 * Es la cuarta pregunta del histórico del cálculo de muestra —«¿y por
 * facultad?»— y la que decide a dónde va el equipo mañana. Avance contestaba el
 * total y el aula, y entre esos dos grados no había nada: para saber que a
 * Derecho le faltan cien respuestas había que sumar a mano 30 filas de la tabla.
 *
 * **El denominador es la meta del PLAN** (`expected_valid` de cada
 * curso-horario), no la cuota de sexo×facultad, que es otra cosa y vive en su
 * propia pestaña. Cada facultad se calcula con `avanceEnRespuestas()`, la misma
 * función que da el total, así que las partes y el total no pueden discrepar —y
 * el excedente tampoco se cuela como avance dentro de una facultad.
 */

export type FacultadEnAvance = AvanceEnRespuestas & {
  facultad: string;
  /** Cursos-horario del plan en esa facultad. */
  aulas: number;
  /**
   * De qué lado va corta la facultad, en personas.
   *
   * El total puede leerse cubierto con una celda de sexo corta —el agregado
   * esconde lo que muerde por celda— y la cuota es por facultad Y sexo.
   *
   * `null` significa **no se sabe**, no «va bien»: sólo el motor lo calcula, a
   * partir de las celdas de cuota, y la derivación que trabaja sobre las filas
   * del plan no tiene con qué.
   */
  mujeresFalta: number | null;
  hombresFalta: number | null;
  celdaCorta: boolean;
};

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

export function perfilPorFacultad(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const grupos = new Map<string, MonitoreoAulasPlanRow[]>();
  let sinFacultad = 0;
  for (const fila of filas) {
    const facultad = texto(fila.faculty) || texto(fila.stratum);
    // Un aula sin facultad no se reparte a ojo entre las demás: se cuenta
    // aparte y se dice, que es lo que deja arreglarlo en el plan.
    if (!facultad) { sinFacultad += 1; continue; }
    const actual = grupos.get(facultad);
    if (actual) actual.push(fila);
    else grupos.set(facultad, [fila]);
  }

  const facultades: FacultadEnAvance[] = [...grupos.entries()]
    .map(([facultad, propias]) => ({
      facultad,
      aulas: propias.length,
      ...avanceEnRespuestas(propias),
      // El corte por sexo sólo lo sabe el motor —sale de las celdas de cuota—,
      // así que esta derivación, que trabaja sobre las filas del plan, declara
      // que no lo tiene en vez de fingir un cero. `null` no es «va bien».
      mujeresFalta: null as number | null,
      hombresFalta: null as number | null,
      celdaCorta: false,
    }))
    // Primero donde más falta: es el orden con el que se decide a dónde mandar
    // al equipo. La tasa sola pondría arriba una facultad a la que le faltan
    // tres respuestas por delante de otra a la que le faltan doscientas.
    .sort((a, b) => b.falta - a.falta || a.facultad.localeCompare(b.facultad, "es"));

  return {
    facultades,
    sinFacultad,
    /** La meta más alta marca la escala de las barras. */
    tope: facultades.reduce((max, f) => Math.max(max, f.meta), 0),
    cumplidas: facultades.filter((f) => f.falta === 0 && f.meta > 0).length,
    /**
     * **Contra qué se está midiendo**, porque no es lo mismo en las dos ramas y
     * el panel lo publica en palabra.
     *
     * Ésta mide contra la meta del PLAN —`expected_valid` de cada
     * curso-horario, como dice la cabecera del módulo—; `perfilDesdeElMotor`
     * mide contra la cuota del diseño. Son dos denominadores distintos y el
     * panel decía «con su meta cumplida» en los dos casos, debajo de un
     * subtítulo que afirmaba «contra la cuota del estudio». En este perfil
     * «meta» y «cuota» son cosas distintas —la meta es por aula, la cuota por
     * facultad y sexo—, así que la misma frase era exacta en una rama e
     * incorrecta en la otra.
     */
    vara: "meta del plan" as const,
  };
}

/** Una fila de `avance_por_facultad` tal como la publica el motor. */
export type FilaDeFacultadDelMotor = {
  faculty?: unknown;
  aulas?: unknown;
  meta?: unknown;
  brecha?: unknown;
  respuestas_validas?: unknown;
  /** El corte por sexo del motor; `null` cuando la facultad no tiene la celda. */
  mujeres_deficit?: unknown;
  hombres_deficit?: unknown;
  mujeres_logrado?: unknown;
  hombres_logrado?: unknown;
  celda_corta?: unknown;
};

/**
 * El perfil por facultad a partir del bloque que YA agrega el motor.
 *
 * Antes se calculaba en la vista sobre `course_status`, y ese bloque viaja
 * recortado a 500 filas de 2 615 y ademas incluye las reservas dormidas de cada
 * cadena: el panel que contesta «¿cómo va Derecho?» medía un subconjunto
 * arbitrario. El motor lo agrega sobre el mismo conjunto que las demás cifras de
 * avance —un aula por slot, sin banco— así que las cuatro cuentan lo mismo.
 */
export function perfilDesdeElMotor(filas: ReadonlyArray<FilaDeFacultadDelMotor>) {
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const facultades = filas
    .map((f) => {
      const meta = num(f.meta);
      const validas = num(f.respuestas_validas);
      const falta = Math.max(0, num(f.brecha));
      const cubierto = Math.max(0, meta - falta);
      return {
        facultad: String(f.faculty ?? "").trim() || "Sin facultad",
        aulas: num(f.aulas),
        meta,
        validas,
        cubierto,
        excedente: Math.max(0, validas - cubierto),
        falta,
        aulasConBrecha: falta > 0 ? 1 : 0,
        // **Un decimal, igual que `avanceEnRespuestas()`.** Las dos funciones
        // calculan el MISMO avance y el panel usa una u otra según llegue el
        // resumen del motor, así que con dos redondeos la misma pantalla
        // enseñaba «20%» o «19,6 %» según la fuente. Medido el 2026-08-29:
        // «Dónde falta más» decía 20 % para Ciencias e Ingeniería y la tabla
        // del cliente, 19.6 % del mismo cociente (130 de 662).
        avance: meta ? Math.round((1000 * cubierto) / meta) / 10 : 0,
        sinMeta: 0,
        // **El corte por sexo, que es lo que decide.** El total puede leerse
        // cubierto con una celda corta: es el patrón del agregado que esconde
        // lo que muerde por celda. `null` cuando la facultad no tiene esa celda
        // —no es que vaya bien, es que no existe—.
        mujeresFalta: f.mujeres_deficit == null ? null : Math.max(0, num(f.mujeres_deficit)),
        hombresFalta: f.hombres_deficit == null ? null : Math.max(0, num(f.hombres_deficit)),
        celdaCorta: f.celda_corta === true,
      };
    })
    .filter((f) => f.meta > 0 || f.aulas > 0);

  return {
    facultades,
    // El motor no publica las aulas sin facultad por separado; el bloque ya las
    // agrupa bajo su propio nombre vacío, que arriba se rotula «Sin facultad».
    sinFacultad: 0,
    tope: facultades.reduce((max, f) => Math.max(max, f.meta), 0),
    cumplidas: facultades.filter((f) => !f.falta).length,
    // El bloque del motor se titula «Avance por facultad y sexo contra la cuota
    // del diseño» (`carga_aulas_libro_avance_facultad.R`) y sale de
    // `design_targets`. Comprobado además contra la pestaña de Cuotas: Ciencias
    // Sociales da 63.1 % y faltan 55 en las dos superficies.
    vara: "cuota del estudio" as const,
  };
}
