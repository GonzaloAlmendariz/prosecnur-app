// Deshacer en Codificar (etapa P3c): una pila en memoria de lo que cada paso le cambió a los códigos.
//
// Un paso guarda solo lo que tocó: qué respuestas tenía cada código antes, qué códigos creó y cuáles
// quitó. Deshacerlo devuelve eso y nada más, así que el nombre o el orden que se haya cambiado después
// se conservan. Los pasos se deshacen del último al primero.

import type { CasoMatriz, Grupo } from "../../../api/codificacion";

/** Las respuestas (y los casos por persona) que un código tenía antes del paso. */
type MiembrosDeCodigo = { id: string; respuestas: string[]; matrix_cases?: CasoMatriz[] };

export type PasoDeHistorial = {
  /** Qué se hizo, para decirlo al deshacer. */
  rotulo: string;
  miembros: MiembrosDeCodigo[];
  /** Ids de los códigos que el paso creó. */
  creados: string[];
  /** Los códigos que el paso quitó, con el lugar que ocupaban. */
  quitados: { grupo: Grupo; indice: number }[];
};

/** Pasos que se pueden deshacer. */
export const TOPE_DE_HISTORIAL = 50;

function mismosMiembros(a: Grupo, b: Grupo): boolean {
  if (a.respuestas === b.respuestas && a.matrix_cases === b.matrix_cases) return true;
  if (a.respuestas.length !== b.respuestas.length || a.respuestas.some((clave, i) => clave !== b.respuestas[i])) return false;
  const ca = a.matrix_cases ?? [];
  const cb = b.matrix_cases ?? [];
  return ca.length === cb.length && ca.every((caso, i) => caso === cb[i] || JSON.stringify(caso) === JSON.stringify(cb[i]));
}

/**
 * El paso que lleva de `antes` a `despues`, o `null` si entre los dos no cambió qué respuestas lleva
 * cada código ni qué códigos hay (un cambio de nombre o de orden no es un paso).
 */
export function pasoEntre(antes: readonly Grupo[], despues: readonly Grupo[], rotulo: string): PasoDeHistorial | null {
  const previos = new Map(antes.map((g) => [g.id, g]));
  const posteriores = new Set(despues.map((g) => g.id));
  const miembros: MiembrosDeCodigo[] = [];
  const creados: string[] = [];
  for (const g of despues) {
    const previo = previos.get(g.id);
    if (!previo) creados.push(g.id);
    else if (!mismosMiembros(previo, g)) {
      miembros.push({ id: g.id, respuestas: previo.respuestas, ...(previo.matrix_cases ? { matrix_cases: previo.matrix_cases } : {}) });
    }
  }
  const quitados = antes.flatMap((grupo, indice) => (posteriores.has(grupo.id) ? [] : [{ grupo, indice }]));
  if (miembros.length === 0 && creados.length === 0 && quitados.length === 0) return null;
  return { rotulo, miembros, creados, quitados };
}

/** Los grupos como estaban antes del paso. */
export function deshacerPaso(grupos: readonly Grupo[], paso: PasoDeHistorial): Grupo[] {
  const creados = new Set(paso.creados);
  const previos = new Map(paso.miembros.map((m) => [m.id, m]));
  const lista = grupos
    .filter((g) => !creados.has(g.id))
    .map((g) => {
      const previo = previos.get(g.id);
      if (!previo) return g;
      const { matrix_cases: _casos, ...resto } = g;
      return { ...resto, respuestas: previo.respuestas, ...(previo.matrix_cases ? { matrix_cases: previo.matrix_cases } : {}) };
    });
  // Del primero al último: cada código vuelve al lugar que ocupaba.
  for (const { grupo, indice } of [...paso.quitados].sort((a, b) => a.indice - b.indice)) {
    if (!lista.some((g) => g.id === grupo.id)) lista.splice(Math.min(indice, lista.length), 0, grupo);
  }
  return lista;
}

/** Suma un paso a la pila y olvida los más viejos por encima del tope. */
export function apilarPaso(pila: readonly PasoDeHistorial[], paso: PasoDeHistorial, tope = TOPE_DE_HISTORIAL): PasoDeHistorial[] {
  const lista = [...pila, paso];
  return lista.length > tope ? lista.slice(lista.length - tope) : lista;
}
