/**
 * Las opciones elegidas en una condición, en el orden de la escala de la
 * pregunta y no en el de los clics. "Es una de De acuerdo y Fuertemente de
 * acuerdo" se lee igual si se marcó primero una o la otra. Solo cambia lo que
 * la frase dice: lo que se guarda conserva el orden en que se eligió.
 */
import type { ReglaGateCondition } from "../types";

type ConCodigo = { readonly code: string };

/** Los códigos en el orden de `opciones`; los que la escala no conoce van al final, en su orden. */
export function ordenarPorEscala(codigos: readonly string[], opciones: readonly ConCodigo[] | undefined): string[] {
  if (!opciones?.length) return [...codigos];
  const lugar = new Map(opciones.map((o, i) => [o.code, i]));
  return codigos
    .map((codigo, orden) => ({ codigo, orden, lugar: lugar.get(codigo) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => (a.lugar === b.lugar ? a.orden - b.orden : a.lugar - b.lugar))
    .map((x) => x.codigo);
}

function valorEnEscala(valor: unknown, opciones: readonly ConCodigo[] | undefined): unknown {
  return Array.isArray(valor) ? ordenarPorEscala(valor.map(String), opciones) : valor;
}

export type ValoresDeRegla = {
  variables: readonly string[];
  params: Record<string, unknown>;
  gate_conditions: readonly ReglaGateCondition[];
};

/**
 * La regla con las listas de opciones de sus condiciones en el orden de la
 * escala: "Dos respuestas que deben cuadrar" (`valor_x`, `valor_y`), "Condiciones
 * combinadas" y el filtro. Devuelve copias; la regla recibida no cambia.
 */
export function ordenarValoresPorEscala<T extends ValoresDeRegla>(
  regla: T,
  opciones: ReadonlyMap<string, readonly ConCodigo[]>,
): { params: Record<string, unknown>; gate_conditions: ReglaGateCondition[] } {
  const params: Record<string, unknown> = { ...regla.params };
  const [v1, v2] = regla.variables;
  if (v1 && "valor_x" in params) params.valor_x = valorEnEscala(params.valor_x, opciones.get(v1));
  if (v2 && "valor_y" in params) params.valor_y = valorEnEscala(params.valor_y, opciones.get(v2));
  if (Array.isArray(params.condiciones)) {
    params.condiciones = params.condiciones.map((c) => {
      if (!c || typeof c !== "object") return c;
      const cond = c as Record<string, unknown>;
      return { ...cond, valor: valorEnEscala(cond.valor, opciones.get(String(cond.variable ?? ""))) };
    });
  }
  const gate_conditions = regla.gate_conditions.map((g) => ({
    ...g,
    value: valorEnEscala(g.value, opciones.get(g.variable)) as ReglaGateCondition["value"],
  }));
  return { params, gate_conditions };
}
