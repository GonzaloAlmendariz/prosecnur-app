// De qué base lee el motor la pregunta de un selector, con la misma regla que el export.
//
// El motor resuelve una ref suelta (`p7`, sin `base$`) con la base activa del informe: el worker la califica
// (`.graficos_calificar_refs_plan`, api/R/graficos_jobs.R) y `.resolve_source_name` (api/R/reporte_plan_ppt.R) toma
// fuente explícita, luego prefijo, luego esa base. El selector pintaba «falta la base» en toda ref suelta: en CCSS eran
// 141 de 143 referencias que el motor dibujaba sin problema. Aquí se separa lo que de verdad falla de lo que no.
//
// En el informe compartido (`consolidated`) la base activa no es la del informe y el preflight bloquea la ref suelta
// (`unqualified_multisource_reference`, laminas/ordenCategorias.ts): ahí sí falta la base.

import { basesPorNombre } from "./fijarBase";
import type { RelacionBases } from "./relacionBases";

export type EstadoBaseRef =
  /** Una sola base, ref con prefijo o vacía: nada que decir. */
  | { tipo: "sin-aviso" }
  /** Ref suelta que existe en la base activa: el motor la lee de ahí. */
  | { tipo: "base-activa"; base: string }
  /** Ref suelta que no está en la base activa pero sí en otra(s): se puede fijar a esa base. */
  | { tipo: "en-otra-base"; base: string; otras: string[] }
  /** Ref suelta que no está en ninguna base. */
  | { tipo: "en-ninguna" }
  /** Ref suelta sin base con la que resolverla (informe compartido o sin base activa). */
  | { tipo: "falta-base" };

export type ContextoBaseRef = {
  multi: boolean;
  variables: readonly { name: string; source: string }[];
  /** `active_base` del endpoint de variables: la misma que usa el worker (`.graficos_active_base_name`). */
  baseActiva: string | null | undefined;
  /** Respaldo cuando el endpoint no trae base activa: la base que lee el motor por convención (relacionBases.ts). */
  relacionBases?: RelacionBases;
  scope?: "active" | "consolidated";
};

/** Base con la que el motor resuelve una ref suelta, o `null` si no hay ninguna. */
export function baseQueLeeElMotor(ctx: Pick<ContextoBaseRef, "baseActiva" | "relacionBases" | "scope" | "variables">): string | null {
  if (ctx.scope === "consolidated") return null;
  const fuentes = new Set(ctx.variables.map((v) => v.source));
  const activa = (ctx.baseActiva ?? "").trim();
  if (activa && fuentes.has(activa)) return activa;
  const resolutora = ctx.relacionBases?.resolutora ?? null;
  return resolutora && fuentes.has(resolutora) ? resolutora : null;
}

export function estadoBaseDeRef(ref: string | null | undefined, ctx: ContextoBaseRef): EstadoBaseRef {
  const nombre = typeof ref === "string" ? ref.trim() : "";
  if (!ctx.multi || !nombre || nombre.includes("$")) return { tipo: "sin-aviso" };
  const base = baseQueLeeElMotor(ctx);
  if (!base) return { tipo: "falta-base" };
  const donde = basesPorNombre(ctx.variables).get(nombre) ?? [];
  if (donde.includes(base)) return { tipo: "base-activa", base };
  if (donde.length) return { tipo: "en-otra-base", base: donde[0], otras: donde };
  return { tipo: "en-ninguna" };
}

/** Rótulo breve de una base para la pastilla: «Base default», «Base datos_crianza». */
export function rotuloBase(base: string): string {
  return `Base ${base}`;
}
