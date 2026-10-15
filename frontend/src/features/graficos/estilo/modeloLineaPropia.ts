// Armar una línea visual propia desde el plan (ID3c, decisión D7). Puro: el diálogo lo llama.
//
// Una línea guarda la forma de un perfil del recetario: presets, paletas, ajustes guardados y reglas. Lo que lleva lo
// deciden dos interruptores reales —«Colores» (las paletas) y «Gráficos y portada» (presets, ajustes guardados y reglas,
// donde viven plantilla y portada)—. Logos y letra viven en el estilo del cliente, no en la forma de una línea (perfil):
// la línea los declara `false` y la UI lo dice, en vez de prometer algo que aplicar no haría.

import type { LineaVisualNueva, IncluyeLinea } from "../../../api/graficosLineasVisuales";
import type { PptStyleProfileMeta } from "../../../api/graficos";

export type PlanParaLinea = {
  presets: Record<string, Record<string, unknown>>;
  paletas: Record<string, Record<string, string>>;
  overridesReusables: readonly unknown[];
  scopeRules: Record<string, unknown>;
};

export type CamposLinea = { titulo: string; descripcion: string; colores: boolean; graficos: boolean };

const vacio = <T,>() => ({} as T);

/** Hasta seis colores distintos de las paletas, en orden, para los puntos de la tarjeta. */
export function coloresDeMuestra(paletas: Record<string, Record<string, string>>): string[] {
  const vistos: string[] = [];
  for (const paleta of Object.values(paletas)) {
    for (const c of Object.values(paleta ?? {})) {
      if (typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c) && !vistos.includes(c.toUpperCase())) vistos.push(c.toUpperCase());
      if (vistos.length === 6) return vistos;
    }
  }
  return vistos;
}

export function lineaDesdePlan(plan: PlanParaLinea, campos: CamposLinea): LineaVisualNueva {
  const paletas = campos.colores ? plan.paletas : vacio<PlanParaLinea["paletas"]>();
  const incluye: IncluyeLinea = { colores: campos.colores, portada: campos.graficos, letra: false, logos: false };
  // El `profile_id` de una línea aplicada antes no se arrastra: el servidor pone el de la nueva.
  const { global, ...resto } = plan.scopeRules as { global?: Record<string, unknown> };
  const globalSinPerfil = global && typeof global === "object" ? Object.fromEntries(Object.entries(global).filter(([k]) => k !== "profile_id")) : {};
  return {
    titulo_humano: campos.titulo.trim(),
    descripcion: campos.descripcion.trim(),
    preview_colors: coloresDeMuestra(paletas),
    presets: campos.graficos ? plan.presets : vacio(),
    paletas,
    overrides_reusables: (campos.graficos ? plan.overridesReusables : []) as PptStyleProfileMeta["overrides_reusables"],
    scope_rules: campos.graficos ? { ...resto, global: globalSinPerfil } : {},
    incluye,
  };
}

/** Una línea (del recetario o propia) como punto de partida de otra: «Duplicar como propia». */
export function lineaDesdePerfil(perfil: PptStyleProfileMeta, titulo: string): LineaVisualNueva {
  return lineaDesdePlan(
    { presets: perfil.presets ?? {}, paletas: perfil.paletas ?? {}, overridesReusables: perfil.overrides_reusables ?? [], scopeRules: perfil.scope_rules ?? {} },
    { titulo, descripcion: perfil.descripcion ?? "", colores: true, graficos: true },
  );
}

const esRegistro = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Cuántos valores de `aporte` ya no valen lo mismo en `actual` (hojas comparadas; un registro se recorre). */
function cambiados(actual: unknown, aporte: unknown): number {
  if (esRegistro(aporte)) {
    const a = esRegistro(actual) ? actual : {};
    return Object.entries(aporte).reduce((n, [k, v]) => n + cambiados(a[k], v), 0);
  }
  return igual(actual, aporte) ? 0 : 1;
}

/**
 * ID3d (2026-10-15): ¿el plan cambió algo de lo que trae la línea aplicada? Aplicar FUNDE la línea sobre el plan, así que
 * el plan siempre tiene más que la línea: sólo cuentan los valores que la línea pone (presets, paletas, ajustes
 * guardados por id y reglas, sin el `profile_id`). Devuelve cuántos difieren; 0 es «sin cambios».
 */
export function cambiosSobreLinea(plan: PlanParaLinea, linea: Pick<PptStyleProfileMeta, "presets" | "paletas" | "overrides_reusables" | "scope_rules">): number {
  const reglas = (linea.scope_rules ?? {}) as { global?: Record<string, unknown> };
  const global = esRegistro(reglas.global) ? Object.fromEntries(Object.entries(reglas.global).filter(([k]) => k !== "profile_id")) : {};
  const overridesPlan = new Map((plan.overridesReusables as { id?: string }[]).map((o) => [o.id, o]));
  const overrides = (linea.overrides_reusables ?? []).reduce((n, o) => n + (igual(overridesPlan.get((o as { id?: string }).id), o) ? 0 : 1), 0);
  return cambiados(plan.presets, linea.presets ?? {}) + cambiados(plan.paletas, linea.paletas ?? {}) + overrides
    + cambiados(plan.scopeRules, { ...reglas, global });
}

/** Hojas distintas entre dos valores, sobre la UNIÓN de sus claves (una clave nueva en cualquiera de los dos cuenta). */
export function diferencias(a: unknown, b: unknown): number {
  if (esRegistro(a) || esRegistro(b)) {
    const x = esRegistro(a) ? a : {};
    const y = esRegistro(b) ? b : {};
    return [...new Set([...Object.keys(x), ...Object.keys(y)])].reduce((n, k) => n + diferencias(x[k], y[k]), 0);
  }
  return igual(a, b) ? 0 : 1;
}

/**
 * Huella del plan en lo que una línea gobierna según su `incluye` (sin `profile_id`). Se toma al aplicar una línea
 * propia; comparar la huella de ahora con esa detecta también los ajustes NUEVOS que la línea no traía (p. ej. elegir
 * «reparto» donde la línea no decía nada), que `cambiosSobreLinea` no ve.
 */
export function huellaPlan(plan: PlanParaLinea, incluye: { colores: boolean; portada: boolean }): Record<string, unknown> {
  const { global, ...resto } = plan.scopeRules as { global?: Record<string, unknown> };
  const globalSinPerfil = esRegistro(global) ? Object.fromEntries(Object.entries(global).filter(([k]) => k !== "profile_id")) : {};
  return {
    ...(incluye.colores ? { paletas: plan.paletas } : {}),
    ...(incluye.portada ? {
      presets: plan.presets,
      overrides: Object.fromEntries((plan.overridesReusables as { id?: string }[]).map((o) => [o.id ?? "", o])),
      reglas: { ...resto, global: globalSinPerfil },
    } : {}),
  };
}

/** Lo que hay que devolverle al plan para descartar los cambios: la huella vuelta a la forma del store. */
export function estiloDesdeHuella(huella: Record<string, unknown>, lineaId: string): Partial<PlanParaLinea> {
  const reglas = esRegistro(huella.reglas) ? huella.reglas : null;
  return {
    ...(esRegistro(huella.paletas) ? { paletas: huella.paletas as PlanParaLinea["paletas"] } : {}),
    ...(esRegistro(huella.presets) ? { presets: huella.presets as PlanParaLinea["presets"] } : {}),
    ...(esRegistro(huella.overrides) ? { overridesReusables: Object.values(huella.overrides) } : {}),
    ...(reglas ? { scopeRules: { ...reglas, global: { ...(esRegistro(reglas.global) ? reglas.global : {}), profile_id: lineaId } } } : {}),
  };
}
