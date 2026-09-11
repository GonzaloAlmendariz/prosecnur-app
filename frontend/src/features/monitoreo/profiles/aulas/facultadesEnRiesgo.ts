import type {
  MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento, MonitoreoAulasEfectividadFacultad,
} from "../../../../api/monitoreo";
import { cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { deficitOperativo, estaEnCamino } from "./deficitOperativo";
import { MINIMO_PARA_COMPARAR } from "./peorRendimientoDeFacultad";

/**
 * **Los dos riesgos que un ranking de rendimiento no puede ver.**
 *
 * Gonzalo, 2026-09-11: «también debemos advertir las que falta mucho y sus CH
 * aún no se pueden aplicar; me preocupa particularmente Gestión, que aún no
 * tiene ni una y no podemos dimensionar cómo nos irá. No sé si allí lo más
 * pertinente es contactarnos con un reemplazo y ver de poder agendar algo la
 * próxima semana, o me estoy paniqueando».
 *
 * Medido en HSVG26ULT2 el 2026-09-11, y el instinto apuntaba a un riesgo real
 * por una razón distinta de la supuesta:
 *
 * - **Gestión y Alta Dirección** sí tiene campo —un curso-horario aplicado, 17
 *   respuestas— pero **lo agendado no le alcanza**: sus 5 cursos-horario
 *   pendientes esperan traer 94 y su cuota es 105. Y el motor la marca
 *   `holgado` con proyección 160,9, porque proyecta con el ritmo del operativo
 *   y no con lo que esa facultad tiene agendado.
 * - **Ciencias Contables** y **Educación** son las que de verdad están a
 *   ciegas: cero aplicados, así que no tienen tasa observada propia y lo que se
 *   les prevé sale del perfil.
 *
 * **Un ranking de eficiencia no las ve, y el panel las apartaba en silencio**
 * por no llegar al mínimo para comparar. Éste es el aviso que faltaba: no mide
 * qué tan bien rinde una facultad, sino si va a poder medirse y si lo que tiene
 * por delante le alcanza.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * **Cuánto tiene que sobrar lo agendado para que no medir deje de ser un
 * riesgo.** No poder medirse sólo importa si hay algo en juego: con el corte
 * de las 11:14 del 2026-09-11 el panel avisaba de Educación —24 de 24
 * respuestas, cuota cerrada— y de Gastronomía —le faltaban 2 y tenía 21 en
 * camino—. Un aviso que incluye a las que no tienen nada que perder deja de
 * distinguirse del ruido.
 */
const MARGEN_QUE_TRANQUILIZA = 0.5;

export type AvisoDeFacultad = "agenda_corta" | "a_ciegas";

export type RiesgoDeFacultad = {
  facultad: string;
  clave: string;
  aplicados: number;
  meta: number;
  logrado: number;
  /** Lo que le falta para su cuota, sin descontar nada. */
  falta: number;
  /** Cursos-horario agendados y todavía sin aplicar. */
  cursosEnCamino: number;
  /** Lo que esos cursos-horario esperan traer. Es una proyección, no un hecho. */
  enCamino: number;
  /** Lo que faltaría aun saliendo bien todo lo agendado. */
  quedaria: number;
  /** Cuándo vuelve a medirse esa facultad. Vacío si no tiene nada agendado. */
  proximaFecha: string;
  reservasLibres: number;
  /**
   * Cursos-horario del plan sin fecha y sin rechazo: los que todavía se pueden
   * agendar sin gastar una reserva. **No son aforo seguro**: hasta que el
   * docente no acepta no se sabe si se podrá aplicar allí.
   */
  cursosSinAgendar: number;
  /**
   * Citas que pasaron sin aplicarse. No son aforo ni están «por agendar»: hay
   * que reagendarlas o darlas por caídas, y mientras tanto no rinden nada.
   */
  cursosVencidos: number;
  /**
   * **Qué corresponde hacer, que no es lo mismo en las dos.**
   *
   * Gonzalo, 2026-09-11, mirando Derecho en las dos pantallas: «por un lado a
   * Derecho no le va mal y por otro a Derecho le falta muchísimo […] sospecho
   * que en gran parte es porque nos falta agendar […] pero ninguno se
   * complementa ni me dice si aquello es necesario».
   *
   * - `agendar`: su propio plan da para cubrir el hueco; lo que falta es fecha.
   *   No se toca la reserva, que no se comparte entre facultades.
   * - `reforzar`: ni agendando todo su plan llega. Aquí sí toca contactar
   *   docentes de aulas de refuerzo.
   */
  loQueToca: "agendar" | "reforzar" | null;
  /**
   * `true` si las cifras salen del motor. `false` en la facultad sin campo,
   * donde el motor no proyecta y el respaldo estima con una tasa prestada.
   */
  medido: boolean;
  /**
   * Cuál de los dos riesgos manda. La agenda corta va primero: es accionable
   * hoy —se activa una reserva— y no depende de esperar a medir.
   */
  aviso: AvisoDeFacultad;
};

/**
 * **Las citas que pasaron sin aplicarse, en todo el estudio.**
 *
 * Van al pie del panel y no en una fila: no son de una facultad, son un estado
 * del operativo, y lo que piden —reagendar o dar por caída— no se parece a
 * nada de lo que piden las otras dos. Medido el 2026-09-11: sólo **2** de las
 * 70 con fecha pasada seguían sin aplicar; las otras 68 ya habían traído
 * respuestas con el estado operativo todavía en «planificada».
 */
export function citasVencidas(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
): { cursos: number; elegibles: number } | null {
  const cursos = Number(bloque?.total?.cursos_vencidos ?? 0) || 0;
  if (cursos <= 0) return null;
  return { cursos, elegibles: Number(bloque?.total?.elegibles_vencidos ?? 0) || 0 };
}

/**
 * Cuántos de cada 100 titulares contactados han rechazado en este operativo.
 * `null` sin base suficiente: con tres resueltos, una proporción es ruido.
 */
export function rechazoDelOperativo(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
): { resueltos: number; rechazos: number; porCiento: number } | null {
  const resueltos = Number(bloque?.total?.titulares_resueltos ?? 0) || 0;
  const rechazos = Number(bloque?.total?.titulares_rechazo ?? 0) || 0;
  if (resueltos < MINIMO_PARA_COMPARAR) return null;
  return { resueltos, rechazos, porCiento: (rechazos / resueltos) * 100 };
}

/**
 * **Cómo va a cerrar UNA facultad, leído del motor.**
 *
 * Vive aparte porque lo piden dos superficies: el panel de Resumen, que ordena
 * a las que no llegan, y la ficha de la facultad en Brechas, donde Gonzalo
 * (2026-09-11) señaló que las dos lecturas no se hablaban — «por un lado a
 * Derecho no le va mal y por otro a Derecho le falta muchísimo». Calcularlo dos
 * veces es exactamente cómo se llega a dos respuestas para la misma pregunta.
 */
export type CierreDeLaFacultad = {
  meta: number;
  logrado: number;
  /** Lo que falta para la cuota, sin descontar nada. */
  falta: number;
  cursosEnCamino: number;
  /** Lo que esos cursos-horario esperan traer. Proyección, no hecho. */
  enCamino: number;
  /** Lo que faltaría aun saliendo bien todo lo agendado. */
  quedaria: number;
  cursosSinAgendar: number;
  /** Citas pasadas sin aplicar: piden reagendar, no llamar por primera vez. */
  cursosVencidos: number;
  loQueToca: "agendar" | "reforzar" | null;
  /** `false` cuando el motor no proyecta (facultad sin campo) y la cifra se estima. */
  medido: boolean;
};

export function cierreDeLaFacultad(
  f: MonitoreoAulasEfectividadFacultad | null | undefined,
  respaldo?: { meta: number; logrado: number; quedaria: number; enCamino: number; cursos: number },
): CierreDeLaFacultad | null {
  if (!f) return null;
  // **`Number(null)` es 0, y 0 es finito.** Sin el `!= null`, una facultad sin
  // campo —el motor manda NA, que llega como `null`— se daba por medida con
  // margen cero: quedaba sin riesgo y con «esperan traer 0» sobre 59 elegibles
  // ya citados. Lo cazó su propio test.
  const medido = f.margen_agendado != null && Number.isFinite(Number(f.margen_agendado));
  const meta = Number(f.cuota) || respaldo?.meta || 0;
  const logrado = f.conseguido != null && Number.isFinite(Number(f.conseguido))
    ? Number(f.conseguido) : respaldo?.logrado ?? 0;
  const falta = Math.max(0, meta - logrado);

  /**
   * **El respaldo de la facultad sin campo, con su tasa a la vista.**
   *
   * Sin un curso-horario aplicado el motor no proyecta, y con razón: caer a la
   * τ prevista publicaría el supuesto como medición (ADR 0082). Pero el panel
   * necesita decir si lo agendado le alcanzaría, así que usa su propio aforo
   * agendado —que el motor sí publica— por la τ que su diseño le supuso, y lo
   * declara como cifra prestada. Antes caía a `deficitOperativo` y salía en
   * cero: Ciencias Contables decía «esperan traer 0» con 59 elegibles citados.
   */
  const tauPrestada = Number(f.tau_previsto);
  const aforo = Number(f.elegibles_agendados) || 0;
  const prestado = Number.isFinite(tauPrestada) && aforo > 0
    ? Math.round(aforo * tauPrestada)
    : respaldo?.enCamino ?? 0;

  const quedaria = medido
    ? Math.max(0, Math.round(-Number(f.margen_agendado)))
    : Math.max(0, falta - prestado);
  const enCamino = medido
    ? Math.max(0, Math.round(Number(f.proyectado_agendado) - logrado))
    : prestado;
  return {
    meta, logrado, falta, quedaria, enCamino, medido,
    // El conteo de cursos-horario no depende de la τ: el motor lo publica igual.
    cursosEnCamino: Number(f.cursos_agendados) || respaldo?.cursos || 0,
    cursosSinAgendar: Number(f.cursos_sin_agendar) || 0,
    cursosVencidos: Number(f.cursos_vencidos) || 0,
    // El margen del PLAN ENTERO decide cuál de las dos acciones toca: si con
    // todo agendado cerraría, el trabajo es agendar; si tampoco, refuerzo.
    loQueToca: quedaria <= 0 ? null
      : Number(f.margen_restante) >= 0 ? "agendar" : "reforzar",
  };
}

export function facultadesEnRiesgo(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined,
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): RiesgoDeFacultad[] {
  const filas = bloque?.facultades ?? [];
  if (!filas.length) return [];

  const salida: RiesgoDeFacultad[] = [];
  for (const f of filas) {
    const facultad = texto(f.facultad);
    if (!facultad) continue;
    const aplicados = Number(f.aulas_aplicadas) || 0;

    // Las dos cifras de la cuota y lo que ya viene, del mismo sitio que las
    // calcula el popover de refuerzo: una segunda fórmula del mismo pronóstico
    // empieza a discrepar con la primera.
    const cuota = cuotaDeLaFacultad(
      (celdasDeCuota ?? []) as Array<Record<string, unknown>>, facultad,
    );
    const def = cuota ? deficitOperativo(cuota, plan, facultad) : null;

    /**
     * **La cuenta la hace el MOTOR, no esta función.**
     *
     * Desde el 2026-09-11 el motor publica `proyectado_agendado` y
     * `margen_agendado`: la misma fórmula del margen sobre el aforo que tiene
     * fecha. Antes esto lo derivaba `deficitOperativo` en TypeScript y la
     * pantalla acababa con dos respuestas a la misma pregunta.
     *
     * El respaldo en TS sigue vivo para UN caso: la facultad sin campo. Ahí el
     * motor no proyecta a propósito (ADR 0082: caer a la τ prevista publicaría
     * el supuesto como medición) y el panel necesita igual una estimación para
     * decir si lo agendado le alcanzaría — declarándola como lo que es.
     */
    const cierre = cierreDeLaFacultad(f, {
      meta: (cuota?.meta.mujeres ?? 0) + (cuota?.meta.hombres ?? 0),
      logrado: (cuota?.logrado.mujeres ?? 0) + (cuota?.logrado.hombres ?? 0),
      quedaria: def?.quedaria.total ?? 0,
      enCamino: def?.enCamino.total ?? 0,
      cursos: def?.cursosEnCamino ?? 0,
    })!;
    const { meta, logrado, falta, quedaria, enCamino, cursosEnCamino } = cierre;

    /**
     * **No medirse es un riesgo sólo cuando hay algo en juego.** Sin campo
     * ninguno entra siempre —nada de lo que se le prevé está comprobado—; con
     * uno o dos cursos-horario entra si todavía debe y lo agendado no le sobra.
     */
    const aCiegas = aplicados === 0
      || (aplicados < MINIMO_PARA_COMPARAR && falta > 0
        && enCamino < falta * (1 + MARGEN_QUE_TRANQUILIZA));

    // Sin ninguno de los dos riesgos, la facultad no entra: un panel de aviso
    // que lista a todas deja de ser un aviso.
    if (quedaria <= 0 && !aCiegas) continue;

    // Cuándo vuelve a medirse: la primera de las que tiene en camino. Es la
    // respuesta a «¿hay que agendar algo la próxima semana?».
    let proximaFecha = "";
    for (const fila of plan ?? []) {
      if (texto(fila.faculty) !== facultad || !estaEnCamino(fila)) continue;
      const fecha = texto(fila.scheduled_date).slice(0, 10);
      if (fecha && (!proximaFecha || fecha < proximaFecha)) proximaFecha = fecha;
    }

    salida.push({
      facultad,
      clave: texto(f.faculty_key),
      aplicados,
      meta,
      logrado,
      falta,
      cursosEnCamino,
      cursosSinAgendar: cierre.cursosSinAgendar,
      cursosVencidos: cierre.cursosVencidos,
      loQueToca: cierre.loQueToca,
      enCamino,
      /** `false` cuando la facultad no tiene campo y la cifra es una estimación. */
      medido: cierre.medido,
      quedaria,
      proximaFecha,
      reservasLibres: Number(f.reservas_libres) || 0,
      aviso: quedaria > 0 ? "agenda_corta" : "a_ciegas",
    });
  }

  // La agenda corta primero y por tamaño: es lo que se puede mover hoy. Entre
  // las que están a ciegas manda la cuota, porque es lo que está en juego si
  // resulta que van mal.
  const peso = (r: RiesgoDeFacultad) => (r.aviso === "agenda_corta" ? 0 : 1);
  // Entre las que no pueden medirse manda la que menos campo tiene: la de cero
  // aplicados no ha comprobado nada de lo que se le prevé.
  return salida.sort((a, b) =>
    peso(a) - peso(b) || b.quedaria - a.quedaria
    || a.aplicados - b.aplicados || b.falta - a.falta
    || a.facultad.localeCompare(b.facultad, "es"));
}
