// Sorteos en la Vista del cuestionario (E8 editor-conjoint, 2026-11-06). Una nota que muestra niveles sorteados (la
// tabla de un par de conjoint) no tiene un texto fijo: en el documento se ve con un sorteo de ejemplo, siempre el
// mismo, y rotulada como ejemplo. Lo que depende de respuestas sigue saliendo como «[referencia]».

import { calcularValores } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";

/** Semilla fija: el documento muestra siempre el mismo ejemplo. */
export const SEMILLA_EJEMPLO = 20261106;

const REF = /\$\{\s*([^}\s]+)\s*\}/g;
const referencias = (texto: string) => Array.from(texto.matchAll(REF), (m) => m[1]!);

/** Cálculos que dependen de un `random()`, directo o a través de otros cálculos. */
export function calculosSorteados(outline: readonly BuilderNode[]): Set<string> {
  const calculos = outline.filter((n) => n.kind === "calculate" && n.name);
  const sorteados = new Set(calculos.filter((n) => /\brandom\s*\(/.test(n.calculation)).map((n) => n.name));
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const n of calculos) {
      if (!sorteados.has(n.name) && referencias(n.calculation).some((r) => sorteados.has(r))) {
        sorteados.add(n.name);
        cambio = true;
      }
    }
  }
  return sorteados;
}

/** ¿El texto cita algún valor sorteado? */
export function citaSorteo(texto: string, sorteados: ReadonlySet<string>): boolean {
  return referencias(texto ?? "").some((r) => sorteados.has(r));
}

/** Valores de ejemplo de los cálculos sorteados (los demás no se fijan aquí). */
export function valoresDeEjemplo(outline: readonly BuilderNode[]): { sorteados: Set<string>; valores: Record<string, string> } {
  const sorteados = calculosSorteados(outline);
  if (!sorteados.size) return { sorteados, valores: {} };
  const todos = calcularValores(outline, {}, SEMILLA_EJEMPLO);
  const valores: Record<string, string> = {};
  for (const n of sorteados) if (n in todos) valores[n] = todos[n]!;
  return { sorteados, valores };
}
