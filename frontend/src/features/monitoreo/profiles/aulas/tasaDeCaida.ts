import type { MonitoreoRow } from "../../../../api/monitoreo";
import { TASA_DE_CAIDA } from "./alertaDeAnticipacion";

/**
 * Si este estudio se está cayendo como el de 2025, que es lo que la alerta supone.
 *
 * `alertaDeAnticipacion` pide **más aulas de las que cubren la brecha** porque
 * una parte no llega a aplicarse, y para eso usa una constante fechada: de 170
 * titulares del operativo de 2025, 40 necesitaron reemplazo (23,5 %). Esa
 * constante se dejó a propósito y no se toca —«con dos semanas de campo la tasa
 * propia todavía es ruido, y una alerta que cambia de umbral cada día no se
 * puede usar para decidir»—.
 *
 * Lo que faltaba es **mirar si el supuesto se sostiene**. Si este estudio
 * estuviera cayendo al 35 %, la alerta estaría pidiendo un cuarto menos de las
 * aulas necesarias y nada lo diría; si cae al 14 %, está pidiendo de más, que es
 * el error barato pero también dinero. El número existe en los datos desde el
 * primer reemplazo y no se enseñaba en ninguna parte.
 *
 * ## El denominador son los DECIDIDOS, no los titulares
 *
 * Un titular que todavía no se ha aplicado ni se ha caído **no es un titular que
 * no cayó**: es uno cuyo desenlace no se sabe. Contarlo abajo hunde la tasa a
 * mitad de campo, justo cuando la comparación tendría que servir para algo. Es
 * el mismo error de «una palabra para dos cosas» que este perfil lleva
 * persiguiendo: «no caído» y «todavía sin resolver» no son lo mismo.
 *
 * Sobre el fixture: 170 titulares, de los que **130 salieron y 24 se cayeron**
 * —154 con desenlace— y 16 siguen agendados sin aplicar. La tasa es 24/154, no
 * 24/170 ni 24/24.
 *
 * ## La lista cerrada va del lado de los PENDIENTES, no de los aplicados
 *
 * Si un estado que significa «ya salió» no se reconociera, esa aula caería en
 * pendiente, el denominador encogería y la tasa de caída saldría MÁS ALTA de lo
 * real: la lista diría «se están cayendo más, estás pidiendo de menos» y mandaría
 * a pedir aulas de más por un estado mal escrito. Nombrar los pendientes y dar
 * por salido todo lo demás falla al revés, que es el error barato.
 *
 * ## Y no se declara diferencia hasta que la haya
 *
 * Con pocos desenlaces, cualquier tasa se parece a cualquier otra. Se compara
 * contra una banda de **dos errores estándar** alrededor del 23,5 % —el margen
 * que tendría una muestra de ese tamaño si el estudio se cayera igual que
 * 2025—, y sólo fuera de esa banda se dice que va distinto. Dentro, se enseña la
 * cifra sin veredicto, que es lo honesto: se ve el dato y no se le pone nombre.
 */

/** Desenlaces mínimos para que la banda signifique algo. */
export const DESENLACES_MINIMOS = 20;

export type CaidaObservada = {
  /** Titulares cuyo desenlace ya se sabe: aplicados o reemplazados. */
  decididos: number;
  /** De ésos, los que necesitaron reemplazo. */
  caidas: number;
  /** Proporción 0-1. `null` cuando todavía no hay ningún desenlace. */
  tasa: number | null;
  /** Margen de dos errores estándar, en proporción. `null` sin evidencia. */
  margen: number | null;
  /**
   * Cómo va contra el supuesto de 2025. `null` mientras la diferencia quepa
   * dentro del margen o no haya evidencia suficiente: no saber es un estado, y
   * llamarle «igual» sería afirmar algo que no se ha medido.
   */
  direccion: "se caen más" | "se caen menos" | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

/**
 * Estados del circuito en los que un aula TODAVÍA NO ha salido.
 *
 * Ojo con `planificada`: un titular reemplazado se queda ahí —nunca salió— así
 * que la caída se comprueba ANTES, contra `sample_status`, o los 24 caídos del
 * fixture se leerían como pendientes.
 */
const NO_HA_SALIDO = new Set([
  "", "-", "planificada", "agendada", "contactada", "reagendada",
  "en_reserva", "sin_contactar",
]);

/**
 * @param plan filas del plan con `sample_role` y `sample_status`.
 */
export function caidaObservada(plan: ReadonlyArray<MonitoreoRow>): CaidaObservada {
  let decididos = 0;
  let caidas = 0;
  for (const fila of plan) {
    if (texto(fila.sample_role) !== "titular") continue;
    // La caída, PRIMERO: un titular reemplazado conserva
    // `operational_status = "planificada"` porque nunca llegó a salir.
    if (texto(fila.sample_status) === "reemplazada") { decididos += 1; caidas += 1; continue; }
    const circuito = texto(fila.operational_status);
    if (circuito.startsWith("en reserva") || NO_HA_SALIDO.has(circuito)) continue;
    decididos += 1;
  }

  if (!decididos) {
    return { decididos: 0, caidas: 0, tasa: null, margen: null, direccion: null };
  }
  const tasa = caidas / decididos;
  if (decididos < DESENLACES_MINIMOS) {
    return { decididos, caidas, tasa, margen: null, direccion: null };
  }
  // El margen que tendría una muestra de este tamaño SI el estudio se cayera
  // igual que 2025: se calcula con la p de referencia, no con la observada, que
  // es lo que hace que la banda sea la del supuesto y no la del dato.
  const margen = 2 * Math.sqrt((TASA_DE_CAIDA * (1 - TASA_DE_CAIDA)) / decididos);
  const diferencia = tasa - TASA_DE_CAIDA;
  return {
    decididos,
    caidas,
    tasa,
    margen,
    direccion: Math.abs(diferencia) <= margen
      ? null
      : diferencia > 0 ? "se caen más" : "se caen menos",
  };
}
