// Los puntos de un Recuadro o de una Lista como filas que se agregan, quitan y
// reordenan (ítem 3 de docs/qa/checklist-inspector-correo-2026-10-23.md).
//
// El bloque guarda lo de siempre: `items`, un arreglo de textos, cada uno con
// contenido (el backend rechaza un punto vacío). Las filas son el borrador de
// la vista: una fila recién creada está vacía hasta que se escribe en ella, y
// no llega al bloque mientras lo esté. Todo aquí es puro.

/** Una fila del editor: su id estable (la llave de React) y lo escrito. */
export type FilaDePunto = { id: string; texto: string };

/** Lo que el modelo no impone y la vista sí: al menos un punto, como mucho diez. */
export const MIN_PUNTOS = 1;
export const MAX_PUNTOS = 10;

/** El resultado de una acción: las filas nuevas y a qué fila va el foco. */
export type Paso = { filas: FilaDePunto[]; foco: { id: string; alFinal: boolean } | null };

export type CrearId = () => string;

/** Lo que llega al bloque: lo escrito sin bordes, sin las filas vacías. */
export function puntosDe(filas: readonly FilaDePunto[]): string[] {
  return filas.map((f) => f.texto.trim()).filter(Boolean);
}

/** Las filas para los puntos del bloque; sin puntos, una fila vacía. */
export function filasDe(items: readonly string[], crearId: CrearId): FilaDePunto[] {
  const filas = items.map((texto) => ({ id: crearId(), texto }));
  return filas.length ? filas : [{ id: crearId(), texto: "" }];
}

export function puedeAgregar(filas: readonly FilaDePunto[]): boolean {
  return filas.length < MAX_PUNTOS;
}

export function puedeQuitar(filas: readonly FilaDePunto[]): boolean {
  return filas.length > MIN_PUNTOS;
}

export function puedeMover(filas: readonly FilaDePunto[], indice: number, delta: -1 | 1): boolean {
  const destino = indice + delta;
  return indice >= 0 && indice < filas.length && destino >= 0 && destino < filas.length;
}

/** Una fila vacía debajo de `indice` (al final con `indice` fuera de rango), con el foco. */
export function agregar(filas: readonly FilaDePunto[], indice: number, crearId: CrearId): Paso | null {
  if (!puedeAgregar(filas)) return null;
  const en = indice >= 0 && indice < filas.length ? indice + 1 : filas.length;
  const nueva = { id: crearId(), texto: "" };
  return { filas: [...filas.slice(0, en), nueva, ...filas.slice(en)], foco: { id: nueva.id, alFinal: true } };
}

/** Quita la fila; el foco va a la anterior (o a la que queda primera), al final de su texto. */
export function quitar(filas: readonly FilaDePunto[], indice: number): Paso | null {
  if (!puedeQuitar(filas) || indice < 0 || indice >= filas.length) return null;
  const resto = filas.filter((_, i) => i !== indice);
  const vecina = resto[Math.max(0, indice - 1)];
  return { filas: resto, foco: vecina ? { id: vecina.id, alFinal: true } : null };
}

/** Sube o baja la fila un lugar; el foco se queda con ella. */
export function mover(filas: readonly FilaDePunto[], indice: number, delta: -1 | 1): Paso | null {
  if (!puedeMover(filas, indice, delta)) return null;
  const out = [...filas];
  const [fila] = out.splice(indice, 1);
  out.splice(indice + delta, 0, fila);
  return { filas: out, foco: { id: fila.id, alFinal: true } };
}

export function conTextoDeFila(filas: readonly FilaDePunto[], indice: number, texto: string): FilaDePunto[] {
  return filas.map((f, i) => (i === indice ? { ...f, texto } : f));
}

/** Enter dentro de un punto: el siguiente, vacío, debajo. */
export function alPulsarEnter(filas: readonly FilaDePunto[], indice: number, crearId: CrearId): Paso | null {
  return agregar(filas, indice, crearId);
}

/** Backspace en un punto vacío lo borra; con texto, o si es el único, no hace nada. */
export function alBorrarVacio(filas: readonly FilaDePunto[], indice: number): Paso | null {
  const fila = filas[indice];
  if (!fila || fila.texto.trim() !== "") return null;
  return quitar(filas, indice);
}

/**
 * Dónde está el cursor de una fila en el texto de la propiedad tal como lo
 * lee «Campos de cada persona» (`textoDe`: los puntos unidos por saltos de
 * línea). Una fila vacía no está en ese texto: su cursor es el final del punto
 * anterior, y `reconciliar` devuelve a la fila lo que se inserte ahí.
 */
export function cursorEnLosPuntos(filas: readonly FilaDePunto[], indice: number, cursor: number | null): number | null {
  if (cursor === null || indice < 0 || indice >= filas.length) return null;
  let antes = 0;
  let previos = 0;
  for (let i = 0; i < indice; i += 1) {
    const t = filas[i].texto.trim();
    if (!t) continue;
    antes += t.length;
    previos += 1;
  }
  const separadores = Math.max(0, previos - 1);
  const fila = filas[indice].texto;
  const recortado = fila.trim();
  if (!recortado) return antes + separadores;
  const inicio = fila.length - fila.trimStart().length;
  const dentro = Math.max(0, Math.min(cursor - inicio, recortado.length));
  return antes + previos + dentro;
}

/** La fila vacía donde se pidió un campo, con el texto de los puntos de ese momento. */
export type Pendiente = { filaId: string; base: string; desplazamiento: number };

export type Reconciliado = {
  filas: FilaDePunto[];
  /** Los puntos corregidos que hay que escribir de vuelta en el bloque, si los hay. */
  corregidos: string[] | null;
};

function iguales(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Los puntos del bloque cambiaron por fuera (deshacer, un campo insertado
 * desde la columna). Si es lo que ya dicen las filas, se quedan como están,
 * con sus vacías. Si es un campo insertado para una fila vacía, el campo va a
 * esa fila y los puntos se corrigen. Si cambia el texto de los mismos puntos,
 * se actualizan en su lugar. Si no, las filas se rehacen.
 */
export function reconciliar(
  filas: readonly FilaDePunto[],
  items: readonly string[],
  pendiente: Pendiente | null,
  crearId: CrearId,
): Reconciliado {
  const propios = puntosDe(filas);
  if (iguales(propios, items)) return { filas: [...filas], corregidos: null };

  const destino = pendiente ? filas.findIndex((f) => f.id === pendiente.filaId && !f.texto.trim()) : -1;
  if (pendiente && destino >= 0 && pendiente.base === propios.join("\n")) {
    const nuevo = items.join("\n");
    const { base, desplazamiento } = pendiente;
    const largo = nuevo.length - base.length;
    const insertado = largo > 0 ? nuevo.slice(desplazamiento, desplazamiento + largo) : "";
    if (
      insertado
      && !insertado.includes("\n")
      && nuevo.slice(0, desplazamiento) === base.slice(0, desplazamiento)
      && nuevo.slice(desplazamiento + largo) === base.slice(desplazamiento)
    ) {
      const corregidas = conTextoDeFila(filas, destino, insertado.trim());
      return { filas: corregidas, corregidos: puntosDe(corregidas) };
    }
  }

  if (items.length === propios.length) {
    let j = 0;
    const enSuLugar = filas.map((f) => (f.texto.trim() ? { ...f, texto: items[j++] } : f));
    return { filas: enSuLugar, corregidos: null };
  }

  // Se reusan los ids por posición: las filas que siguen en su sitio no se remontan.
  const nuevas = items.map((texto, i) => ({ id: filas[i]?.id ?? crearId(), texto }));
  return { filas: nuevas.length ? nuevas : filasDe([], crearId), corregidos: null };
}
