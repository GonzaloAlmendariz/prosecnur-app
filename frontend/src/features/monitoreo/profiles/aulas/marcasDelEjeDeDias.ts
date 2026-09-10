/**
 * Qué días del eje llevan rótulo.
 *
 * Gonzalo, mirando los dos gráficos temporales: «a ninguno de los dos se le ven
 * bien los días, están salteados, y en el segundo directamente ni se ven».
 *
 * La regla anterior era «uno de cada `ceil(n/10)`», que con veinticinco días de
 * horizonte rotula uno de cada tres: 07/09, 10/09, 13/09… **Las cuatro jornadas
 * que de verdad tienen barra caían en 07 y 10, y el 08 y el 09 —el mejor día del
 * operativo, con 466— se quedaban sin fecha.** El eje rotulaba una malla de
 * calendario en vez de los días que el gráfico dibuja.
 *
 * La regla nueva tiene un orden de prioridades, y ése es todo el cambio:
 *
 * 1. **Los días con campo van SIEMPRE.** Son los que tienen barra y son pocos;
 *    si alguno se queda sin fecha, el gráfico enseña una barra que no se puede
 *    nombrar.
 * 2. Los extremos, que anclan la lectura de cuándo a cuándo.
 * 3. El resto del horizonte se relea para llenar los huecos, **sin acercarse a
 *    los ya puestos**: dos rótulos a menos de `separacion` posiciones se pisan,
 *    y ése era el defecto que la regla vieja evitaba a costa de perder los días
 *    con dato.
 */
export function marcasDelEjeDeDias(
  dias: ReadonlyArray<{ esDeCampo?: boolean }>,
  { separacion = 2, tope = 12 }: { separacion?: number; tope?: number } = {},
): number[] {
  const n = dias.length;
  if (!n) return [];
  if (n <= tope) return Array.from({ length: n }, (_, i) => i);

  const puestos = new Set<number>();
  // 1. Los que tienen barra.
  dias.forEach((d, i) => { if (d.esDeCampo) puestos.add(i); });
  // 2. Los extremos.
  puestos.add(0);
  puestos.add(n - 1);

  const cabe = (i: number) => ![...puestos].some((j) => Math.abs(i - j) < separacion);
  // 3. El resto, repartido, sin pisar a nadie. Se recorre de izquierda a derecha
  //    para que los huecos se llenen en el orden en que se leen.
  const paso = Math.max(separacion, Math.ceil(n / tope));
  for (let i = paso; i < n - 1; i += paso) {
    if (puestos.size >= tope) break;
    if (cabe(i)) puestos.add(i);
  }
  return [...puestos].sort((a, b) => a - b);
}
