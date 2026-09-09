/**
 * ¿Cabe el rótulo «aplicado» a la izquierda de la línea de corte?
 *
 * Los dos rótulos que nombran los lados del corte van `position: absolute`
 * pegados a él: «aplicado» se ancla con `right: 100 − corte%` y crece hacia la
 * izquierda. Con el operativo recién arrancado el corte está casi en el borde
 * —el 2026-09-09: UN día con parte y 15 agendados por delante, o sea el corte al
 * 4 % del lienzo— así que el rótulo se sale del lienzo y se monta encima del
 * «500» del eje. Gonzalo: «la leyenda de aplicado agendado no está saliendo muy
 * bien».
 *
 * **Se decide por la anchura disponible, no por el número de días**, porque el
 * problema es de píxeles: dos días en un calendario de tres dejan sitio de
 * sobra, y dos en uno de cuarenta no.
 *
 * Cuando no cabe se retira SÓLO «aplicado» y se conserva «agendado». La línea
 * punteada sigue marcando el corte, el lado teñido sigue siendo el de lo
 * inferido, y el pie del gráfico explica los dos lados; lo que se pierde es un
 * rótulo redundante, no la información. Al revés —dejar los dos y que uno se
 * monte sobre el eje— se pierden los dos, porque ninguno se lee.
 */

/**
 * El ancho del lienzo que queda a la izquierda del corte, en porcentaje.
 * `MARGEN` es donde empieza el área de dibujo (4 %).
 */
export function anchoAntesDelCorte(cortePct: number, margenPct = 4): number {
  if (!Number.isFinite(cortePct)) return 0;
  return Math.max(0, cortePct - margenPct);
}

/**
 * Umbral en porcentaje del lienzo. «APLICADO» son 8 caracteres en versalitas de
 * ~9,5 px con su cápsula: unos 66 px, que sobre el lienzo más estrecho de la
 * matriz de QA (1024) son ~7 %, y sobre 1440 unos 5 %. Se toma 12 % para tener
 * holgura en el estrecho sin retirar el rótulo cuando sí cabe.
 */
export const ANCHO_MINIMO_DEL_ROTULO = 12;

export function cabeElRotuloAplicado(cortePct: number, margenPct = 4): boolean {
  return anchoAntesDelCorte(cortePct, margenPct) >= ANCHO_MINIMO_DEL_ROTULO;
}
