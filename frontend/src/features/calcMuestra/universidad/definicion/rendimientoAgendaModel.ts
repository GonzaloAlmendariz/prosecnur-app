/**
 * Cuántas aulas hubo que agendar en el estudio previo por cada una que se
 * aplicó de verdad.
 *
 * La tarjeta de referencia muestra los tres conteos crudos —agendados,
 * aplicados, observados— y deja que quien lee los divida. Pero el cociente es
 * justamente lo accionable: dice cuán profunda tiene que ser la cadena de
 * reemplazos para llegar al número de aulas que se quiere aplicar. Medido en
 * HSVBG 2025: 1.012 agendadas sostuvieron **194 aplicadas**, o sea 5,22
 * agendadas por cada una. Sin ese número, comparar la cadena de un diseño
 * nuevo contra el histórico exige sacar la calculadora — y se compara mal: la
 * primera lectura de este loop enfrentó las 1.012 agendadas de 2025 contra las
 * 360 de un diseño de 30 titulares, que son agendadas de n distintos.
 *
 * El modelo vive aparte del render porque aquí está lo que puede equivocarse:
 * de qué se puede dividir y de qué no.
 */

export type RendimientoAgenda = {
  agendados: number;
  aplicados: number;
  /** Agendadas por cada aula aplicada. */
  porAplicada: number;
  /** Proporción de las agendadas que llegó a aplicarse (0..1). */
  tasaAplicacion: number;
};

/**
 * Devuelve `null` cuando el cociente no significa nada:
 *
 * - Sin aplicadas no hay rendimiento que medir —dividir por cero—, y decir
 *   "infinitas agendadas por aplicada" es peor que no decir nada.
 * - Con más aplicadas que agendadas la fuente se contradice a sí misma, y un
 *   rendimiento menor que 1 se leería como "sobran aulas". La referencia de
 *   2025 ya se declara `verificada: false` con 21 registros inconsistentes de
 *   194, así que este caso no es hipotético: es el que hay que no publicar.
 */
export function rendimientoAgenda(
  agendados: number | null | undefined,
  aplicados: number | null | undefined,
): RendimientoAgenda | null {
  if (typeof agendados !== "number" || !Number.isFinite(agendados)) return null;
  if (typeof aplicados !== "number" || !Number.isFinite(aplicados)) return null;
  if (aplicados <= 0 || agendados < aplicados) return null;
  return {
    agendados,
    aplicados,
    porAplicada: agendados / aplicados,
    tasaAplicacion: aplicados / agendados,
  };
}
