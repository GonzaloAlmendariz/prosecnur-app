import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
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
   * Cuál de los dos riesgos manda. La agenda corta va primero: es accionable
   * hoy —se activa una reserva— y no depende de esperar a medir.
   */
  aviso: AvisoDeFacultad;
};

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

    const quedaria = def?.quedaria.total ?? 0;
    const meta = (cuota?.meta.mujeres ?? 0) + (cuota?.meta.hombres ?? 0);
    const logrado = (cuota?.logrado.mujeres ?? 0) + (cuota?.logrado.hombres ?? 0);
    const falta = Math.max(0, meta - logrado);
    const enCamino = def?.enCamino.total ?? 0;

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
      cursosEnCamino: def?.cursosEnCamino ?? 0,
      enCamino,
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
