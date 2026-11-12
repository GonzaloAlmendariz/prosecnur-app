// Lo que una plantilla cambia en la identidad del informe (checklist-plantillas-validez-2026-11-11, ítems 4 y 5).
//
// "Crear láminas" aplica el perfil de estilo de la plantilla: funde sus ajustes de gráficos y sus paletas (una lista con
// el mismo nombre se reemplaza) y escribe el estilo de PowerPoint en `scope_rules.global`. Este módulo dice, antes de
// crear, qué de eso pisa algo del proyecto, y quita lo que dejó el perfil anterior cuando se cambia de estilo: sin eso,
// volver a "Informe Pulso" desde ACNUR dejaba el estilo, las paletas y los ajustes de ACNUR. Puro, sin store ni React.

import type { PptStyleProfileMeta } from "../../../api/graficos";

type Dict = Record<string, unknown>;

export type IdentidadEditable = {
  presets: Record<string, Dict>;
  paletas: Record<string, Record<string, string>>;
  overridesReusables: ReadonlyArray<{ id: string }>;
  scopeRules: Dict;
};

export type CambioIdentidad = {
  clave: "estilo" | "paletas-reemplazadas" | "paletas-nuevas" | "paletas-quitadas" | "paletas-conservadas" | "ajustes" | "logos";
  texto: string;
  /** Pisa algo que el proyecto ya tenía (se resalta). */
  pisa: boolean;
};

const PERFIL_ACNUR = "acnur_kobo_cruncher_plus";
const PLANTILLA_PPT_PULSO = "generic_16_9";

export const nombreDeEstilo = (perfil: string): string => (perfil === PERFIL_ACNUR ? "ACNUR" : "Pulso");

const esRegistro = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);

/** Igualdad de valores JSON sin depender del orden de las claves. */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => igual(x, b[i]));
  }
  if (esRegistro(a) && esRegistro(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && igual(a[k], b[k]));
  }
  return false;
}

/**
 * Estilo de PowerPoint vigente en el proyecto, o "" si es el de Pulso. Cuenta el perfil y también la plantilla de
 * PowerPoint: un proyecto con la plantilla de ACNUR y sin su perfil sigue saliendo con la portada de ACNUR.
 */
export function perfilVigente(scopeRules: Dict): string {
  const global = esRegistro(scopeRules.global) ? scopeRules.global : {};
  if (typeof global.profile_id === "string" && global.profile_id) return global.profile_id;
  return global.template_id === "acnur_16_9" ? PERFIL_ACNUR : "";
}

const sinTilde = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cómo se nombra una paleta: por sus respuestas ("Sí / No", "Totalmente en desacuerdo a Totalmente de acuerdo"). */
export function nombreDePaleta(paleta: Record<string, string>): string {
  const vistas = new Map<string, string>();
  for (const r of Object.keys(paleta)) {
    const k = sinTilde(r);
    if (!vistas.has(k) || /[^\u0000-\u007f]/.test(r)) vistas.set(k, r);   // entre "Si" y "Sí" queda la de tilde
  }
  const rotulos = [...vistas.values()];
  if (rotulos.length <= 2) return `"${rotulos.join(" / ")}"`;
  return `"${rotulos[0]}" a "${rotulos[rotulos.length - 1]}"`;
}

const enLista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Cambios en la identidad al crear las láminas con `perfilNuevo` (null: estilo Pulso) cuando hoy rige `perfilActual`.
 * `mantieneIdentidad` (la plantilla En blanco) no toca nada.
 */
export function cambiosDeIdentidad(
  actual: IdentidadEditable,
  perfilActual: PptStyleProfileMeta | null,
  perfilNuevo: PptStyleProfileMeta | null,
  opciones: { logosPropios: number; mantieneIdentidad?: boolean },
): CambioIdentidad[] {
  if (opciones.mantieneIdentidad) return [];
  const idActual = perfilVigente(actual.scopeRules);
  const idNuevo = perfilNuevo?.name ?? "";
  const cambiaEstilo = nombreDeEstilo(idActual) !== nombreDeEstilo(idNuevo);
  const sale = cambiaEstilo ? perfilActual : null;
  const out: CambioIdentidad[] = [];

  if (cambiaEstilo) {
    out.push({ clave: "estilo", texto: `El estilo de PowerPoint pasa de ${nombreDeEstilo(idActual)} a ${nombreDeEstilo(idNuevo)}.`, pisa: true });
  }

  const nuevas: string[] = [];
  const reemplazadas: string[] = [];
  for (const [lista, colores] of Object.entries(perfilNuevo?.paletas ?? {})) {
    const hoy = actual.paletas[lista];
    if (!hoy) nuevas.push(nombreDePaleta(colores));
    else if (!igual({ ...hoy, ...colores }, hoy)) reemplazadas.push(nombreDePaleta(hoy));
  }
  if (reemplazadas.length) {
    out.push({ clave: "paletas-reemplazadas", texto: `Se reemplazan tus colores de ${enLista(reemplazadas)}.`, pisa: true });
  }
  if (nuevas.length) {
    out.push({ clave: "paletas-nuevas", texto: `Se ${plural(nuevas.length, "agrega la paleta", "agregan las paletas")} de ${enLista(nuevas)}.`, pisa: false });
  }

  const quitadas: string[] = [];
  const conservadas: string[] = [];
  for (const [lista, colores] of Object.entries(sale?.paletas ?? {})) {
    if (perfilNuevo?.paletas?.[lista]) continue;
    const hoy = actual.paletas[lista];
    if (!hoy) continue;
    (igual(hoy, colores) ? quitadas : conservadas).push(nombreDePaleta(hoy));
  }
  if (quitadas.length) {
    out.push({ clave: "paletas-quitadas", texto: `Se ${plural(quitadas.length, "quita la paleta", "quitan las paletas")} de ${nombreDeEstilo(idActual)}: ${enLista(quitadas)}.`, pisa: true });
  }
  if (conservadas.length) {
    out.push({ clave: "paletas-conservadas", texto: `Se ${plural(conservadas.length, "conserva", "conservan")} ${enLista(conservadas)}, que editaste.`, pisa: false });
  }

  // Se cuentan tipos de gráfico, no ajustes sueltos: "135 ajustes" no le dice nada a quien decide.
  const tipos = new Set<string>();
  for (const [preset, args] of Object.entries(perfilNuevo?.presets ?? {})) {
    if (Object.entries(args ?? {}).some(([k, v]) => !igual(actual.presets[preset]?.[k], v))) tipos.add(preset);
  }
  for (const [preset, args] of Object.entries(sale?.presets ?? {})) {
    const nuevo = perfilNuevo?.presets?.[preset] ?? {};
    if (Object.entries(args ?? {}).some(([k, v]) => !(k in nuevo) && igual(actual.presets[preset]?.[k], v))) tipos.add(preset);
  }
  if (tipos.size) {
    out.push({ clave: "ajustes", texto: `Cambia el estilo de ${plural(tipos.size, "1 tipo de gráfico", `${tipos.size} tipos de gráfico`)}.`, pisa: true });
  }

  if (idNuevo === PERFIL_ACNUR && opciones.logosPropios > 0) {
    out.push({ clave: "logos", texto: `Tus logos no van en la portada: la plantilla de ${nombreDeEstilo(idNuevo)} trae la suya.`, pisa: true });
  }
  return out;
}

/**
 * La identidad sin lo que aportó `perfil`: los ajustes y paletas que siguen iguales a los del perfil, sus ajustes
 * reutilizables y el estilo de `scope_rules.global`. Lo que el analista editó se queda.
 */
export function sinPerfil<T extends IdentidadEditable>(estado: T, perfil: PptStyleProfileMeta): Pick<T, keyof IdentidadEditable> {
  const presets: Record<string, Dict> = {};
  for (const [preset, args] of Object.entries(estado.presets)) {
    const delPerfil = perfil.presets?.[preset] ?? {};
    presets[preset] = Object.fromEntries(Object.entries(args).filter(([k, v]) => !(k in delPerfil && igual(v, delPerfil[k]))));
  }
  const paletas = Object.fromEntries(
    Object.entries(estado.paletas).filter(([lista, colores]) => !(perfil.paletas?.[lista] && igual(colores, perfil.paletas[lista]))),
  );
  const ids = new Set((perfil.overrides_reusables ?? []).map((o) => (o as { id?: string }).id).filter(Boolean));
  const overridesReusables = estado.overridesReusables.filter((o) => !ids.has(o.id));
  const global = esRegistro(estado.scopeRules.global) ? { ...estado.scopeRules.global } : {};
  for (const k of ["profile_id", "template_id", "acnur_mode"]) delete global[k];
  return { presets, paletas, overridesReusables, scopeRules: { ...estado.scopeRules, global } } as Pick<T, keyof IdentidadEditable>;
}

/**
 * Config con que se pide la estructura y el plan de una plantilla. La plantilla manda su identidad y la escribe entera
 * en `scope_rules.global`: el backend funde el pedido sobre la config guardada en la sesión, así que omitir una clave
 * no la borra, y prefiere la plantilla de PowerPoint de `global` a la del perfil. Al volver a "Informe Pulso" desde
 * ACNUR, el plan salía con la plantilla de PowerPoint de ACNUR (QA en vivo con el RMS, 2026-11-11). En blanco mantiene
 * la identidad del proyecto.
 */
export function configDePlantilla(config: Dict, plantilla: { config: Dict; enBlanco?: boolean }): Dict {
  if (plantilla.enBlanco) return { ...config, ...plantilla.config };
  const reglas = esRegistro(config.scope_rules) ? config.scope_rules : {};
  const global = {
    ...(esRegistro(reglas.global) ? reglas.global : {}),
    profile_id: String(plantilla.config.profile_id ?? ""),
    template_id: String(plantilla.config.template_id ?? PLANTILLA_PPT_PULSO),
    acnur_mode: String(plantilla.config.acnur_mode ?? "general"),
  };
  return { ...config, scope_rules: { ...reglas, global }, ...plantilla.config };
}
