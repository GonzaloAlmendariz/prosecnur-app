// Atajos de teclado del lienzo (ADR 0047).
//
// El spec exige que el lienzo se opere sin ratón: crear, navegar, editar y
// eliminar. Es también la razón de que los nodos sean DOM y no SVG.
//
// La resolución es una función PURA que traduce una tecla a una acción. El
// componente ejecuta; esto decide. Es lo único testeable sin DOM.

export type AccionAtajo =
  | { tipo: "nuevo" }
  | { tipo: "editar" }
  | { tipo: "salir" }
  | { tipo: "borrar" }
  | { tipo: "deshacer" }
  | { tipo: "rehacer" }
  | { tipo: "foco"; paso: 1 | -1 }
  | { tipo: "navegar"; direccion: "arriba" | "abajo" | "izquierda" | "derecha" }
  | { tipo: "mover"; dx: number; dy: number }
  | { tipo: "conectar"; direccion: "arriba" | "abajo" | "izquierda" | "derecha" }
  | { tipo: "ir-a-contenido" }
  | { tipo: "zoom-100" }
  | { tipo: "seleccionar-todo" }
  | null;

export type EventoTecla = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type ContextoAtajo = {
  /** Se está escribiendo dentro de un nodo: casi todo se le cede al textarea. */
  editando: boolean;
  /** Hay un nodo con foco de teclado. */
  hayFoco: boolean;
  /** El modo "conectar" está armado esperando una dirección. */
  armandoConexion: boolean;
};

const DIRECCIONES: Record<string, "arriba" | "abajo" | "izquierda" | "derecha"> = {
  ArrowUp: "arriba",
  ArrowDown: "abajo",
  ArrowLeft: "izquierda",
  ArrowRight: "derecha",
};

/** Paso de movimiento con flechas: la grilla, o un píxel con Alt para afinar. */
const PASO_GRILLA = 16;

export function resolverAtajo(evento: EventoTecla, ctx: ContextoAtajo): AccionAtajo {
  const mod = evento.metaKey || evento.ctrlKey;

  // Editando, el textarea manda. Solo Escape sale: sin esa salida, entrar a
  // escribir sería una trampa para quien navega con teclado.
  if (ctx.editando) {
    return evento.key === "Escape" ? { tipo: "salir" } : null;
  }

  if (mod && evento.key.toLowerCase() === "z") {
    return evento.shiftKey ? { tipo: "rehacer" } : { tipo: "deshacer" };
  }
  if (mod && evento.key.toLowerCase() === "y") return { tipo: "rehacer" };
  if (mod && evento.key.toLowerCase() === "a") return { tipo: "seleccionar-todo" };
  if (mod && evento.key === "0") return { tipo: "ir-a-contenido" };
  if (mod && evento.key === "1") return { tipo: "zoom-100" };

  // Con la conexión armada, la flecha elige destino en vez de mover.
  if (ctx.armandoConexion && DIRECCIONES[evento.key]) {
    return { tipo: "conectar", direccion: DIRECCIONES[evento.key] };
  }

  if (evento.key === "Tab") return { tipo: "foco", paso: evento.shiftKey ? -1 : 1 };
  if (evento.key === "Escape") return { tipo: "salir" };

  if (!ctx.hayFoco) {
    // Sin foco, `n` sigue creando: es la forma de empezar sin tocar el ratón.
    if (evento.key.toLowerCase() === "n") return { tipo: "nuevo" };
    return null;
  }

  if (evento.key === "Enter") return { tipo: "editar" };
  if (evento.key === "Delete" || evento.key === "Backspace") return { tipo: "borrar" };
  if (evento.key.toLowerCase() === "n") return { tipo: "nuevo" };
  if (evento.key.toLowerCase() === "c") return { tipo: "conectar", direccion: "derecha" };

  const direccion = DIRECCIONES[evento.key];
  if (direccion) {
    // Shift MUEVE el nodo; sin Shift navega entre nodos. Alt afina a un píxel.
    if (evento.shiftKey) {
      const paso = evento.altKey ? 1 : PASO_GRILLA;
      const dx = direccion === "derecha" ? paso : direccion === "izquierda" ? -paso : 0;
      const dy = direccion === "abajo" ? paso : direccion === "arriba" ? -paso : 0;
      return { tipo: "mover", dx, dy };
    }
    return { tipo: "navegar", direccion };
  }

  return null;
}

/** El evento no debe llegar al lienzo si el foco está en un campo de texto. */
export function escribiendoEnCampo(destino: EventTarget | null): boolean {
  const el = destino as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
