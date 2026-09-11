import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { deudaPorFacultad, type DeudaDeFacultad } from "./deudaPorFacultad";
import { ESTADOS_QUE_LIBERAN } from "./candidatosDeReemplazo";

/**
 * **Las facultades que peor rinden frente a lo que se preveía de ellas.**
 *
 * Gonzalo, 2026-09-11: «en la pestaña general no hay contexto sobre cuáles son
 * las facultades con peor tasa observada vs tasa prevista o de diseño; podría
 * ser hasta un KPI o una tarjeta con el top 4 o 5, y que también se vaya
 * ajustando cuando ya empiezan a tener complementos o refuerzos».
 *
 * **No es el ranking de deuda que ya existe**, y por eso va aparte. Aquél
 * ordena por CUÁNTAS respuestas faltan —tamaño—; éste por QUÉ TAN MAL rinde
 * —eficiencia—. Son señales distintas y piden acciones distintas:
 *
 * - Una facultad grande puede deber mucho rindiendo bien: le falta terreno, no
 *   ayuda, y se cierra aplicando lo que ya tiene agendado.
 * - Una pequeña puede rendir a la mitad de lo previsto y apenas asomar en la
 *   deuda. Ahí hay algo que no funciona en campo —el aula, la hora, quién
 *   aplica— y meter más aulas sin mirarlo repite el problema.
 *
 * **Se ajusta solo cuando entran complementos y refuerzos**, porque la tasa
 * observada se mide sobre todo lo aplicado: en cuanto uno rinde, su facultad
 * sube. Lo que el panel añade es decir CUÁNTOS lleva, para que esa mejora no
 * parezca espontánea.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * El plan escribe el nombre de la facultad y el bloque de efectividad lo
 * reescribe al agregar; cruzarlos por la cadena cruda deja fuera a la que
 * difiera en un espacio o en una tilde mayúscula, y el conteo de apoyos sale
 * en cero sin que nada falle.
 */
const claveDeFacultad = (v: unknown) =>
  texto(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

/**
 * **El mínimo para comparar.** Con uno o dos cursos-horario aplicados la razón
 * entre observada y prevista es ruido: un aula vacía hunde a su facultad y la
 * pondría primera en un ranking que se lee como diagnóstico.
 */
export const MINIMO_PARA_COMPARAR = 3;

export type RendimientoDeFacultad = DeudaDeFacultad & {
  /** Observada sobre prevista. 1 es cumplir exactamente lo previsto. */
  razon: number;
  /** Cursos-horario de refuerzo o complemento que ya rindieron en ella. */
  apoyosAplicados: number;
};

export function peorRendimiento(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  porSexo: ReadonlyArray<Record<string, unknown>> | null | undefined,
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  cuantas = 5,
): {
  /** Sólo las que rinden POR DEBAJO de lo previsto, hasta el tope pedido. */
  peores: RendimientoDeFacultad[];
  comparables: number;
  /** Cuántas de las comparables rinden por debajo. Es la base de la lista. */
  porDebajo: number;
  apartadas: number;
  /** Apoyos que ya rindieron en todo el estudio: hoy explica por qué no se ven. */
  apoyosEnElEstudio: number;
  /** Todas las comparables ordenadas, para situar a una facultad concreta. */
  todas: RendimientoDeFacultad[];
} {
  const filas = deudaPorFacultad(bloque, porSexo);

  /**
   * Los apoyos que ya rindieron, por facultad: lo que no es titular y trajo
   * respuestas. Es lo que hace subir la tasa de una facultad sin que nadie haya
   * cambiado de método, y nombrarlo evita leerlo como mejora espontánea.
   */
  const apoyos = new Map<string, number>();
  for (const f of plan ?? []) {
    if (texto(f.sample_role) === "titular") continue;
    const rindio = Number(f.respuestas_validas) > 0
      || ESTADOS_QUE_LIBERAN.has(texto(f.operational_status).toLowerCase());
    if (!rindio) continue;
    const fac = claveDeFacultad(f.faculty);
    if (fac) apoyos.set(fac, (apoyos.get(fac) ?? 0) + 1);
  }

  const comparables = filas.filter(
    (f) => f.aulas >= MINIMO_PARA_COMPARAR && f.observada != null && f.prevista != null && f.prevista > 0,
  );
  const todas = comparables
    .map((f) => ({
      ...f,
      razon: f.observada! / f.prevista!,
      apoyosAplicados: apoyos.get(claveDeFacultad(f.facultad)) ?? 0,
    }))
    // Peor primero; a igual razón, la que más aplicados tiene, porque su cifra
    // descansa en más campo.
    .sort((a, b) => a.razon - b.razon || b.aulas - a.aulas);

  /**
   * **Sólo entran las que rinden por debajo.** Con el corte del 2026-09-11 el
   * top 5 traía tres facultades al 100,1 %, 102,1 % y 102,3 %: un panel titulado
   * «las que más se alejan de su previsión» listando a las que la cumplen. El
   * tope es un máximo, no una cuota que haya que llenar.
   */
  const malas = todas.filter((f) => f.razon < 1);

  return {
    peores: malas.slice(0, cuantas),
    todas,
    porDebajo: malas.length,
    comparables: comparables.length,
    // El conjunto de apoyos que ya rindieron. Sin esta cifra, una lista entera
    // sin apoyos se lee como que el cruce falla; hoy es que aún no han entrado.
    apoyosEnElEstudio: [...apoyos.values()].reduce((a, b) => a + b, 0),
    // Las que no llegan al mínimo se cuentan y se dicen: apartarlas en silencio
    // haría creer que el ranking mira a todas.
    apartadas: filas.filter((f) => f.observada != null && f.aulas < MINIMO_PARA_COMPARAR).length,
  };
}
