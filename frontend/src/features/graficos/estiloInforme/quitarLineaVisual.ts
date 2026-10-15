// «Quitar línea» (L4 del rediseño, 2026-10-14). Aplicar una línea visual funde sus presets, paletas, ajustes guardados y
// reglas en el estado (`estiloDePerfil` en store.ts); quitarla resta exactamente lo que trajo: cada valor que todavía es
// el de la línea se borra y vuelve a mandar el recetario. Lo que el usuario cambió después ya no es de la línea y se
// queda («lo que cambies después manda sobre ella»). Puro: el store lo llama.

import type { PptStyleProfileMeta } from "../../../api/graficos";
import type { OverrideReusable, PaletaPorLista } from "../store";

type Registro = Record<string, unknown>;

const esRegistro = (v: unknown): v is Registro => typeof v === "object" && v !== null && !Array.isArray(v);
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `base` sin las hojas que siguen valiendo lo que puso `aporte`; los registros que quedan vacíos se van. */
function restar(base: Registro, aporte: Registro): Registro {
  const out: Registro = { ...base };
  for (const [clave, valor] of Object.entries(aporte)) {
    if (!(clave in out)) continue;
    if (esRegistro(valor) && esRegistro(out[clave])) {
      const resto = restar(out[clave] as Registro, valor);
      if (Object.keys(resto).length) out[clave] = resto;
      else delete out[clave];
    } else if (igual(out[clave], valor)) {
      delete out[clave];
    }
  }
  return out;
}

export type EstadoLinea = {
  presets: Record<string, Record<string, unknown>>;
  paletas: Record<string, PaletaPorLista>;
  overridesReusables: OverrideReusable[];
  scopeRules: Registro;
};

export function sinEstiloDePerfil<T extends EstadoLinea>(estado: T, perfil: PptStyleProfileMeta): EstadoLinea {
  const aportados = new Map((perfil.overrides_reusables ?? []).map((o) => [(o as { id?: string }).id, o]));
  return {
    presets: restar(estado.presets, perfil.presets ?? {}) as EstadoLinea["presets"],
    paletas: restar(estado.paletas, perfil.paletas ?? {}) as EstadoLinea["paletas"],
    overridesReusables: estado.overridesReusables.filter((o) => !aportados.has(o.id) || !igual(o, aportados.get(o.id))),
    scopeRules: restar(estado.scopeRules, perfil.scope_rules ?? {}),
  };
}
