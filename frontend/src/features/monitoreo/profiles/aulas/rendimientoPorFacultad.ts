import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Qué está rindiendo cada facultad, en encuestas conseguidas.
 *
 * Sustituye al eje de «aula válida / no válida», que Gonzalo retiró como
 * criterio el 2026-08-18: «que una intervención sea válida o no válida es un
 * valor que en el Excel se agregó, pero técnicamente no es algo que nosotros
 * verifiquemos… no importa si cumple el 70 % de asistencia, porque si es un aula
 * con cien elegibles, no importa que sea el 50 o el 40 %, igual son bastantes
 * alumnos y hay que ir a aplicar».
 *
 * De ahí la regla que gobierna este módulo: **la unidad es la encuesta
 * conseguida, no el porcentaje contra un umbral**. Un aula grande a media
 * asistencia rinde más que una pequeña que «cumple», y ordenar por porcentaje
 * pondría primero a la que menos aporta.
 *
 * Las tres tasas contestan tres preguntas distintas y por eso no se resumen en
 * una sola:
 *
 * - **por aula** — cuánto deja cada visita. Es lo que decide a dónde mandar
 *   gente mañana.
 * - **de los asistentes** — cuántos de los que estaban en el aula aceptaron.
 *   Mide el trabajo del aplicador, no el tamaño del aula.
 * - **del potencial** — cuántos de los elegibles del curso se consiguieron. Mide
 *   cuánto queda por exprimir de esa facultad.
 */

export type RendimientoDeFacultad = {
  /** El valor de la clave por la que se agrupó: facultad, aplicador o franja. */
  facultad: string;
  /** Aulas de esa facultad con parte de campo llenado. */
  aulas: number;
  efectivas: number;
  asistentes: number;
  elegibles: number;
  /** Efectivas por aula visitada. `null` si no hay aulas. */
  porAula: number | null;
  /**
   * El mismo rendimiento, ENCOGIDO hacia la media del estudio según cuánta
   * evidencia tiene la facultad. `null` si no hay aulas.
   *
   * Por qué existe: en el estudio real las facultades van de **2 a 39 aulas**
   * —Ciencias Contables 2, Ciencias e Ingeniería 39—, así que la tasa cruda de
   * una facultad con dos aulas es el promedio de dos observaciones y se compara
   * de tú a tú con otra que tiene treinta y nueve. Una facultad con 2 aulas y 1
   * efectiva no «rinde 50 %».
   *
   * El encogimiento equivale a añadirle a cada facultad `PESO_DEL_PRIOR` aulas
   * imaginarias con el rendimiento medio del estudio: quien tiene muchas apenas
   * se mueve, quien tiene dos se acerca a la media hasta que su propia evidencia
   * mande. NUNCA sustituye al dato observado, que se sigue viendo al lado.
   */
  porAulaAjustado: number | null;
  /** Efectivas sobre los que estaban en el aula, 0-100. `null` si no hay asistentes. */
  deLosAsistentes: number | null;
  /** Efectivas sobre los elegibles del curso, 0-100. `null` si no se conocen. */
  delPotencial: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Las tres FRANJAS de aplicación, tal como las escribe el libro del operativo en
 * su hoja «planilla». No se inventan tramos: son las del equipo, y usar otras
 * haría que la app y su Excel hablaran de horarios distintos.
 *
 * Lo que caiga fuera de 7:00–22:00 se declara aparte en vez de forzarlo a una
 * franja: un aula aplicada a las 6 de la mañana es un dato raro que hay que ver,
 * no un caso de «mañana temprano».
 */
/**
 * Cuántas aulas «imaginarias» al rendimiento medio se le suman a cada facultad
 * para encoger su tasa. Cinco es una elección DECLARADA, no estimada: con este
 * número una facultad de 2 aulas queda a medio camino de la media y una de 39
 * se mueve un 11 %, que es el reparto que la corrección pretende. Estimarlo por
 * momentos daría un valor distinto cada corte y haría el ranking inestable de un
 * día para otro, que es peor que un prior fijo y dicho.
 */
export const PESO_DEL_PRIOR = 5;

export const FRANJAS_DE_APLICACION = [
  { clave: "manana", etiqueta: "7:00 – 9:00", hasta: 9 * 60 },
  { clave: "dia", etiqueta: "9:01 – 19:00", hasta: 19 * 60 },
  { clave: "noche", etiqueta: "19:01 – 22:00", hasta: 22 * 60 },
] as const;

/** «14:30» → 870. Devuelve `null` si no hay hora reconocible. */
function minutos(valor: unknown): number | null {
  const m = texto(valor).match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** La franja del libro a la que pertenece una hora de aplicación. */
export function franjaDeAplicacion(valor: unknown): string {
  const t = minutos(valor);
  if (t == null) return "Sin hora";
  if (t < 7 * 60) return "Fuera de franja";
  for (const f of FRANJAS_DE_APLICACION) if (t <= f.hasta) return f.etiqueta;
  return "Fuera de franja";
}

/**
 * @param partes filas del parte de campo YA con su facultad —las que devuelve
 *   `parteDeCampo`—, para no repetir aquí la unión por `operational_code` y
 *   arriesgar que dos superficies discrepen en de qué facultad es un aula.
 * @param plan el plan, sólo para los elegibles de cada aula.
 * @param clave por qué se agrupa. La misma función sirve para las tres unidades
 *   de esfuerzo —facultad, aplicador y franja— porque lo único que cambia es la
 *   clave: duplicarla habría dado tres sitios donde arreglar el mismo redondeo.
 */
export function rendimientoPorFacultad(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow> = [],
  clave: "faculty" | "applied_by" | "franja" = "faculty",
): RendimientoDeFacultad[] {
  const elegiblesPorCodigo = new Map<string, number>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    const n = numero(fila.eligible_n);
    if (codigo && n > 0 && !elegiblesPorCodigo.has(codigo)) elegiblesPorCodigo.set(codigo, n);
  }

  const acumulado = new Map<string, RendimientoDeFacultad>();
  for (const fila of partes) {
    const facultad = clave === "franja"
      // `applied_at` PRIMERO: el parte publicado no manda `applied_time`, manda
      // fecha y hora concatenadas en un solo campo («2026-08-11 10:00»).
      // Buscando sólo `applied_time` salían las 210 aulas en «Sin hora».
      ? franjaDeAplicacion(fila.applied_at ?? fila.applied_time)
      : texto(fila[clave]) || (clave === "applied_by" ? "Sin aplicador" : "Sin facultad");
    const efectivas = numero(fila.effective_surveys);
    const asistentes = numero(fila.observed_students);
    // Un parte sin efectivas NI asistentes no es un aula que rindió cero: es un
    // parte vacío. Contarlo hundiría la tasa de su facultad con un aula que
    // nadie visitó todavía.
    if (!efectivas && !asistentes) continue;
    let f = acumulado.get(facultad);
    if (!f) {
      f = {
        facultad, aulas: 0, efectivas: 0, asistentes: 0, elegibles: 0,
        porAula: null, porAulaAjustado: null, deLosAsistentes: null, delPotencial: null,
      };
      acumulado.set(facultad, f);
    }
    f.aulas += 1;
    f.efectivas += efectivas;
    f.asistentes += asistentes;
    f.elegibles += elegiblesPorCodigo.get(texto(fila.operational_code)) ?? 0;
  }

  // La media del estudio, que es hacia donde encoge. Sale del total y no del
  // promedio de las tasas: promediar tasas le daría el mismo peso a una facultad
  // de 2 aulas que a una de 39, que es justo el sesgo que esto corrige.
  const totalEfectivas = [...acumulado.values()].reduce((n, f) => n + f.efectivas, 0);
  const totalAulas = [...acumulado.values()].reduce((n, f) => n + f.aulas, 0);
  const media = totalAulas ? totalEfectivas / totalAulas : 0;

  const salida = [...acumulado.values()].map((f) => ({
    ...f,
    porAula: f.aulas ? Math.round((10 * f.efectivas) / f.aulas) / 10 : null,
    porAulaAjustado: f.aulas
      ? Math.round((10 * (f.efectivas + PESO_DEL_PRIOR * media)) / (f.aulas + PESO_DEL_PRIOR)) / 10
      : null,
    deLosAsistentes: f.asistentes ? Math.round((1000 * f.efectivas) / f.asistentes) / 10 : null,
    delPotencial: f.elegibles ? Math.round((1000 * f.efectivas) / f.elegibles) / 10 : null,
  }));

  // Por lo que MÁS deja cada visita, que es la pregunta «qué nos está rindiendo
  // más». NO por porcentaje: ordenar por «% de los asistentes» pondría primero
  // a un aula diminuta donde respondieron los cuatro que había.
  return salida.sort((x, y) => (y.porAula ?? -1) - (x.porAula ?? -1)
    || y.efectivas - x.efectivas
    || x.facultad.localeCompare(y.facultad, "es"));
}
