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

/** La fuente de los ejes de aulas, para el `layout` de un `PlotlyChart`. */
export function fuenteDeEjeAulas() {
  return {
    family: "system-ui, -apple-system, sans-serif",
    size: 10,
    color: token("--pulso-text-faint", "#657082"),
  };
}
