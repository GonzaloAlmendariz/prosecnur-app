/**
 * Un código que va a la categoría equivocada (checklist A5 de la matriz HSyVbG,
 * 2026-10-21). En 2025 «Año de ingreso» venía en orden inverso (1 = desde 2023)
 * y se guardó comparable con la identidad: 1.386 casos cayeron en «hasta
 * 2019». El editor lo marcaba como «etiqueta distinta», pero sólo con el panel
 * abierto, y esa marca a secas es ruido (una dummy «Sí» que va a «Angustia» es
 * correcta).
 *
 * Lo que delata un mapa equivocado: el código va 1:1 a una categoría mientras
 * su etiqueta se parece CLARAMENTE más a otra categoría de la escala. Parecido =
 * proporción de palabras compartidas; la otra categoría tiene que superar a la
 * de destino y llegar a 0,5. Dos límites contra los falsos positivos de las
 * escalas de intensidad: sólo se revisa el mapa identidad (un mapa declarado
 * código por código ya es una decisión, y declararlo da el aviso por revisado),
 * y no se sugiere una categoría cuyas palabras están todas dentro de la etiqueta
 * de la base («De acuerdo» frente a «Totalmente de acuerdo»). Es la misma regla que el motor
 * (`.armz_codigos_mal_ubicados`, analitica_armonizada_implicita.R), que avisa
 * en el comparativo.
 */

import type { CategoriaEscalaComun, EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { destinoDe } from "./armonizacionModel";
import { etiquetaTolerante } from "./etiquetaTolerante";

export type CodigoMalUbicado = {
  base: string;
  codigo: string;
  etiqueta: string;
  etiquetaDestino: string;
  /** La categoría de la escala a la que más se parece. */
  sugerida: string;
};

const UMBRAL = 0.5;

function palabras(s: string): Set<string> {
  return new Set(etiquetaTolerante(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function parecido(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comunes = 0;
  for (const w of a) if (b.has(w)) comunes += 1;
  return comunes / (a.size + b.size - comunes);
}

/** Sobre los códigos de UNA base con su destino ya resuelto. */
export function malUbicadosEnMapa(
  base: string,
  codigos: readonly { codigo: string; etiqueta: string | null; destino: string | null }[],
  escala: readonly CategoriaEscalaComun[],
): CodigoMalUbicado[] {
  if (escala.length < 2) return [];
  const porDestino = new Map<string, number>();
  for (const c of codigos) if (c.destino) porDestino.set(c.destino, (porDestino.get(c.destino) ?? 0) + 1);
  const palabrasEscala = escala.map((e) => palabras(e.etiqueta));
  const out: CodigoMalUbicado[] = [];
  for (const c of codigos) {
    if (!c.destino || !c.etiqueta || (porDestino.get(c.destino) ?? 0) > 1) continue;
    const j = escala.findIndex((e) => e.codigo === c.destino);
    if (j < 0) continue;
    const propias = palabras(c.etiqueta);
    if (propias.size === 0) continue;
    const sim = palabrasEscala.map((p, i) => {
      const contenida = p.size > 0 && p.size < propias.size && [...p].every((w) => propias.has(w));
      return i !== j && contenida ? 0 : parecido(propias, p);
    });
    let k = -1;
    for (let i = 0; i < sim.length; i += 1) if (i !== j && (k < 0 || sim[i] > sim[k])) k = i;
    if (k >= 0 && sim[k] >= UMBRAL && sim[k] > sim[j]) {
      out.push({ base, codigo: c.codigo, etiqueta: c.etiqueta, etiquetaDestino: escala[j].etiqueta, sugerida: escala[k].etiqueta });
    }
  }
  return out;
}

/** Sobre la fila guardada y el catálogo de cada base: lo que pinta la columna «Escala». */
export function codigosMalUbicados(
  fila: Pick<EquivalenciaFila, "armonizacion" | "variables">,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): CodigoMalUbicado[] {
  const arm = fila.armonizacion;
  if (!arm || arm.escala.length < 2) return [];
  const out: CodigoMalUbicado[] = [];
  for (const base of bases) {
    const variable = fila.variables[base];
    const por = arm.por_base[base];
    if (!variable || por?.comparable !== true) continue;
    if (Object.values(por.mapa ?? {}).some(Boolean)) continue;
    // Como el motor: sólo las opciones con etiqueta (`.equiv_escala_opciones`).
    const opciones = ((variablesPorBase[base] ?? []).find((v) => v.name === variable)?.opciones ?? [])
      .filter((o) => o.etiqueta.trim());
    const entrada = { comparable: true, nota: "", mapa: por.mapa ?? {} };
    const codigos = opciones.map((o) => ({
      codigo: o.codigo,
      etiqueta: o.etiqueta || null,
      destino: destinoDe(entrada, arm.escala, o.codigo),
    }));
    out.push(...malUbicadosEnMapa(base, codigos, arm.escala));
  }
  return out;
}
