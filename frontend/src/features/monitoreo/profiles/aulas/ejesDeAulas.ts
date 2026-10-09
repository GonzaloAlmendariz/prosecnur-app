/**
 * La tipografía de eje del perfil, para los gráficos de Plotly.
 *
 * El perfil tiene dos clases de gráfico —SVG escrito a mano y Plotly— y sus
 * ejes no coincidían: los cuatro SVG usan `--aulas-min` (10 px) con
 * `--pulso-text-faint`, que es la escala declarada del perfil, y Plotly pintaba
 * los suyos a 11 px con `--pulso-text-soft` por su default compartido. Un punto
 * de más y un tono más oscuro en la mitad de los gráficos de la misma pantalla.
 *
 * **No se toca `PlotlyChart`**: su default lo comparten Gráficos, el Dashboard y
 * los otros tres perfiles de Monitoreo, y cambiarlo desde aquí sería mover el
 * sistema entero para alinear una pantalla. El componente ya deja sobrescribir
 * `font` porque el spread del layout de quien llama va después, así que la
 * excepción se declara donde vive: en el perfil.
 *
 * El color se lee del documento, no se copia: un cambio de tema —o el modo
 * oscuro— tiene que llegar solo, igual que en `PlotlyChart`.
 */
function token(nombre: string, respaldo: string) {
  if (typeof document === "undefined") return respaldo;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || respaldo;
}

/**
 * La cifra que va SOBRE una barra no es un rotulo de eje.
 *
 * `layout.font` gobierna los ticks y, de paso, el texto de las barras: las
 * cifras salian a 10 px como una marca de eje cualquiera. Pero el tick es
 * mobiliario y el numero sobre la barra es **el dato** —lo que la persona vino
 * a leer—, asi que va en la escala de lectura del perfil y con peso. Ademas un
 * texto mas grande y semibold necesita menos contraste para leerse, que es la
 * otra mitad del «no se ve» que se reporto desde la pantalla.
 */
export function fuenteDeCifraEnBarra(color: string | string[]) {
  return { family: "system-ui, -apple-system, sans-serif", size: 12, weight: 600, color };
}

/**
 * Un alto declarado en la hoja, en px, para quien necesita el numero en JS.
 *
 * Plotly exige el alto como numero, asi que no puede leerlo de CSS por su
 * cuenta. Pero si el numero vive SOLO en el TSX, el vecino que tiene que
 * emparejarse con el —el tope de la lista de facultades, que es CSS— acaba
 * siendo una copia a mano en otro archivo. Fue exactamente lo que paso: 360
 * aqui y 400 alla, y al crecer uno de los dos paneles la pareja se descaso 31 px.
 *
 * Con esto la hoja es la fuente y el TSX la lee. El respaldo mantiene el
 * comportamiento de hoy si la hoja aun no esta aplicada.
 */
export function altoDeclarado(nombre: string, respaldo: number): number {
  const px = Number.parseFloat(token(nombre, ""));
  return Number.isFinite(px) && px > 0 ? px : respaldo;
}

/** La fuente de los ejes de aulas, para el `layout` de un `PlotlyChart`. */
export function fuenteDeEjeAulas() {
  return {
    family: "system-ui, -apple-system, sans-serif",
    size: 10,
    color: token("--pulso-text-faint", "#657082"),
  };
}
