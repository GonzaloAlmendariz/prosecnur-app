import { contadorDeCursosHorario } from "./AulasMonitoreoPage";

/**
 * **Cuántos cursos-horario reparte el gráfico que va debajo de este rótulo.**
 *
 * Los dos gráficos de Resumen prefieren el reparto que publica el motor
 * —calculado sobre todas las filas y no sobre las 500 que viajan— y sólo caen a
 * las filas recortadas cuando ese reparto no llega. El rótulo tiene que decir lo
 * que reparte SU gráfico:
 *
 * | panel | reparto | rotulaba | rotula |
 * |---|---|---|---|
 * | Estado de aplicación | 1.424 | 1.424 | 1.424 |
 * | Cursos-horario por cobertura | **174** | **1.424** | **174** |
 *
 * La versión anterior sólo miraba si el resumen era un array no vacío y
 * devolvía el total en los dos casos. Era cierta para el primero y falsa para el
 * segundo, que reparte los que tienen meta.
 */
export function contadorDeLoQueReparte(
  resumenDelMotor: unknown,
  { total, filasQueViajan, deReservaAdicional }: { total: number; filasQueViajan: number; deReservaAdicional: number },
): string {
  const reparto = Array.isArray(resumenDelMotor) ? resumenDelMotor : [];
  const suma = reparto.reduce(
    (n, tramo) => n + (Number((tramo as { aulas?: unknown }).aulas) || 0),
    0,
  );
  // Sin reparto del motor el gráfico pinta las filas recortadas, y ahí el aviso
  // «se ven X de Y» sí corresponde.
  if (!suma) return contadorDeCursosHorario(filasQueViajan, total, deReservaAdicional);
  /**
   * Con reparto, lo que pinta es su PROPIO universo y no un recorte de otro.
   * Pasar el total como denominador produciría «se ven 174 de 1.424», que es un
   * aviso de recorte igual de falso: a cobertura no le faltan 1.250 filas, es
   * que 1.250 no tienen meta que cubrir. La reserva adicional sólo se nombra
   * cuando el universo es el que la contiene.
   */
  return contadorDeCursosHorario(suma, suma, suma === total ? deReservaAdicional : 0);
}
