// Qué número va en la barra divergente de una escala según la lectura elegida
// (ítem 39 del checklist del practicante). Una sola función decide la cifra
// del resumen de cada lado y la de cada tramo: con "Casos" el conteo, con
// "Porcentaje" el porcentaje. Puro, sin React.

import type { ExploradorDistFila } from "../../../../api/validacionExplorar";
import { fmtDecimal, fmtN, fmtPct, type Divergente, type LadoResumido } from "./explorarModelo";
import type { LecturaDeDistribucion } from "./lecturaDeDistribucion";

type Valor = LecturaDeDistribucion["valor"];

/** La cifra de un lado: la fuerte y, con casos, el porcentaje entre paréntesis ("354" y "(35.5 %)"). */
export type CifraDelResumen = { fuerte: string; aparte: string | null };

export function cifraDelResumen(lado: Pick<LadoResumido, "n" | "pct">, valor: Valor): CifraDelResumen {
  return valor === "casos"
    ? { fuerte: fmtN(lado.n), aparte: `(${fmtDecimal(lado.pct, 1)} %)` }
    : { fuerte: fmtPct(lado.pct), aparte: null };
}

/** La cifra de un tramo de la barra: el conteo con casos, el porcentaje redondeado si no. */
export function cifraDelTramo(fila: Pick<ExploradorDistFila, "n" | "pct">, valor: Valor): string {
  return valor === "casos" ? fmtN(fila.n) : `${Math.round(fila.pct)}%`;
}

/**
 * Si la cifra entra en su tramo. Se mide contra la barra más angosta de la
 * matriz (unos 350 px, 3.5 px por punto) con 7 px por carácter y 8 de aire.
 */
export function cabeEnElTramo(texto: string, pct: number): boolean {
  return pct * 3.5 >= texto.length * 7 + 8;
}

export type TramoLeido = {
  fila: ExploradorDistFila;
  /** La cifra del tramo según la lectura. */
  cifra: string;
  /** Si va dentro del tramo; si no, la leyenda la lleva junto a la opción. */
  dentro: boolean;
};

/** Cada tramo con su cifra y dónde va: dentro si cabe, en la leyenda si no; nunca se pierde. */
export function tramosLeidos(filas: readonly ExploradorDistFila[], valor: Valor): TramoLeido[] {
  return filas.map((fila) => {
    const cifra = cifraDelTramo(fila, valor);
    return { fila, cifra, dentro: cabeEnElTramo(cifra, fila.pct) };
  });
}

/** El resumen de los lados de la escala con la cifra de cada uno. */
export function resumenDeLaDivergente(div: Divergente, valor: Valor) {
  const lado = (l: LadoResumido) => ({ etiqueta: l.etiqueta, ...cifraDelResumen(l, valor) });
  return {
    baja: lado(div.baja),
    centro: div.centro ? lado(div.centro) : null,
    alta: lado(div.alta),
  };
}

/** Lo que dice un tramo al pasar el mouse o enfocarlo: "Muy interesado/a: 55 casos (5.5 %)". */
export function textoDelTramo(fila: Pick<ExploradorDistFila, "etiqueta" | "n" | "pct">): string {
  return `${fila.etiqueta}: ${fmtN(fila.n)} ${fila.n === 1 ? "caso" : "casos"} (${fmtDecimal(fila.pct, 1)} %)`;
}
