import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";

/**
 * Cuándo hay que salir a agendar más aulas, y cuántas.
 *
 * Gonzalo: «alguna alerta que se tuviera que tener, **en qué momento ya es
 * necesario ir agendando más aulas**, porque se van a agendar los titulares,
 * pero cuando ya se recomienda agendar algún reemplazo, por más que ya se haya
 * aplicado de forma efectiva algún aula, hay que ir agendando, porque
 * **recordemos que siempre hay que agendar con tiempo**».
 *
 * La alerta no dice «te quedaste sin aulas» —para entonces ya es tarde—: dice
 * **cuántas aulas más hacen falta y hasta cuándo se puede esperar para pedirlas**.
 *
 * ## Los dos números vienen del operativo de 2025, no de una intuición
 *
 * Medidos sobre la hoja «Aulas Agendadas» del libro real, doce bloques de veinte
 * columnas, uno por muestra:
 *
 * - **Anticipación**: entre la llamada y la aplicación pasaron **7 días** de
 *   mediana en los titulares (rango 0–21). Los reemplazos se agendaron más
 *   justos —5 y 4,5 días—, pero se toma el del titular porque el error barato es
 *   pedir con demasiado margen, no con poco.
 * - **Caída**: de 170 titulares, **40 necesitaron reemplazo (23,5 %)**. Así que
 *   pedir exactamente las aulas que faltan es pedir de menos: una de cada cuatro
 *   no se va a aplicar.
 *
 * Los dos son constantes **declaradas y fechadas**, no estimadas del corte en
 * curso: con dos semanas de campo la tasa de caída propia todavía es ruido, y una
 * alerta que cambia de umbral cada día no se puede usar para decidir.
 */

/** Días entre llamar a un aula y aplicarla. Mediana de los titulares, 2025. */
export const DIAS_DE_ANTICIPACION = 7;

/** Proporción de titulares que en 2025 acabaron necesitando reemplazo. */
export const TASA_DE_CAIDA = 0.235;

export type UrgenciaDeAgenda = "sin brecha" | "hay margen" | "pedir ahora";

export type AlertaDeFacultad = {
  facultad: string;
  /** Lo que seguiría faltando cuando se acabe la agenda, sumando los dos sexos. */
  faltan: number;
  esperadoPorAula: number;
  /** Aulas que cubrirían esa brecha si todas se aplicaran. */
  aulasNecesarias: number;
  /** Las que hay que pedir contando con que una parte se caerá. */
  aulasAPedir: number;
  /** Aulas ya agendadas por delante, que es lo que amortigua. */
  aulasAgendadas: number;
  /** Último día con agenda de esa facultad, o `null` si no tiene ninguna. */
  ultimoDiaAgendado: string | null;
  urgencia: UrgenciaDeAgenda;
};

/**
 * @param proyeccion lo que devuelve `proyeccionPorAgenda`.
 * @param diasDeCampoRestantes días de campo que quedan hasta el cierre previsto.
 *   Si no se sabe, se pasa `null` y la urgencia se decide sólo por la brecha: sin
 *   fecha de cierre no se puede decir que quede o falte margen.
 */
export function alertaDeAnticipacion(
  proyeccion: ReadonlyArray<ProyeccionDeFacultad>,
  diasDeCampoRestantes: number | null = null,
): AlertaDeFacultad[] {
  return proyeccion
    .map((f) => {
      const faltan = f.cuotas.reduce((n, c) => n + c.faltanAlCerrarAgenda, 0);
      const porAula = f.esperadoPorAula > 0 ? f.esperadoPorAula : 0;
      const aulasNecesarias = faltan > 0 && porAula > 0 ? Math.ceil(faltan / porAula) : 0;
      // Pedir exactamente las que faltan es pedir de menos: una de cada cuatro no
      // se va a aplicar. Se pide sobre el neto, que es como se dimensiona una
      // reserva.
      const aulasAPedir = aulasNecesarias > 0
        ? Math.ceil(aulasNecesarias / (1 - TASA_DE_CAIDA))
        : 0;
      const ultimoDiaAgendado = f.dias.length ? f.dias[f.dias.length - 1].fecha : null;
      const urgencia: UrgenciaDeAgenda = faltan <= 0
        ? "sin brecha"
        // Sin fecha de cierre no hay margen que calcular; con brecha y sin saber
        // cuánto queda, lo prudente es tratarlo como urgente.
        : diasDeCampoRestantes == null || diasDeCampoRestantes <= DIAS_DE_ANTICIPACION
          ? "pedir ahora"
          : "hay margen";
      return {
        facultad: f.facultad,
        faltan,
        esperadoPorAula: porAula,
        aulasNecesarias,
        aulasAPedir,
        aulasAgendadas: f.aulasAgendadas,
        ultimoDiaAgendado,
        urgencia,
      } satisfies AlertaDeFacultad;
    })
    // Primero las que hay que pedir ya, y dentro de cada grupo las que más aulas
    // necesitan: es el orden en el que se sale a llamar.
    .sort((a, b) => {
      const peso = (u: UrgenciaDeAgenda) => (u === "pedir ahora" ? 0 : u === "hay margen" ? 1 : 2);
      return peso(a.urgencia) - peso(b.urgencia)
        || b.aulasAPedir - a.aulasAPedir
        || a.facultad.localeCompare(b.facultad, "es");
    });
}
