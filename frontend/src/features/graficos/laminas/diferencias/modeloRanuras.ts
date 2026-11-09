// Un bloque por ranura con cruce en «Diferencias de esta lámina» y en la revisión del informe (ADR 0128 «Familia por
// base»). Desde 769aa19b7 el backend prueba cada ranura sobre su base y la manda en `lamina.ranuras`; aquí se decide
// el orden (la ranura enfocada primero), la cabecera (sólo con más de una ranura) y la línea que explica una ranura
// en error o en abstención. Sin React.

import type { LaminaDiferencias, RanuraDiferencias } from "../../../../api/graficosDiferencias";
import { ranuraDeLaLamina } from "../../../../api/graficosDiferencias";
import { nombreBase } from "../modeloMaqueta";

export type BloqueRanura = {
  /** Clave estable del bloque: la ranura, o su posición si no tiene nombre. */
  clave: string;
  ranura: RanuraDiferencias;
  /** «Gráfico 2: Barras agrupadas» o, con más de una base en la lámina, «Gráfico 2: Barras agrupadas, base Docentes». */
  titulo: string;
  /** Con una sola ranura no hay cabecera: se ve como antes. */
  conCabecera: boolean;
  /** Por qué no hay pares, en una línea: error, abstención o cruce sin grupos. `null` si la prueba corrió. */
  aviso: string | null;
};

/** Las ranuras de la lámina; sin ninguna (lámina sin cruce o backend anterior vacío), la primera armada de la lámina. */
export function ranurasDe(lamina: LaminaDiferencias): RanuraDiferencias[] {
  return lamina.ranuras.length ? lamina.ranuras : [ranuraDeLaLamina(lamina)];
}

/** La ranura de un gráfico del inspector; con una sola ranura sin nombre (backend anterior), esa. */
export function ranuraDelGrafico(lamina: LaminaDiferencias, slot: string): RanuraDiferencias | null {
  const todas = ranurasDe(lamina);
  const exacta = todas.find((r) => r.ranura === slot);
  if (exacta) return exacta;
  return todas.length === 1 && todas[0].ranura === "" ? todas[0] : null;
}

/** Una línea con el motivo de una ranura que no compara; `null` si comparó (con marcas o sin ninguna). */
export function avisoDeRanura(r: Pick<RanuraDiferencias, "estado" | "motivo" | "nota" | "error">): string | null {
  switch (r.estado) {
    case "error":
      return r.error?.message || r.motivo || "La prueba no pudo ejecutarse.";
    case "abstencion":
      return r.motivo || r.nota || "Esta pregunta no admite la comparación entre grupos.";
    case "sin_cruce":
      return r.motivo || "El cruce no tiene al menos dos grupos con datos.";
    default:
      return null;
  }
}

/** Nombre legible del gráfico de una ranura (catálogo o variante), que resuelve quien conoce los args del plan. */
export type NombreDeGrafico = (ranura: RanuraDiferencias) => string;

export function tituloDeRanura(ranura: RanuraDiferencias, nombre: string, conBase: boolean): string {
  const cabeza = nombre ? `Gráfico ${ranura.indice}: ${nombre}` : `Gráfico ${ranura.indice}`;
  return conBase && ranura.base ? `${cabeza}, base ${nombreBase(ranura.base)}` : cabeza;
}

/**
 * Los bloques de la lámina en orden: la ranura enfocada primero (la del gráfico desde el que se abrió) y el resto en el
 * orden del payload. La base va en la cabecera sólo si la lámina mezcla bases.
 */
export function bloquesDeLamina(lamina: LaminaDiferencias, nombreDe: NombreDeGrafico, enfocada: string | null = null): BloqueRanura[] {
  const todas = ranurasDe(lamina);
  const conCabecera = todas.length > 1;
  const bases = new Set(todas.map((r) => r.base).filter((b): b is string => !!b));
  const conBase = bases.size > 1;
  const orden = enfocada && todas.some((r) => r.ranura === enfocada)
    ? [...todas.filter((r) => r.ranura === enfocada), ...todas.filter((r) => r.ranura !== enfocada)]
    : todas;
  return orden.map((ranura) => ({
    clave: ranura.ranura || String(ranura.indice),
    ranura,
    titulo: conCabecera ? tituloDeRanura(ranura, nombreDe(ranura), conBase) : "",
    conCabecera,
    aviso: avisoDeRanura(ranura),
  }));
}

/** El bloque cuyo par se detalla: el elegido si tiene pares; si no, el primero que los tenga. */
export function bloqueConPares(bloques: readonly BloqueRanura[], elegida: string | null): BloqueRanura | null {
  const conPares = bloques.filter((b) => b.ranura.pares.length > 0);
  return conPares.find((b) => b.clave === elegida) ?? conPares[0] ?? null;
}

/**
 * Las filas de la revisión del informe: una por ranura con cruce, en el orden de las láminas y, dentro de cada una, en
 * el del payload. Así los conteos de la tabla son los del `resumen`, que el backend cuenta por ranura.
 */
export function filasPorRanura(
  laminas: readonly LaminaDiferencias[],
  nombreDe: NombreDeGrafico,
  enPlan: (slideId: string) => { posicion: number | null; titulo: string | null } | undefined,
): { lamina: RanuraDiferencias; posicion: number | null; titulo: string; grafico: string; clave: string }[] {
  return laminas.flatMap((l) => {
    const plan = enPlan(l.slide_id);
    const titulo = l.titulo || plan?.titulo || l.slide_id;
    return bloquesDeLamina(l, nombreDe).map((b) => ({
      lamina: b.ranura,
      posicion: plan?.posicion ?? null,
      titulo,
      grafico: b.titulo,
      clave: `${l.slide_id}:${b.clave}`,
    }));
  });
}
