// Teclado de la Vista general (F6.3). Puro: traduce una tecla a una intención; el componente la ejecuta.
// Recorrido de tarjetas con foco itinerante (una sola parada de Tab para todo el clasificador):
//   ← / →        lámina anterior / siguiente en el orden del plan
//   ↑ / ↓        primera lámina del capítulo anterior / siguiente
//   Inicio / Fin primera / última lámina del informe
//   Mayús+flecha extiende la selección · Espacio agrega o quita · Ctrl/Cmd+A todo · Escape vacía la selección
//   Alt+← / Alt+↑ mueve la selección un lugar antes · Alt+→ / Alt+↓ un lugar después
//   Enter abre la lámina en Láminas · Ctrl/Cmd+D duplica · Supr / Retroceso pide confirmar y elimina

export type TeclaVistaGeneral = { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

export type IntencionTeclado =
  | { tipo: "ir"; destino: "anterior" | "siguiente" | "fila-anterior" | "fila-siguiente" | "primera" | "ultima"; extender: boolean }
  | { tipo: "mover"; dir: -1 | 1 }
  | { tipo: "alternar" }
  | { tipo: "todo" }
  | { tipo: "vaciar" }
  | { tipo: "abrir" }
  | { tipo: "duplicar" }
  | { tipo: "eliminar" };

export function intencionDeTecla(e: TeclaVistaGeneral): IntencionTeclado | null {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey && !mod) {
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") return { tipo: "mover", dir: -1 };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") return { tipo: "mover", dir: 1 };
    return null;
  }
  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "a") return { tipo: "todo" };
    if (k === "d") return { tipo: "duplicar" };
    return null;
  }
  if (e.altKey || mod) return null;
  const extender = e.shiftKey;
  switch (e.key) {
    case "ArrowLeft": return { tipo: "ir", destino: "anterior", extender };
    case "ArrowRight": return { tipo: "ir", destino: "siguiente", extender };
    case "ArrowUp": return { tipo: "ir", destino: "fila-anterior", extender };
    case "ArrowDown": return { tipo: "ir", destino: "fila-siguiente", extender };
    case "Home": return { tipo: "ir", destino: "primera", extender };
    case "End": return { tipo: "ir", destino: "ultima", extender };
    case " ": return extender ? null : { tipo: "alternar" };
    case "Enter": return extender ? null : { tipo: "abrir" };
    case "Escape": return { tipo: "vaciar" };
    case "Delete":
    case "Backspace": return extender ? null : { tipo: "eliminar" };
    default: return null;
  }
}

/** Adónde va el foco itinerante. `filas` son los ids de cada fila, en orden; una fila vacía se salta. */
export function destinoDeFoco(
  filas: readonly (readonly string[])[],
  actual: string | null,
  destino: Extract<IntencionTeclado, { tipo: "ir" }>["destino"],
): string | null {
  const orden = filas.flat();
  if (!orden.length) return null;
  const i = actual ? orden.indexOf(actual) : -1;
  if (i < 0) return orden[0];
  switch (destino) {
    case "anterior": return orden[Math.max(0, i - 1)];
    case "siguiente": return orden[Math.min(orden.length - 1, i + 1)];
    case "primera": return orden[0];
    case "ultima": return orden[orden.length - 1];
    case "fila-anterior":
    case "fila-siguiente": {
      const f = filas.findIndex((ids) => ids.includes(actual ?? ""));
      const paso = destino === "fila-anterior" ? -1 : 1;
      for (let j = f + paso; j >= 0 && j < filas.length; j += paso) {
        if (filas[j].length) return filas[j][0];
      }
      return actual;
    }
  }
}
