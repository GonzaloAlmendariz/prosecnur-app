import type { TonoAviso } from "./avisoLibroImportado";

/**
 * Cuál de los dos avisos del sync se enseña.
 *
 * «Traer respuestas» hace DOS cosas —baja de la plataforma y conversa con el
 * Sheets— y cada una redacta su aviso, pero la pantalla tiene un solo sitio
 * donde ponerlo. Hasta el 2026-09-16 el de las fuentes se escribía DESPUÉS y
 * pisaba al del libro sin mirar qué decía: una publicación que fallaba quedaba
 * tapada por un «no trajo respuestas nuevas», que es la noticia más inocua de
 * las dos.
 *
 * Gonzalo lo vio desde fuera: «el botón de traer respuestas actualiza la data
 * de la app pero ya no actualiza el Sheets» — sin ningún error en pantalla.
 *
 * La regla es por GRAVEDAD, no por orden de escritura: si alguno pide
 * atención, ése manda. Entre dos que la piden gana el del libro, porque es el
 * que dice que algo NO se hizo; el de las fuentes, cuando es grave, dice que
 * lo que se ve es de antes, y eso sigue siendo cierto con el otro a la vista.
 */
export type AvisoDelSync = { texto: string; tono: TonoAviso };

export function avisoDelSync(
  conversacion: AvisoDelSync | null | undefined,
  fuentesVacias: { mensaje?: string; tono?: "ok" | "atencion" } | null | undefined,
): AvisoDelSync | null {
  const vacias: AvisoDelSync | null = fuentesVacias?.mensaje
    // Sin `tono` —payload de una versión anterior— se lee como atención, que
    // es como se comportaba antes de que el motor lo declarara.
    ? { texto: fuentesVacias.mensaje, tono: fuentesVacias.tono === "ok" ? "ok" : "atencion" }
    : null;
  const candidatos = [conversacion, vacias].filter((a): a is AvisoDelSync => !!a?.texto);
  if (!candidatos.length) return null;
  return candidatos.find((a) => a.tono === "atencion") ?? candidatos[candidatos.length - 1];
}
