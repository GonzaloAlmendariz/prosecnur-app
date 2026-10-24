// «Fijar la base principal en todas las láminas»: escribe `default$p7` donde el plan dice `p7` y el motor ya lee esa
// pregunta de esa base sin ambigüedad (relacionBases.ts). Es la acción masiva del aviso `var-base-implicita`: la base
// se resolvía lámina por lámina. Sólo toca refs sueltas que resuelven; las ambiguas (públicos hermanos) se quedan para
// que el analista elija.

import type { Slide } from "../../api/graficos";
import { isDerivedReportVariableRef } from "./derivedReportVariables";
import { baseQueResuelve, type RelacionBases } from "./relacionBases";

type VarConBase = { name: string; source: string };

/** Bases donde vive cada nombre de pregunta. */
export function basesPorNombre(variables: readonly VarConBase[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const v of variables) {
    const previas = out.get(v.name) ?? [];
    if (!previas.includes(v.source)) previas.push(v.source);
    out.set(v.name, previas);
  }
  return out;
}

/** Base implícita de una ref suelta, o `null` si trae `$`, es derivada o es ambigua. */
export function baseImplicitaDe(ref: string, bases: Map<string, string[]>, relacion: RelacionBases): string | null {
  if (!ref || ref.includes("$") || isDerivedReportVariableRef(ref)) return null;
  const donde = bases.get(ref);
  return donde?.length ? baseQueResuelve(donde, relacion) : null;
}

type Reescribir = (ref: string) => string;

function reescribirValor(valor: unknown, f: Reescribir): unknown {
  if (typeof valor === "string") return valor.length ? f(valor) : valor;
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === "string" && v.length ? f(v) : v));
  return valor;
}

/** Mismas llaves que lee el validador (`collectVarRefs`): `var`, `cruce(s)`, `vars` (texto, lista o por tema), `bloques`. */
export function reescribirRefs(args: Record<string, unknown>, f: Reescribir): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  for (const k of ["var", "cruces", "cruce"]) if (k in out) out[k] = reescribirValor(out[k], f);
  const vars = out.vars;
  if (vars && typeof vars === "object" && !Array.isArray(vars)) {
    out.vars = Object.fromEntries(Object.entries(vars as Record<string, unknown>).map(([k, v]) => [k, reescribirValor(v, f)]));
  } else if ("vars" in out) {
    out.vars = reescribirValor(vars, f);
  }
  if (Array.isArray(out.bloques)) {
    out.bloques = out.bloques.map((b) => (b && typeof b === "object" && !Array.isArray(b) ? reescribirRefs(b as Record<string, unknown>, f) : b));
  }
  return out;
}

export type ResultadoFijarBase = { slides: Slide[]; laminas: number; preguntas: number; base: string | null };

export function conBaseFijada(slides: readonly Slide[], variables: readonly VarConBase[], relacion: RelacionBases): ResultadoFijarBase {
  const bases = basesPorNombre(variables);
  let laminas = 0;
  let preguntas = 0;
  let base: string | null = null;
  const nuevas = slides.map((slide) => {
    let tocada = false;
    const payload = slide.payload as Record<string, unknown>;
    const nuevo: Record<string, unknown> = { ...payload };
    for (const [slot, valor] of Object.entries(payload)) {
      if (!valor || typeof valor !== "object" || Array.isArray(valor)) continue;
      const g = valor as { graficador?: unknown; args?: unknown };
      if (typeof g.graficador !== "string" || !g.args || typeof g.args !== "object") continue;
      let cambios = 0;
      const args = reescribirRefs(g.args as Record<string, unknown>, (ref) => {
        const b = baseImplicitaDe(ref, bases, relacion);
        if (!b) return ref;
        cambios += 1;
        base = b;
        return `${b}$${ref}`;
      });
      if (cambios) {
        nuevo[slot] = { ...g, args };
        preguntas += cambios;
        tocada = true;
      }
    }
    if (!tocada) return slide;
    laminas += 1;
    return { ...slide, payload: nuevo } as Slide;
  });
  return { slides: laminas ? nuevas : [...slides], laminas, preguntas, base };
}
