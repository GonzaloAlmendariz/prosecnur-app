/**
 * El balance de cruce: cuántos casos cruzaron, cuántos no, y de esos cuántos
 * se pueden recuperar.
 *
 * "Cruces definitivos" mostraba 160 filas planas con cinco columnas densas y
 * una cabecera que solo decía el total ("1,277 casos explicados"). Cada fila ya
 * traía su razón, pero sin un balance arriba ni grupos abajo no había por dónde
 * empezar. Este modelo da las dos cosas, y usa la misma escala de
 * recuperabilidad que la bandeja de Subsanación para que las pestañas hermanas
 * no se contradigan.
 */

import type { PrioridadDeCaso } from "./motivoDeNoCruce";

export type GrupoDeCruce = "cruzaron" | "recuperables" | "por-revisar" | "explicados";

export type BalanceDeCruce = {
  total: number;
  cruzaron: number;
  sinCruce: number;
  recuperables: number;
  porRevisar: number;
  explicados: number;
};

export type CasoDeCruce = {
  cruzo: boolean;
  prioridad: PrioridadDeCaso;
};

const GRUPO_POR_PRIORIDAD: Record<PrioridadDeCaso, GrupoDeCruce> = {
  recuperable: "recuperables",
  revisable: "por-revisar",
  esperable: "explicados",
};

export function grupoDeCruce(caso: CasoDeCruce): GrupoDeCruce {
  return caso.cruzo ? "cruzaron" : GRUPO_POR_PRIORIDAD[caso.prioridad];
}

export function balanceDeCruce(casos: CasoDeCruce[]): BalanceDeCruce {
  const balance: BalanceDeCruce = {
    total: casos.length,
    cruzaron: 0,
    sinCruce: 0,
    recuperables: 0,
    porRevisar: 0,
    explicados: 0,
  };
  casos.forEach((caso) => {
    const grupo = grupoDeCruce(caso);
    if (grupo === "cruzaron") {
      balance.cruzaron += 1;
      return;
    }
    balance.sinCruce += 1;
    if (grupo === "recuperables") balance.recuperables += 1;
    else if (grupo === "por-revisar") balance.porRevisar += 1;
    else balance.explicados += 1;
  });
  return balance;
}

/**
 * La lectura de la pestaña, en una frase. Dice el balance y, cuando hay algo
 * que rescatar, lo nombra: es la única cifra sobre la que se puede actuar.
 */
export function lecturaDeCruce(balance: BalanceDeCruce) {
  const n = (valor: number) => valor.toLocaleString("es-PE");
  if (!balance.total) return "Sin registros para los filtros activos.";
  if (!balance.sinCruce) return `${n(balance.cruzaron)} de ${n(balance.total)} cruzaron con la base.`;
  const cabeza = `${n(balance.cruzaron)} de ${n(balance.total)} cruzaron; ${n(balance.sinCruce)} no.`;
  if (!balance.recuperables) return `${cabeza} Ninguno de los no cruces suma si se resuelve.`;
  return `${cabeza} ${n(balance.recuperables)} son recuperables.`;
}

export const GRUPOS_DE_CRUCE: {
  grupo: GrupoDeCruce;
  titulo: string;
  detalle: string;
}[] = [
  { grupo: "recuperables", titulo: "No cruzaron · recuperables", detalle: "completas: solo les falta el vínculo" },
  { grupo: "por-revisar", titulo: "No cruzaron · por revisar", detalle: "falta un dato que el canal debía traer" },
  { grupo: "explicados", titulo: "No cruzaron · explicados por el canal", detalle: "resolverlos no suma efectivas" },
  { grupo: "cruzaron", titulo: "Cruzaron con la base", detalle: "ya están vinculados" },
];

export type FilaDeCruce<T> =
  | { tipo: "grupo"; clave: GrupoDeCruce; titulo: string; detalle: string; total: number }
  | { tipo: "caso"; item: T };

/**
 * Ordena los casos por grupo e intercala un encabezado antes de cada bloque.
 *
 * Devuelve una lista plana para que la tabla siga siendo una sola tabla —
 * partirla en varias rompería la alineación de columnas entre grupos, que es
 * justo lo que permite comparar de un vistazo.
 *
 * `limitePorGrupo` recorta **dentro de cada grupo**, no sobre el total. Con un
 * tope global el primer grupo se lo comía entero —247 recuperables agotaban las
 * 160 filas— y los otros tres quedaban inalcanzables. Cada encabezado declara
 * siempre el total real de su grupo, de modo que el recorte se ve.
 */
export function filasDeCruce<T>(
  casos: T[],
  clasificar: (item: T) => CasoDeCruce,
  limitePorGrupo = Number.POSITIVE_INFINITY,
): FilaDeCruce<T>[] {
  const porGrupo = new Map<GrupoDeCruce, T[]>();
  casos.forEach((item) => {
    const grupo = grupoDeCruce(clasificar(item));
    const previo = porGrupo.get(grupo);
    if (previo) previo.push(item);
    else porGrupo.set(grupo, [item]);
  });

  const filas: FilaDeCruce<T>[] = [];
  GRUPOS_DE_CRUCE.forEach((definicion) => {
    const items = porGrupo.get(definicion.grupo);
    if (!items?.length) return;
    const visibles = items.slice(0, Math.max(0, limitePorGrupo));
    if (!visibles.length) return;
    filas.push({
      tipo: "grupo",
      clave: definicion.grupo,
      titulo: definicion.titulo,
      detalle: definicion.detalle,
      total: items.length,
    });
    visibles.forEach((item) => filas.push({ tipo: "caso", item }));
  });
  return filas;
}
