import type { GraficadorRef, Slide, VarInfo } from "../../api/client";
import { SLIDE_GRAF_SLOTS } from "./store";
import { parseVarRef } from "./useVariables";

type VarLike = VarInfo & { source?: string };

export type SlideTitleResolution = {
  title: string;
  source: "manual" | "variable" | "none";
  variableRef?: string;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

export function cleanInferredVariableTitle(value: unknown): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  return textOrNull(text.replace(/\s*\(\s*Recodificada\s*\)\s*$/i, ""));
}

function flattenRefs(value: unknown): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenRefs);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(flattenRefs);
  }
  return [];
}

export function firstVariableRefFromGraph(graf: GraficadorRef | null | undefined): string | null {
  if (!graf?.args) return null;
  const args = graf.args;
  for (const key of ["var", "vars", "variable", "variables"]) {
    const refs = flattenRefs(args[key]);
    if (refs.length > 0) return refs[0];
  }
  return null;
}

export function isSingleChartSlide(slide: Slide): boolean {
  return (SLIDE_GRAF_SLOTS[slide.tipo] ?? []).length === 1;
}

function findVariable(ref: string, variables: VarLike[]): VarLike | undefined {
  const parsed = parseVarRef(ref);
  if (parsed.source) {
    return variables.find((v) => v.source === parsed.source && v.name === parsed.name);
  }
  return variables.find((v) => v.name === parsed.name || (v.source ? `${v.source}$${v.name}` === ref : false));
}

export function inferSlideVariableTitle(slide: Slide, variables: VarLike[]): SlideTitleResolution {
  if (!isSingleChartSlide(slide)) return { title: "", source: "none" };

  const slotName = (SLIDE_GRAF_SLOTS[slide.tipo] ?? [])[0];
  const graf = (slide.payload as Record<string, unknown>)[slotName] as GraficadorRef | null | undefined;
  const variableRef = firstVariableRefFromGraph(graf);
  if (!variableRef) return { title: "", source: "none" };

  const variable = findVariable(variableRef, variables);
  const title = cleanInferredVariableTitle(variable?.label) ?? cleanInferredVariableTitle(variableRef);
  return title ? { title, source: "variable", variableRef } : { title: "", source: "none" };
}

export function resolveSlideTitle(slide: Slide, variables: VarLike[]): SlideTitleResolution {
  const manual = textOrNull(slide.payload.titulo);
  if (manual) return { title: manual, source: "manual" };
  return inferSlideVariableTitle(slide, variables);
}

export function slideDisplayTitle(slide: Slide, variables: VarLike[], fallback = ""): string {
  return resolveSlideTitle(slide, variables).title || fallback;
}
