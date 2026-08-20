/**
 * ¿Alcanza el banco de aulas extra para cerrar la cuota que falta?
 *
 * La pestaña del banco dice cuántas aulas hay y cuántos alumnos tienen —«73
 * extras · 2 436 alumnos»—, que es un inventario, no una respuesta. La pregunta
 * que decide el operativo es otra, y es la que Gonzalo repite: «no es que los
 * reemplazos sean una cosa infinita… la idea operativa es que no nos pasemos de
 * determinadas aulas».
 *
 * Medido sobre el corte real: el banco entero rinde **1 430 encuestas** contra
 * **1 558** de cuota pendiente, y **ni el extremo alto de la banda (1 532)
 * llega**. Un inventario de 2 436 alumnos que se lee como reserva de sobra y no
 * cierra la cuota.
 *
 * Dos decisiones que hacen honesta la cuenta:
 *
 * 1. **Ningún alumno del banco es una encuesta.** Se proyecta con la tasa de
 *    respuesta OBSERVADA sobre la población elegible —58,7 % en 102 aulas—, y
 *    con su banda: la tasa varía mucho entre aulas (sd 18 pp), así que una cifra
 *    puntual prometería una precisión que no existe.
 * 2. **La cuota no se compensa entre facultades**, igual que en el KPI de cuota
 *    pendiente: pasarse en Derecho no cubre lo que falta en Letras. El déficit
 *    se suma por facultad, no se resta de totales. Restar totales da siempre el
 *    número más favorable.
 */

/** Una fila de «Base de control», de donde sale la tasa observada. */
type FilaDeControl = Readonly<Record<string, unknown>>;

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(String(v ?? "").replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type TasaObservada = {
  /** Encuestas por alumno elegible, en 0–1. Ponderada, no promedio de tasas. */
  tasa: number;
  /** Aulas con las que se midió. */
  aulas: number;
  enviadas: number;
  elegibles: number;
  /** Dispersión entre aulas, en puntos porcentuales. */
  sd: number;
};

/**
 * La tasa de respuesta con la que se proyecta un aula que todavía no se aplicó.
 *
 * Ponderada —`suma(enviadas) / suma(elegibles)`— y no promedio de tasas: el
 * promedio simple le da el mismo peso a un aula de 8 elegibles que a una de 40.
 * En este corte las dos coinciden (58,6 contra 58,7), lo que dice que no hay
 * sesgo por tamaño; en otro estudio pueden separarse, y la que sirve para
 * proyectar alumnos es la ponderada.
 */
export function tasaDeRespuestaObservada(filas: ReadonlyArray<FilaDeControl>): TasaObservada | null {
  let enviadas = 0;
  let elegibles = 0;
  const tasas: number[] = [];
  for (const f of filas) {
    const env = num(f.sent_total);
    const elig = num(f.eligible_n);
    if (env === null || elig === null || env <= 0 || elig <= 0) continue;
    enviadas += env;
    elegibles += elig;
    tasas.push(env / elig);
  }
  if (!tasas.length || !elegibles) return null;
  const media = tasas.reduce((s, t) => s + t, 0) / tasas.length;
  const sd = tasas.length > 1
    ? Math.sqrt(tasas.reduce((s, t) => s + (t - media) ** 2, 0) / (tasas.length - 1))
    : 0;
  return { tasa: enviadas / elegibles, aulas: tasas.length, enviadas, elegibles, sd };
}

export type FacultadDelAlcance = {
  facultad: string;
  /** Alumnos elegibles que quedan en el banco de esa facultad. */
  elegibles: number;
  /** Encuestas que se esperan de ellos con la tasa observada. */
  rinde: number;
  /** Cuota pendiente de esa facultad. */
  falta: number;
  /** Lo que seguiría faltando tras vaciar su banco. */
  deficit: number;
};

export type AlcanceDelBanco = {
  tasa: TasaObservada;
  /** Encuestas esperadas del banco entero. */
  rinde: number;
  /** Banda de dos errores estándar, en encuestas. */
  bajo: number;
  alto: number;
  /** Cuota pendiente sumada. */
  falta: number;
  /** Lo que falta tras vaciar el banco, sumado POR FACULTAD. */
  deficit: number;
  /** El mismo déficit calculado restando totales: siempre igual o menor. */
  deficitSiSeCompensara: number;
  facultades: FacultadDelAlcance[];
  /** `alcanza` sólo si el extremo bajo de la banda ya cubre lo que falta. */
  veredicto: "alcanza" | "no alcanza" | "justo";
};

/**
 * @param control filas de «Base de control», para la tasa.
 * @param banco elegibles del banco por facultad.
 * @param falta cuota pendiente por facultad.
 * @param aulasDelBanco cuántas aulas nuevas se abrirían; fija el ruido de la banda.
 */
export function alcanceDelBanco(
  control: ReadonlyArray<FilaDeControl>,
  banco: ReadonlyArray<{ faculty: string; elegibles: number }>,
  falta: ReadonlyMap<string, number>,
  aulasDelBanco: number,
): AlcanceDelBanco | null {
  const tasa = tasaDeRespuestaObservada(control);
  if (!tasa) return null;

  // El ruido de proyectar N aulas nuevas sale de la dispersión ENTRE aulas
  // dividida por las aulas que se van a abrir, no por las 102 con que se midió
  // la tasa: abrir tres aulas es mucho más incierto que abrir setenta, y una
  // banda calculada sobre la muestra vieja diría lo contrario.
  const n = Math.max(1, aulasDelBanco);
  const ee = tasa.sd / Math.sqrt(n);
  const elegiblesTotales = banco.reduce((s, b) => s + Math.max(0, b.elegibles || 0), 0);
  const proyectar = (t: number) => Math.round(elegiblesTotales * Math.max(0, t));

  // El déficit sumado por facultad, a una tasa dada. Se evalúa tres veces —con
  // la tasa central y con los dos extremos de la banda— porque el veredicto se
  // decide POR FACULTAD y no por totales, y una banda sobre el total no dice
  // nada del reparto.
  const deficitPorFacultad = (t: number) => {
    let suma = 0;
    for (const b of banco) {
      const f = String(b.faculty ?? "").trim();
      if (!f) continue;
      suma += Math.max(0, Math.max(0, falta.get(f) ?? 0) - Math.round(Math.max(0, b.elegibles || 0) * Math.max(0, t)));
    }
    for (const [f, falt] of falta) {
      if (banco.some((b) => String(b.faculty ?? "").trim() === f)) continue;
      suma += Math.max(0, falt);
    }
    return suma;
  };

  const facultades: FacultadDelAlcance[] = [];
  const vistas = new Set<string>();
  for (const b of banco) {
    const elegibles = Math.max(0, b.elegibles || 0);
    const f = String(b.faculty ?? "").trim();
    if (!f) continue;
    vistas.add(f);
    const rinde = Math.round(elegibles * tasa.tasa);
    const falt = Math.max(0, falta.get(f) ?? 0);
    facultades.push({ facultad: f, elegibles, rinde, falta: falt, deficit: Math.max(0, falt - rinde) });
  }
  // Una facultad con cuota pendiente y SIN banco es el peor caso y no puede
  // quedarse fuera del recuento por no tener fila en el banco.
  for (const [f, falt] of falta) {
    if (vistas.has(f) || falt <= 0) continue;
    facultades.push({ facultad: f, elegibles: 0, rinde: 0, falta: falt, deficit: falt });
  }
  facultades.sort((a, b) => b.deficit - a.deficit || a.facultad.localeCompare(b.facultad, "es"));

  const faltaTotal = [...falta.values()].reduce((s, v) => s + Math.max(0, v), 0);
  const rinde = proyectar(tasa.tasa);
  const bajo = proyectar(tasa.tasa - 2 * ee);
  const alto = proyectar(tasa.tasa + 2 * ee);
  return {
    tasa,
    rinde,
    bajo,
    alto,
    falta: faltaTotal,
    deficit: facultades.reduce((s, f) => s + f.deficit, 0),
    deficitSiSeCompensara: Math.max(0, faltaTotal - rinde),
    facultades,
    // **El veredicto se decide POR FACULTAD, no por totales.**
    //
    // Con totales decía «el banco alcanza» sobre un corte donde 14 facultades
    // se quedaban cortas y faltaban 363 encuestas: el titular usaba justo la
    // cuenta optimista que el pie de este mismo panel desautoriza. Que sobre en
    // Derecho no cierra la cuota de Letras.
    //
    // Y en el extremo desfavorable: `alcanza` sólo si ni con la tasa baja queda
    // déficit; `no alcanza` si ni con la alta desaparece.
    veredicto: deficitPorFacultad(tasa.tasa - 2 * ee) === 0
      ? "alcanza"
      : deficitPorFacultad(tasa.tasa + 2 * ee) === 0 ? "justo" : "no alcanza",
  };
}

/**
 * Lo que faltará por facultad cuando se acabe la agenda comprometida.
 *
 * **No es lo que falta hoy, y la diferencia decide el veredicto.** El banco se
 * abre después de agotar las aulas ya comprometidas, así que pedirle que cubra
 * lo que ésas van a traer es contarlo dos veces. Medido en el corte real:
 * faltan 1 558 hoy y 1 192 al acabarse la agenda —366 encuestas que ya vienen—.
 *
 * Vive aquí y no en el componente para poder probarse sin montar la vista ni
 * sembrar la maquinaria entera de la proyección.
 */
export function faltaTrasLaAgenda(
  proyeccion: ReadonlyArray<{ facultad: string; cuotas: ReadonlyArray<{ faltanAlCerrarAgenda: number }> }>,
): Map<string, number> {
  const falta = new Map<string, number>();
  for (const f of proyeccion) {
    const nombre = String(f.facultad ?? "").trim();
    if (!nombre) continue;
    // Celda a celda, como en todo el módulo: pasarse en una no cubre otra.
    const pendiente = f.cuotas.reduce((s, c) => s + Math.max(0, c.faltanAlCerrarAgenda ?? 0), 0);
    if (!pendiente) continue;
    falta.set(nombre, (falta.get(nombre) ?? 0) + pendiente);
  }
  return falta;
}

