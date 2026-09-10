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
 * Un número, o `null` cuando NO HAY dato. La diferencia importa aquí.
 *
 * `numero()` devuelve 0 tanto para un cero medido como para una celda vacía, y
 * en un ranking de rendimiento esas dos cosas son opuestas: una dice que el aula
 * rindió cero, la otra que nadie apuntó cuánto rindió.
 */
function numeroONulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
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

/** Los días, en orden de semana y no de rendimiento, para etiquetar. */
const DIAS_DE_LA_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * El día de la semana en que se aplicó un aula.
 *
 * **Por qué es una unidad de esfuerzo y no una curiosidad.** El pronóstico de
 * cierre proyecta «al ritmo observado de N aulas por día de campo», o sea que
 * trata todos los días como iguales. Si un martes rinde el doble que un viernes,
 * dos agendas con el mismo número de aulas dan resultados distintos y el
 * pronóstico se equivoca en la dirección que marque la composición de la agenda.
 * Hay panel para la hora del día —«Franja horaria»— y no lo había para el día
 * de la semana, que es la dimensión sobre la que el equipo SÍ puede decidir al
 * agendar.
 *
 * En UTC, como el resto del perfil: con hora local, una aplicación de las 00:30
 * cae en el día anterior en cualquier zona al oeste de Greenwich.
 */
export function diaDeSemanaDeAplicacion(valor: unknown): string {
  const m = texto(valor).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "Sin fecha";
  const d = new Date(`${m[0]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return DIAS_DE_LA_SEMANA[d.getUTCDay()] ?? "Sin fecha";
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
/**
 * Cuántos partes se quedan fuera del ranking por no traer su cifra de efectivas.
 *
 * El ranking los descarta —un `effective_surveys` ausente no es un cero, y
 * publicarlo como tal ponía «0 efectivas · 0.0 %» con el nombre de una persona
 * al lado— pero descartarlos EN SILENCIO cambia el denominador sin avisar: sobre
 * HSVG26ULT2 el 2026-09-08 son 2 de 17, así que la cabecera diría «15
 * cursos-horario visitados» donde el resto del perfil cuenta 17 partes.
 *
 * Mismo criterio que el descarte, en la misma unidad de compilación, para que no
 * puedan divergir.
 */
export function partesSinCifraDeEfectivas(partes: ReadonlyArray<MonitoreoRow>): number {
  return partes.filter((fila) => {
    const f = fila as Record<string, unknown>;
    if (numeroONulo(f.effective_surveys) !== null) return false;
    // El parte ENTERO vacío no cuenta: ése nunca estuvo en el ranking, y decir
    // que «falta su cifra» sugeriría que alguien fue y no la apuntó.
    return numero(f.observed_students) > 0;
  }).length;
}

export function rendimientoPorFacultad(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow> = [],
  clave: "faculty" | "applied_by" | "franja" | "dia_semana" = "faculty",
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
      : clave === "dia_semana"
        ? diaDeSemanaDeAplicacion(fila.applied_at ?? fila.applied_date)
        : texto(fila[clave]) || (clave === "applied_by" ? "Sin aplicador" : "Sin facultad");
    const efectivasMedidas = numeroONulo(fila.effective_surveys);
    const efectivas = efectivasMedidas ?? 0;
    const asistentes = numero(fila.observed_students);
    // Un parte sin efectivas NI asistentes no es un aula que rindió cero: es un
    // parte vacío. Contarlo hundiría la tasa de su facultad con un aula que
    // nadie visitó todavía.
    if (!efectivas && !asistentes) continue;
    // **Y un parte CON asistentes pero SIN efectivas tampoco rindió cero.**
    //
    // El guard de arriba sólo caza el parte entero vacío. Medido el 2026-09-08:
    // CH 7 viene con `application_status: "APLICADA"`, 29 asistentes y la celda
    // de efectivas VACÍA —«NA»—, mientras la Base de control le cuenta 27
    // encuestas por sexo. El aula se aplicó; lo que falta es que alguien
    // escribiera la cifra.
    //
    // Pasaba el filtro por sus asistentes, `numero()` convertía el hueco en 0 y
    // el ranking publicaba «Aguilar Cuya, Renzo Mariano · 1 curso-horario · 0
    // efectivas · 0.0 %» — un cero inventado, con el nombre de una persona al
    // lado. La ausencia se declara, no se disfraza de dato, y menos de un dato
    // que juzga a alguien.
    if (efectivasMedidas === null) continue;
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

  // **Por el % DEL POTENCIAL, que es la única medida sin tamaño.**
  //
  // Ordenaba por lo que deja cada visita, y eso ordenaba por TAMAÑO DE AULA
  // disfrazado de rendimiento. Medido sobre el operativo el 2026-09-09, con 11
  // facultades: los dos órdenes no comparten NI UNA posición. Derecho encabeza
  // por visita —29,3 encuestas por curso-horario— y es la 4.ª por potencial;
  // Psicología recoge el 100 % de sus elegibles y aparecía 7.ª; Letras y
  // Ciencias Humanas recoge el 90 % y salía LA ÚLTIMA, porque sus aulas son
  // pequeñas. Quien leía la lista concluía lo contrario de lo que pasa.
  //
  // Gonzalo lo dijo antes de que se midiera: «¿cuál está rindiendo más? Es
  // relativo, porque hay facultades más grandes y otras más pequeñas, y ahorita
  // simplemente estás poniendo todas en un mismo saco».
  //
  // «Por visita» se queda como COLUMNA porque contesta otra pregunta —cuántas
  // encuestas trae un viaje, que es logística— pero ya no manda en el orden.
  // Sin elegibles no hay potencial que calcular: esas filas caen al final, con
  // el desempate por visita, en vez de encabezar por un `null`.
  return salida.sort((x, y) => (y.delPotencial ?? -1) - (x.delPotencial ?? -1)
    || (y.porAula ?? -1) - (x.porAula ?? -1)
    || y.efectivas - x.efectivas
    || x.facultad.localeCompare(y.facultad, "es"));
}
