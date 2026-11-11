// Teclado de la lista de respuestas en la vista de tarjetas de Codificar (etapa P3c). Puro.
//
// Con una o varias respuestas elegidas, escribir el número de un código las asigna. Un número de una
// cifra que además es el comienzo de otro (el 1 cuando existe el 12) espera un momento la segunda
// cifra; Enter lo asigna sin esperar. Un número que ningún código empieza no hace nada.

/** Lo que se espera la segunda cifra de un código antes de asignar el de una sola. */
export const ESPERA_DE_SEGUNDA_CIFRA_MS = 700;

export type CodigoTecleable = { id: string; codigo: string };

export type ResolucionDeCodigo =
  /** Lo escrito es un código y no puede ser otro: se asigna. */
  | { tipo: "asignar"; grupoId: string }
  /** Puede faltar una cifra. `grupoId` es el código que ya coincide, si lo hay: es el que se asigna al vencer la espera. */
  | { tipo: "esperar"; grupoId: string | null }
  | { tipo: "ninguno" };

/** El número de un código como se teclea: sin espacios ni ceros a la izquierda. `null` si no es un número. */
function numeroDe(codigo: string): string | null {
  const limpio = (codigo ?? "").trim();
  return /^\d+$/.test(limpio) ? String(Number.parseInt(limpio, 10)) : null;
}

/**
 * Qué hacer con las cifras escritas hasta ahora. Con `confirmar` (Enter, o la espera vencida) no se
 * aguarda más: se asigna el código que coincide o no se hace nada.
 */
export function resolverCodigoTecleado(
  cifras: string,
  codigos: readonly CodigoTecleable[],
  confirmar = false,
): ResolucionDeCodigo {
  const escrito = numeroDe(cifras);
  if (escrito === null) return { tipo: "ninguno" };
  const numeros = codigos.map((c) => ({ id: c.id, numero: numeroDe(c.codigo) }));
  const exacto = numeros.find((c) => c.numero === escrito) ?? null;
  // Un cero suelto no empieza ningún número: "0" solo puede ser el código 0.
  const puedeSeguir = escrito !== "0" && numeros.some((c) => c.numero !== null && c.numero !== escrito && c.numero.startsWith(escrito));
  if (confirmar || !puedeSeguir) return exacto ? { tipo: "asignar", grupoId: exacto.id } : { tipo: "ninguno" };
  return { tipo: "esperar", grupoId: exacto?.id ?? null };
}

export type TeclaDeLista = {
  key: string;
  /** Tecla física: distingue las cifras aunque Mayús cambie el carácter. */
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  /** Cmd en macOS, Ctrl en Windows. */
  modificador: boolean;
  repeat?: boolean;
};

export type IntencionDeLista =
  /** Una cifra del número de un código. `quedarse` (Mayús) deja la selección en las mismas respuestas. */
  | { tipo: "cifra"; cifra: string; quedarse: boolean }
  | { tipo: "confirmar-cifras" }
  | { tipo: "descartar-cifras" }
  | { tipo: "mover"; destino: 1 | -1 | "inicio" | "fin"; extender: boolean }
  /** Suma o quita de la selección la respuesta que tiene el foco. */
  | { tipo: "alternar" }
  | { tipo: "abrir-lista" }
  | { tipo: "quitar-codigo" }
  | { tipo: "soltar" }
  | { tipo: "todo" };

const CIFRA = /^(?:Digit|Numpad)(\d)$/;

/** Qué pide una tecla en la lista de respuestas. `null` deja la tecla al navegador. */
export function intencionDeLista(tecla: TeclaDeLista, ctx: { cifras: string; seleccionadas: number }): IntencionDeLista | null {
  if (tecla.modificador) {
    return tecla.key.toLowerCase() === "a" && !tecla.altKey ? { tipo: "todo" } : null;
  }
  if (tecla.altKey) return null;
  const cifra = CIFRA.exec(tecla.code)?.[1] ?? (/^\d$/.test(tecla.key) ? tecla.key : null);
  if (cifra !== null) return ctx.seleccionadas > 0 ? { tipo: "cifra", cifra, quedarse: tecla.shiftKey } : null;
  switch (tecla.key) {
    case "ArrowDown":
      return { tipo: "mover", destino: 1, extender: tecla.shiftKey };
    case "ArrowUp":
      return { tipo: "mover", destino: -1, extender: tecla.shiftKey };
    case "Home":
      return { tipo: "mover", destino: "inicio", extender: tecla.shiftKey };
    case "End":
      return { tipo: "mover", destino: "fin", extender: tecla.shiftKey };
    case " ":
      return { tipo: "alternar" };
    case "Enter":
      if (ctx.cifras) return { tipo: "confirmar-cifras" };
      return ctx.seleccionadas > 0 ? { tipo: "abrir-lista" } : null;
    case "Escape":
      if (ctx.cifras) return { tipo: "descartar-cifras" };
      return ctx.seleccionadas > 0 ? { tipo: "soltar" } : null;
    case "Backspace":
      if (ctx.cifras) return { tipo: "descartar-cifras" };
      return ctx.seleccionadas > 0 && !tecla.repeat ? { tipo: "quitar-codigo" } : null;
    case "Delete":
      return ctx.seleccionadas > 0 && !tecla.repeat ? { tipo: "quitar-codigo" } : null;
    default:
      return null;
  }
}
