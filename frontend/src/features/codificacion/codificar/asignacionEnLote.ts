// Asignar, quitar y crear códigos para varias respuestas a la vez (etapa P3c de Codificar).
//
// La regla de una asignación es la de `tabla/asignacionCodigos.ts` (`asignarCodigo`, `quitarCodigo`):
// aquí solo se repite para cada respuesta del lote. Quien llama decide si la pregunta admite varios
// códigos por respuesta (`permiteVarios`).

import type { Grupo } from "../../../api/codificacion";
import { asignarCodigo, quitarCodigo } from "../tabla/asignacionCodigos";

/** Lleva cada respuesta de `claves` al código `grupoId`: con `permiteVarios` lo suma; si no, la mueve. */
export function asignarVarias(
  grupos: readonly Grupo[],
  claves: readonly string[],
  grupoId: string,
  permiteVarios: boolean,
): Grupo[] {
  return claves.reduce<Grupo[]>((lista, clave) => asignarCodigo(lista, clave, grupoId, permiteVarios), grupos as Grupo[]);
}

/**
 * Quita a cada respuesta su último código (el del grupo que va más abajo en el libro). Una respuesta sin
 * código queda igual. Es la misma regla que Retroceso en la vista de tabla.
 */
export function quitarUltimoCodigo(grupos: readonly Grupo[], claves: readonly string[]): Grupo[] {
  return claves.reduce<Grupo[]>((lista, clave) => {
    const ultimo = [...lista].reverse().find((g) => g.respuestas.includes(clave));
    return ultimo ? quitarCodigo(lista, clave, ultimo.id) : lista;
  }, grupos as Grupo[]);
}

/** Cuántas de las respuestas tienen algún código. */
export function conCodigo(grupos: readonly Grupo[], claves: readonly string[]): number {
  const asignadas = new Set(grupos.flatMap((g) => g.respuestas));
  return claves.filter((clave) => asignadas.has(clave)).length;
}

/**
 * El número del siguiente código. Los de 70 en adelante son convenciones (Otros 70, No sabe 88, No aplica
 * 99): un código nuevo sigue al mayor de los que están por debajo. Si todos son convencionales, al mayor.
 */
export function siguienteCodigo(grupos: readonly Grupo[]): string {
  const numeros = grupos.map((g) => Number.parseInt(g.codigo, 10)).filter((n) => !Number.isNaN(n));
  if (numeros.length === 0) return "1";
  const propios = numeros.filter((n) => n < 70);
  return String(Math.max(...(propios.length > 0 ? propios : numeros)) + 1);
}

/**
 * Crea un código con ese nombre al final del libro y le asigna las respuestas. `id` lo pone quien llama,
 * que es quien puede generar uno único.
 */
export function crearCodigoCon(
  grupos: readonly Grupo[],
  claves: readonly string[],
  nombre: string,
  permiteVarios: boolean,
  id: string,
): { grupos: Grupo[]; creado: Grupo } {
  const creado: Grupo = { id, codigo: siguienteCodigo(grupos), etiqueta: nombre.replace(/\s+/g, " ").trim(), respuestas: [], origen: "nuevo" };
  const lista = asignarVarias([...grupos, creado], claves, id, permiteVarios);
  return { grupos: lista, creado: lista.find((g) => g.id === id) ?? creado };
}

export type DestinoDeSuelta = { tipo: "codigo"; grupoId: string } | { tipo: "nuevo" };

const PREFIJO_CODIGO = "codigo:";
/** Id de la zona donde se suelta para crear un código. */
export const ZONA_CODIGO_NUEVO = "codigo-nuevo";

/** Id de la zona de un código, para el arrastre. */
export function zonaDeCodigo(grupoId: string): string {
  return `${PREFIJO_CODIGO}${grupoId}`;
}

/** Sobre qué se soltó: la tarjeta de un código, la de crear uno, o nada. */
export function destinoDeSuelta(zona: string | number | null | undefined): DestinoDeSuelta | null {
  if (typeof zona !== "string") return null;
  if (zona === ZONA_CODIGO_NUEVO) return { tipo: "nuevo" };
  return zona.startsWith(PREFIJO_CODIGO) ? { tipo: "codigo", grupoId: zona.slice(PREFIJO_CODIGO.length) } : null;
}
