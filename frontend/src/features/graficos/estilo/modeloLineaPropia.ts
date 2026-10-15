// Armar una línea visual propia desde el plan (ID3c, decisión D7). Puro: el diálogo lo llama.
//
// Una línea guarda la forma de un perfil del recetario: presets, paletas, ajustes guardados y reglas. Lo que lleva lo
// deciden dos interruptores reales —«Colores» (las paletas) y «Gráficos y portada» (presets, ajustes guardados y reglas,
// donde viven plantilla y portada)—. Logos y letra viven en el estilo del cliente y todavía no llegan al PPT (D5, ID9):
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
