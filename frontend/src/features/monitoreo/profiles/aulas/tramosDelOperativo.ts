import type { MonitoreoAulasTramo } from "../../../../api/monitoreo";

/**
 * Las dos decisiones de la tabla de tramos, fuera del componente.
 *
 * Viven aquí y no dentro del JSX porque son lo único que puede equivocarse de
 * verdad —qué se guarda y a qué fila pertenece cada cifra— y el perfil se
 * prueba con `renderToStaticMarkup`, que no pulsa botones. Mismo patrón que
 * `destinoDeDistribucion.ts` y `nombreDeAplicador.ts`.
 */

export type TramoEditable = { nombre: string; desde: string; hasta: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Los tramos que se pueden guardar: los que traen las DOS fechas.
 *
 * Un rango a medias no puede contener a nadie, así que no se guarda. Lo que no
 * se hace es descartarlo en silencio: el que llama sabe cuántos quedaron fuera
 * y lo dice en pantalla, porque si no, quien lo tecleó se queda creyendo que su
 * tramo existe.
 */
export function tramosGuardables(borrador: TramoEditable[]): TramoEditable[] {
  return (borrador ?? []).filter((t) => ISO.test(t?.desde ?? "") && ISO.test(t?.hasta ?? ""));
}

/**
 * El estado derivado que le corresponde a una fila, emparejado por RANGO.
 *
 * Por rango y no por posición: insertar un tramo en medio dejaría las cifras
 * pegadas a la fila de al lado sin que nada fallara, que es la clase de error
 * que no se ve mirando la pantalla —los números siguen ahí, sólo que en la
 * fila equivocada—.
 */
export function estadoDelTramo(
  tramos: MonitoreoAulasTramo[], fila: { desde: string; hasta: string },
): MonitoreoAulasTramo | undefined {
  return (tramos ?? []).find((t) => t.desde === fila.desde && t.hasta === fila.hasta);
}

/** `true` cuando el borrador es exactamente lo ya declarado: nada que guardar. */
export function sinCambios(borrador: TramoEditable[], declarados: MonitoreoAulasTramo[]): boolean {
  if ((borrador ?? []).length !== (declarados ?? []).length) return false;
  return borrador.every((t, i) => t.nombre === (declarados[i]?.nombre ?? "")
    && t.desde === declarados[i]?.desde && t.hasta === declarados[i]?.hasta);
}
