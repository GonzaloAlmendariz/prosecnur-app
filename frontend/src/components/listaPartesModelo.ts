// Lógica pura de `ListaPartes`: el recorrido por teclado y la reserva del slot de estado. Vive aparte del
// componente para probarse sin DOM (este repo renderiza los tests con `renderToStaticMarkup`).

export type TonoEstadoParte = "neutro" | "aviso" | "listo" | "conteo";

/**
 * Estado de una parte, con UNA gramática para toda la app:
 *  - `neutro`: palabra en gris («Por defecto»).
 *  - `aviso`: palabra en ámbar («5 sin colores»).
 *  - `listo`: un check discreto; `texto` es su nombre accesible («Listo»).
 *  - `conteo`: un número tabular («27»).
 */
export type EstadoParte = {
  tono: TonoEstadoParte;
  texto: string;
};

export type ParteDeLista<K extends string = string> = {
  clave: K;
  rotulo: string;
  /** Una línea; se trunca con elipsis y el `title` lleva el texto completo. */
  detalle?: string;
  estado?: EstadoParte;
};

export type GrupoDePartes<K extends string = string> = {
  id: string;
  /** Encabezado en versalitas pequeñas; sin título, el grupo no pinta cabecera. */
  titulo?: string;
  /** Grupo plegable (p. ej. «Preguntas sueltas con escala (N)»): cerrado salvo que se pida abierto. */
  plegable?: { abiertoInicial?: boolean };
  partes: readonly ParteDeLista<K>[];
};

/** Si una sola parte lleva estado, el slot se reserva en todas para que las filas alineen. */
export function reservaSlotDeEstado(grupos: readonly GrupoDePartes[]): boolean {
  return grupos.some((g) => g.partes.some((p) => Boolean(p.estado)));
}

/**
 * Ancho del slot: si los estados son sólo números o checks, basta uno angosto; con palabras («Por defecto»,
 * «5 sin colores») el slot es ancho para que la palabra no se trunque ni empuje al rótulo.
 */
export function anchoDeSlot(grupos: readonly GrupoDePartes[]): "angosto" | "ancho" {
  const tonos = grupos.flatMap((g) => g.partes.flatMap((p) => (p.estado ? [p.estado.tono] : [])));
  return tonos.every((t) => t === "conteo" || t === "listo") ? "angosto" : "ancho";
}

/** Las partes visibles, en orden: las de un grupo plegado cerrado no se recorren con el teclado. */
export function partesNavegables<K extends string>(
  grupos: readonly GrupoDePartes<K>[],
  abierto: (grupo: GrupoDePartes<K>) => boolean,
): K[] {
  return grupos.flatMap((g) => (g.plegable && !abierto(g) ? [] : g.partes.map((p) => p.clave)));
}

/**
 * Destino de una tecla dentro de la lista. `null` = la tecla no es de la lista (se deja pasar).
 * Flechas arriba/abajo recorren con vuelta; Inicio/Fin van a los extremos.
 */
export function destinoDeTecla<K extends string>(tecla: string, claves: readonly K[], actual: K | null): K | null {
  if (claves.length === 0) return null;
  const i = actual === null ? -1 : claves.indexOf(actual);
  switch (tecla) {
    case "ArrowDown":
      return claves[(i + 1 + claves.length) % claves.length];
    case "ArrowUp":
      return claves[i <= 0 ? claves.length - 1 : i - 1];
    case "Home":
      return claves[0];
    case "End":
      return claves[claves.length - 1];
    default:
      return null;
  }
}

/** Nombre accesible de una fila: rótulo, detalle y estado, en ese orden. */
export function nombreAccesibleDeParte(parte: ParteDeLista): string {
  return [parte.rotulo, parte.detalle, parte.estado?.texto].filter(Boolean).join(". ");
}
