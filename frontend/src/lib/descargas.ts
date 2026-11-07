/**
 * Descarga un archivo servido por el backend también dentro de Electron.
 *
 * `setWindowOpenHandler` (desktop/main.cjs) deniega toda ventana nueva, así que
 * `window.open(downloadUrl(...))` no hace nada en la app de escritorio. Un
 * `<a download>` efímero se trata como descarga (`will-download` en Electron),
 * no como ventana. Sin `nombre`, el atributo queda vacío y el nombre lo pone el
 * `Content-Disposition` del servidor.
 */
export function descargarArchivo(url: string, nombre?: string): void {
  const ancla = document.createElement("a");
  ancla.setAttribute("href", url);
  ancla.setAttribute("download", nombre ?? "");
  ancla.rel = "noopener";
  ancla.style.display = "none";
  document.body.appendChild(ancla);
  try {
    ancla.click();
  } finally {
    ancla.remove();
  }
}
