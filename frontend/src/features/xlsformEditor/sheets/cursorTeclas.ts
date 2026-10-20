// Inicio/Fin dentro de un campo de texto (E10, 2026-10-20). En macOS Chromium esas teclas desplazan el contenedor en
// vez de mover el cursor: en la barra de fórmula el texto se insertaba a media cadena y en la tabla la fila salía de la
// ventana. Aquí se mueven siempre al inicio/fin de la línea, como en Windows y en una hoja de cálculo.

/** Nueva selección [inicio, fin] tras Inicio/Fin, o null si la tecla no aplica. */
export function seleccionTrasInicioFin(
  texto: string,
  tecla: string,
  desde: number,
  hasta: number,
  extender: boolean,
  direccion: "forward" | "backward" | "none" = "none",
): [number, number] | null {
  if (tecla !== "Home" && tecla !== "End") return null;
  const cursor = direccion === "backward" ? desde : hasta;
  const ancla = direccion === "backward" ? hasta : desde;
  const destino = tecla === "End"
    ? (() => { const i = texto.indexOf("\n", cursor); return i < 0 ? texto.length : i; })()
    : texto.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  if (!extender) return [destino, destino];
  return destino < ancla ? [destino, ancla] : [ancla, destino];
}

/** Manejador de onKeyDown para inputs y textareas: aplica Inicio/Fin y evita que desplacen el contenedor. */
export function aplicarInicioFin(e: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; currentTarget: HTMLInputElement | HTMLTextAreaElement; preventDefault: () => void }): boolean {
  if (e.metaKey || e.ctrlKey) return false;
  const el = e.currentTarget;
  const sel = seleccionTrasInicioFin(el.value, e.key, el.selectionStart ?? 0, el.selectionEnd ?? 0, e.shiftKey, el.selectionDirection ?? "none");
  if (!sel) return false;
  e.preventDefault();
  const haciaAtras = e.shiftKey && sel[0] < (el.selectionStart ?? 0);
  el.setSelectionRange(sel[0], sel[1], haciaAtras ? "backward" : "forward");
  return true;
}
