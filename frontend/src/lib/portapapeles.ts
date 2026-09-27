/**
 * Copia texto al portapapeles también dentro de Electron.
 *
 * El handler de permisos de Electron (desktop/main.cjs, commit 420baf5e1)
 * niega `clipboard-sanitized-write`: `navigator.clipboard.writeText` rechaza
 * y un botón que sólo lo usa falla en silencio. Si rechaza, se copia con un
 * textarea y `execCommand("copy")`, que no pide permiso pero sí un gesto del
 * usuario (un click real). Lanza si ninguno de los dos pudo copiar, para que
 * el llamador no anuncie «copiado» en falso.
 */
export async function copiarTexto(texto: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch {
      // sigue al fallback
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("El navegador no dejó copiar al portapapeles.");
  } finally {
    document.body.removeChild(textarea);
  }
}
