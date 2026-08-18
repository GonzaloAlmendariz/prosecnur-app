import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Cuánto se lleva de la meta del plan, en respuestas.
 *
 * Avance mostraba dos gráficos de cursos-horario —en qué estado está cada uno y
 * cuánto lleva recogido— y ninguna lectura en la unidad en la que está escrita
 * la meta: **respuestas**. La banda dice «Válidas 3 700» y la meta del plan son
 * 4 376, así que a ojo se lee un 85 % de avance.
 *
 * No es 85 %. De esas 3 700, **542 son excedente**: se recogieron en aulas que
 * ya habían llegado a su meta y no cubren la falta de ninguna otra. Lo que de
 * verdad cubre la meta son 3 158, y faltan 1 218 repartidas en 92
 * cursos-horario. Es la misma trampa que ya tenía la cuota —pasarse en una
 * celda no cubre otra— y se resuelve igual: contando aula por aula.
 *
 * El criterio visual es el del histórico del cálculo de muestra (ADR 0060): las
 * mermas se nombran una por una y lo que no es lo que parece se distingue por
 * el COLOR, no con un párrafo debajo.
 */

export type AvanceEnRespuestas = {
  /** Lo que el plan pide: suma de la meta de cada curso-horario. */
  meta: number;
  /** Todas las respuestas válidas, excedente incluido. */
  validas: number;
  /** Las que cubren meta: por aula, nunca más de lo que esa aula pedía. */
  cubierto: number;
  /** Recogidas por encima de la meta de su aula. No cubren ninguna otra. */
  excedente: number;
  /** Lo que falta, sumado aula por aula. */
  falta: number;
  /** Cursos-horario que aún no llegan a su meta. */
  aulasConBrecha: number;
  /** Cumplimiento real sobre la meta, en puntos porcentuales. */
  avance: number;
  /** Cursos-horario cuya meta el plan no declara; quedan fuera del cálculo. */
  sinMeta: number;
};

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function avanceEnRespuestas(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
): AvanceEnRespuestas {
  let meta = 0;
  let validas = 0;
  let cubierto = 0;
  let excedente = 0;
  let falta = 0;
  let aulasConBrecha = 0;
  let sinMeta = 0;

  for (const fila of filas) {
    // El banco fuera del denominador. `extra_reserve_pool` son reservas sueltas
    // que el diseño no colgó de ningún titular: traen `expected_valid` porque
    // es lo que rendirían SI se activaran, no lo que el operativo pide hoy.
    //
    // Esto no elige política —si el banco debe contar o no para el estudio
    // sigue siendo una decisión abierta—: quita una contradicción. El motor ya
    // lo excluye (`tracked_df`) y esta vista no, así que la misma pantalla
    // enseñaba «meta 4 476» arriba y «la meta de 4 336» dos paneles más abajo.
    // Medido sobre el fixture: 4 476 con banco, 4 336 sin él, 140 de banco.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    // Y sólo el eslabón EN JUEGO de cada cadena. Un slot es la cadena entera y
    // en cada momento una sola de sus aulas es a la que hay que ir; sumar las
    // dormidas cuenta el mismo slot tantas veces como respaldos tenga. El motor
    // publica el dato en `course_status` para no duplicar aquí su lógica.
    // Medido: sin esto el panel pedía 4 336 mientras el ritmo y la cuota decían
    // 3 743 en la misma pantalla.
    if (fila.en_juego === false) continue;
    const objetivo = numero(fila.expected_valid);
    const recogidas = numero(fila.respuestas_validas);
    validas += recogidas;
    // Un aula sin meta declarada no entra en el denominador: su avance no está
    // definido y arrastrarla inflaría la meta con algo que nadie pidió. Se
    // cuenta aparte para que el descarte se vea.
    if (objetivo <= 0) { sinMeta += 1; continue; }
    meta += objetivo;
    cubierto += Math.min(recogidas, objetivo);
    excedente += Math.max(0, recogidas - objetivo);
    const brecha = Math.max(0, objetivo - recogidas);
    falta += brecha;
    if (brecha > 0) aulasConBrecha += 1;
  }

  return {
    meta,
    validas,
    cubierto,
    excedente,
    falta,
    aulasConBrecha,
    avance: meta > 0 ? Math.round((1000 * cubierto) / meta) / 10 : 0,
    sinMeta,
  };
}
