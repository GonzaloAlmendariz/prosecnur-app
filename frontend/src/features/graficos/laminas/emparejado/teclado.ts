// El teclado de «Revisar emparejado» (X6): J y K cambian de fila, Enter confirma la sugerencia de la fila activa y X la
// quita (descarta una sugerencia o quita de la lámina un par confirmado). Nada de eso actúa mientras se escribe en un
// campo o se elige en el buscador del par, y Enter sobre un botón sigue siendo del botón.

export type AccionTecla = "siguiente" | "anterior" | "confirmar" | "quitar";

export const ATAJO: Record<AccionTecla, string> = {
  siguiente: "J",
  anterior: "K",
  confirmar: "Enter",
  quitar: "X",
};

export type TeclaPulsada = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
};

/** Un campo donde se escribe o se elige: sus teclas son suyas. */
export function esCampo(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  return !!el.closest("[role='combobox'], [role='listbox'], [role='option'], [role='textbox'], .pulso-f6-emp-buscar");
}

/** Un control que ya hace algo con Enter. */
function activaConEnter(el: Element | null): boolean {
  return !!el?.closest("button, a[href], summary, [role='button'], [role='radio'], [role='tab'], [role='menuitem']");
}

export function accionDeTecla(e: TeclaPulsada, objetivo: Element | null): AccionTecla | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing || esCampo(objetivo)) return null;
  const k = e.key.toLowerCase();
  if (k === "j") return "siguiente";
  if (k === "k") return "anterior";
  if (k === "x") return "quitar";
  if (e.key === "Enter" && !activaConEnter(objetivo)) return "confirmar";
  return null;
}

/** La fila a la que lleva J (paso 1) o K (paso -1); sin fila activa, J va a la primera y K a la última. Se detiene en los bordes. */
export function filaVecina(claves: readonly string[], activa: string | null, paso: 1 | -1): string | null {
  if (!claves.length) return null;
  const i = activa === null ? -1 : claves.indexOf(activa);
  if (i < 0) return paso === 1 ? claves[0] : claves[claves.length - 1];
  return claves[Math.min(claves.length - 1, Math.max(0, i + paso))];
}
