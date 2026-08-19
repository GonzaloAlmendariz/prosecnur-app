import type { FacultadDelBanco } from "./AulasBancoExtras";
import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";
import { diasDeCampoEntre, restarDiasDeCampo } from "./pronosticoDeCierre";

/**
 * Cuándo hay que salir a agendar más aulas, cuántas, y **hasta qué día se puede
 * esperar**.
 *
 * Gonzalo: «alguna alerta que se tuviera que tener, **en qué momento ya es
 * necesario ir agendando más aulas** [...] porque **recordemos que siempre hay
 * que agendar con tiempo**»; y al revisarla: «debemos ser capaces de predecir
 * esto con antelación».
 *
 * ## Por qué el margen sale de la agenda y no de la fecha de cierre
 *
 * La primera versión decidía la urgencia con los días que faltaban para cerrar
 * el estudio. Medido: **el perfil de aulas no publica ninguna fecha de cierre**
 * —`end_date` no existe en su payload— así que ese parámetro nunca se pasó y la
 * rama «hay margen» no se pintó jamás en producción: toda facultad con brecha
 * salía «pedir ahora», siempre, y la columna «Cuándo» se ocultaba sola por ser
 * la misma palabra veinte veces. Los tests la daban por cubierta porque le
 * pasaban a mano un número que la pantalla no tenía de dónde sacar.
 *
 * El margen real es **por facultad y ya está en los datos**: una facultad se
 * queda sin qué aplicar el día que se acaba SU agenda, no el día que cierra el
 * estudio. Si a Derecho le quedan tres días agendados y a Letras dieciséis, la
 * primera es urgente y la segunda no, aunque el estudio cierre el mismo día para
 * las dos.
 *
 * ## Los tres momentos
 *
 * Contando siempre en **días de campo** —el domingo no se aplica—:
 *
 * - **`hay margen`**: la agenda alcanza para más de los días que tarda un aula
 *   en conseguirse. Se dice la fecha exacta: *pedir antes del 24/08*.
 * - **`pedir ahora`**: queda agenda, pero menos que esos días. Si no se llama
 *   hoy, habrá días sin nada que aplicar en esa facultad.
 * - **`sin agenda`**: no queda ninguna aula por delante y la cuota sigue
 *   abierta. Ahí el campo YA está parado; es lo más urgente que puede decir esta
 *   lista y antes se confundía con lo anterior.
 *
 * ## Y si el banco de esa facultad no tiene las aulas que se piden
 *
 * Decir «pide 14 en Educación» sin mirar si existen es mandar a llamar al
 * vacío. El banco de extras **es** el sitio de donde salen esas aulas —no
 * reemplazan a nadie: existen para cerrar la cuota de hombres y mujeres por
 * facultad— y viene repartido por estrato, no en un montón común.
 *
 * Cuando el banco de la facultad no llega, **el problema deja de ser de agenda y
 * pasa a ser de muestra**: no hay llamada que lo arregle, hay que volver a
 * Cálculo de muestra. Se dice con `bancoAlcanza`, y en ese caso la lista tiene
 * que hablar distinto, porque las dos situaciones piden acciones opuestas.
 *
 * ## Los dos umbrales vienen del operativo de 2025, no de una intuición
 *
 * Medidos sobre la hoja «Aulas Agendadas» del libro real:
 *
 * - **Anticipación**: entre la llamada y la aplicación pasaron **7 días** de
 *   mediana en los titulares (rango 0–21). Los reemplazos se agendaron más
 *   justos —5 y 4,5 días—, pero se toma el del titular porque el error barato es
 *   pedir con demasiado margen, no con poco.
 * - **Caída**: de 170 titulares, **40 necesitaron reemplazo (23,5 %)**. Pedir
 *   exactamente las aulas que faltan es pedir de menos.
 *
 * Los dos son constantes **declaradas y fechadas**, no estimadas del corte en
 * curso: con dos semanas de campo la tasa de caída propia todavía es ruido, y
 * una alerta que cambia de umbral cada día no se puede usar para decidir.
 */

/** Días entre llamar a un aula y aplicarla. Mediana de los titulares, 2025. */
export const DIAS_DE_ANTICIPACION = 7;

/** Proporción de titulares que en 2025 acabaron necesitando reemplazo. */
export const TASA_DE_CAIDA = 0.235;

export type UrgenciaDeAgenda = "sin brecha" | "hay margen" | "pedir ahora" | "sin agenda";

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
  /** Días de campo que quedan de agenda desde el corte. 0 si ya se secó. */
  diasDeAgenda: number;
  /**
   * Extras de ESA facultad que todavía no entraron al operativo. `null` cuando
   * el estudio no publica banco: no saber cuántas quedan no es lo mismo que
   * saber que no queda ninguna, y pintarlo como cero acusaría de una escasez
   * que nadie midió.
   */
  bancoDisponible: number | null;
  /**
   * Si el banco de la facultad cubre lo que hay que pedir. `null` cuando no hay
   * banco publicado o no hay nada que pedir.
   */
  bancoAlcanza: boolean | null;
  /**
   * Último día útil para llamar sin que la facultad se quede parada: el día del
   * que aún salen `DIAS_DE_ANTICIPACION` días de campo antes de que se acabe su
   * agenda. `null` cuando no queda agenda que proteger.
   */
  pedirAntesDe: string | null;
  urgencia: UrgenciaDeAgenda;
};

/**
 * @param proyeccion lo que devuelve `proyeccionPorAgenda`, con su `corte`.
 *
 * El ancla es el `corte` —último día con parte—, no el reloj de la máquina: con
 * `Date.now()` un estudio de agosto abierto en septiembre saldría entero
 * «sin agenda». Si todavía no hay ningún parte el campo no ha empezado, y
 * entonces el ancla es el **primer día agendado** de esa facultad, que es el
 * hecho más temprano disponible; no se inventa un hoy.
 *
 * @param banco `banco_extras.por_facultad` del payload, si el estudio lo trae.
 */
export function alertaDeAnticipacion(
  proyeccion: ReadonlyArray<ProyeccionDeFacultad>,
  banco: ReadonlyArray<FacultadDelBanco> = [],
): AlertaDeFacultad[] {
  // Se indexa por nombre de facultad porque es la clave con la que el motor
  // publica las dos cosas. `disponibles` puede faltar en un payload viejo: ahí
  // el banco existe pero no se sabe cuánto queda, y eso NO es cero.
  const porFacultad = new Map(banco.map((f) => [f.faculty, f]));

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

      const primerDiaAgendado = f.dias.length ? f.dias[0].fecha : null;
      const ultimoDiaAgendado = f.dias.length ? f.dias[f.dias.length - 1].fecha : null;
      const ancla = f.corte || primerDiaAgendado || "";
      const diasDeAgenda = ancla && ultimoDiaAgendado
        ? diasDeCampoEntre(ancla, ultimoDiaAgendado)
        : 0;
      const margen = diasDeAgenda - DIAS_DE_ANTICIPACION;

      const urgencia: UrgenciaDeAgenda = faltan <= 0
        ? "sin brecha"
        // Sin nada agendado por delante, la facultad ya está parada: no es que
        // quede poco margen, es que se acabó.
        : diasDeAgenda <= 0
          ? "sin agenda"
          : margen <= 0 ? "pedir ahora" : "hay margen";

      const suyo = porFacultad.get(f.facultad);
      const bancoDisponible = suyo == null
        ? null
        : typeof suyo.disponibles === "number" ? suyo.disponibles : null;

      return {
        facultad: f.facultad,
        faltan,
        esperadoPorAula: porAula,
        aulasNecesarias,
        aulasAPedir,
        aulasAgendadas: f.aulasAgendadas,
        ultimoDiaAgendado,
        diasDeAgenda,
        pedirAntesDe: urgencia === "hay margen" && ultimoDiaAgendado
          ? restarDiasDeCampo(ultimoDiaAgendado, DIAS_DE_ANTICIPACION)
          : null,
        bancoDisponible,
        bancoAlcanza: bancoDisponible == null || aulasAPedir <= 0
          ? null
          : bancoDisponible >= aulasAPedir,
        urgencia,
      } satisfies AlertaDeFacultad;
    })
    // El orden es el de salir a llamar: primero las que ya están paradas,
    // después las que se paran esta semana, y al final las que tienen margen.
    //
    // Dentro de cada grupo el desempate CAMBIA, porque cambia la pregunta. En
    // las urgentes se llama a todas hoy, así que ordena el tamaño del pedido.
    // En las que tienen margen la pregunta es a cuál le vence antes el plazo, y
    // ordenarlas por tamaño dejaba la columna de fechas saltando —25/08, 22/08,
    // 24/08, 21/08…— justo en el grupo donde la fecha es lo único que decide.
    .sort((a, b) => {
      const peso = (u: UrgenciaDeAgenda) => (
        u === "sin agenda" ? 0 : u === "pedir ahora" ? 1 : u === "hay margen" ? 2 : 3
      );
      const grupo = peso(a.urgencia) - peso(b.urgencia);
      if (grupo !== 0) return grupo;
      if (a.urgencia === "hay margen" && a.pedirAntesDe && b.pedirAntesDe && a.pedirAntesDe !== b.pedirAntesDe) {
        return a.pedirAntesDe.localeCompare(b.pedirAntesDe);
      }
      return b.aulasAPedir - a.aulasAPedir
        || a.facultad.localeCompare(b.facultad, "es");
    });
}
