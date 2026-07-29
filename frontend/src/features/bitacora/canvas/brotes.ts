// Brotes: las ramas que un cuadro puede desplegar en el propio lienzo (ADR 0047).
//
// Un cuadro que referencia una pieza de la app sabe qué cuelga de él —el árbol
// está en `lib/modules.ts`—, así que puede ofrecer sus ramas ahí mismo en vez de
// obligar a volver al explorador, buscar la pieza otra vez y volver a insertar.
// Es el gesto de un mapa mental: tiras del nodo y salen sus hijos.
//
// Puro y sin React: dónde nace cada brote y cuáles se ofrecen se decide acá, y
// el componente solo lo pinta. Vitest corre en Node sin DOM.

import { resolverDestino, type NodoApp } from "../arbolDeLaApp";
import type { CanvasNodo } from "../../../api/bitacora";
import { altoDeNodo, ANCHO_NODO } from "./ramificacion";

/** Separación entre el cuadro y la columna de brotes. */
const SALTO_X = 288;
/** Alto de un brote plegado, más su aire. */
export const ALTO_BROTE = 34;
const AIRE_BROTE = 8;

export type Brote = {
  /** Clave del destino en el árbol de la app. */
  clave: string;
  label: string;
  nivel: NodoApp["nivel"];
  /** Dónde se dibuja el brote, que es DONDE NACERÁ el nodo si lo eligen. */
  x: number;
  y: number;
};

/**
 * Ramas que este cuadro puede desplegar todavía.
 *
 * Excluye las que ya están en el lienzo: ofrecer una rama que ya existe la
 * duplicaría, y un mapa con dos «Validación» apuntando al mismo sitio no dice
 * dos cosas distintas, dice que la herramienta falló.
 */
export function brotesDe(nodo: CanvasNodo, enLienzo: CanvasNodo[]): Brote[] {
  if (nodo.ref?.target_type !== "modulo") return [];
  const rama = resolverDestino(nodo.ref.target_id);
  if (!rama?.hijos.length) return [];

  const yaPuestos = new Set(
    enLienzo
      .filter((n) => n.ref?.target_type === "modulo")
      .map((n) => n.ref!.target_id),
  );
  const libres = rama.hijos.filter((h) => !yaPuestos.has(h.clave));
  if (!libres.length) return [];

  const columna = nodo.x + SALTO_X;
  const ocupadas = cajasEnColumna(columna, enLienzo);
  const altoFuturo = altoDeNodo("modulo", 0);

  // El abanico arranca centrado frente al cuadro que lo abre y baja desde ahí.
  const alto = libres.length * ALTO_BROTE + (libres.length - 1) * AIRE_BROTE;
  let cursor = nodo.y + nodo.h / 2 - alto / 2;

  return libres.map((hijo) => {
    // Cada brote reserva el alto de la TARJETA que va a crear, no el suyo: si
    // solo reservara sus 34 px, la tarjeta de 102 nacería encima de los brotes
    // que quedan debajo. Y esquiva lo que ya ocupa la columna, para no nacer
    // sobre una rama que se abrió antes.
    const y = primerHuecoLibre(cursor, altoFuturo, ocupadas);
    ocupadas.push({ y, h: altoFuturo });
    cursor = y + ALTO_BROTE + AIRE_BROTE;
    return { clave: hijo.clave, label: hijo.label, nivel: hijo.nivel, x: columna, y };
  });
}

type Caja = { y: number; h: number };

function cajasEnColumna(x: number, nodos: CanvasNodo[]): Caja[] {
  return nodos
    .filter((n) => Math.abs(n.x - x) < ANCHO_NODO / 2)
    .map((n) => ({ y: n.y, h: n.h }));
}

/**
 * Primer tramo de `alto` libre desde `desdeY` hacia abajo.
 *
 * Baja en vez de buscar el hueco más cercano en cualquier dirección: subir
 * metería ramas nuevas por encima de las que ya se abrieron y el orden del mapa
 * dejaría de corresponder al orden en que se fue construyendo.
 */
function primerHuecoLibre(desdeY: number, alto: number, ocupadas: Caja[]): number {
  let y = desdeY;
  let seguro = 0;
  while (seguro++ < 200) {
    const choque = ocupadas.find((c) => y < c.y + c.h + AIRE_BROTE && y + alto + AIRE_BROTE > c.y);
    if (!choque) return y;
    y = choque.y + choque.h + AIRE_BROTE;
  }
  return y;
}


/**
 * Dónde queda el nodo que nace de un brote.
 *
 * En el sitio del brote, sin corrimientos: el brote ya reservó el alto de esta
 * tarjeta y ya esquivó lo ocupado, así que aquí no hay nada que recolocar. Que
 * las dos posiciones coincidan es además lo que hace que la animación se lea
 * como que el brote SE CONVIRTIÓ en tarjeta, y no como que aparece otra cosa
 * en otro lado.
 */
export function posicionDelNodo(brote: Brote): { x: number; y: number; w: number; h: number } {
  return { x: brote.x, y: brote.y, w: ANCHO_NODO, h: altoDeNodo("modulo", 0) };
}
