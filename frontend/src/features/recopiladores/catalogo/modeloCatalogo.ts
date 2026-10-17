// Modelo puro de Catálogo › Tipos (ADR 0109 §3 y §7).
//
// Todo lo que la galería y el inspector dicen de un tipo de material sale de
// aquí: familias con su conteo, los chips de la tarjeta, las filas del
// inspector y el motivo de un tipo que no aplica. Sin React, para fijarlo con
// Vitest sin montar la vista.

import type { MaterialCatalogPreset } from "../../../api/materialCatalog";
import { tipoDeUnidad } from "../tipoDeUnidad";

export const FAMILIA_TODOS = "todos";

/**
 * Rótulos de las familias que conoce la app. Una familia que no esté aquí se
 * muestra con su `family_label` o, a falta de él, con la clave tal cual: el
 * catálogo es del backend y puede crecer antes que esta tabla.
 */
const FAMILIA_LABELS: Record<string, string> = {
  identifica_unidad: "Identifica la unidad",
  identifies_unit: "Identifica la unidad",
  unit: "Identifica la unidad",
  participante: "Va al participante",
  va_al_participante: "Va al participante",
  participant: "Va al participante",
  equipo: "Para el equipo",
  team: "Para el equipo",
  control: "Control de campo",
};

export function etiquetaDeFamilia(preset: Pick<MaterialCatalogPreset, "family" | "family_label">): string {
  if (preset.family_label) return preset.family_label;
  if (!preset.family) return "Sin familia";
  return FAMILIA_LABELS[preset.family] ?? preset.family;
}

export type FamiliaDelCatalogo = { id: string; label: string; count: number };

/** «Todos» primero y luego cada familia en el orden en que aparece. */
export function familiasDelCatalogo(presets: readonly MaterialCatalogPreset[]): FamiliaDelCatalogo[] {
  const porId = new Map<string, FamiliaDelCatalogo>();
  for (const preset of presets) {
    const id = preset.family || "sin-familia";
    const actual = porId.get(id);
    if (actual) actual.count += 1;
    else porId.set(id, { id, label: etiquetaDeFamilia(preset), count: 1 });
  }
  return [{ id: FAMILIA_TODOS, label: "Todos", count: presets.length }, ...porId.values()];
}

export function filtrarPorFamilia(
  presets: readonly MaterialCatalogPreset[],
  familia: string,
): MaterialCatalogPreset[] {
  if (familia === FAMILIA_TODOS) return [...presets];
  return presets.filter((preset) => (preset.family || "sin-familia") === familia);
}

export function textoDePaginas(n: number): string {
  return n === 1 ? "1 página" : `${n.toLocaleString("es-PE")} páginas`;
}

const COPIAS_LABELS: Record<string, string> = {
  unit: "1 por unidad",
  unidad: "1 por unidad",
  survey: "1 por encuesta",
  encuesta: "1 por encuesta",
  site: "1 por sede",
  sede: "1 por sede",
  once: "Una sola vez",
  una_vez: "Una sola vez",
};

export function textoDeCopias(copies: MaterialCatalogPreset["copies_per"]): string | null {
  if (copies === null) return null;
  if (typeof copies === "number") return `${copies.toLocaleString("es-PE")} por unidad`;
  return COPIAS_LABELS[copies] ?? copies;
}

export function textoDeOrientacion(orientation: MaterialCatalogPreset["orientation"]): string {
  return orientation === "landscape" ? "apaisado" : "vertical";
}

/** «A4 · vertical»; sin papel declarado no se supone ninguno. */
export function textoDeFormato(preset: Pick<MaterialCatalogPreset, "paper" | "orientation">): string {
  const orientacion = textoDeOrientacion(preset.orientation);
  if (!preset.paper) return orientacion.charAt(0).toUpperCase() + orientacion.slice(1);
  return `${preset.paper} · ${orientacion}`;
}

export function textoDeImpresion(faces: MaterialCatalogPreset["faces"]): string {
  return faces === 2 ? "Frente y dorso" : "Una cara";
}

/** De qué unidades lee sus datos el tipo. Una lista vacía no restringe. */
export function textoDeLectura(unitTypes: readonly string[]): string {
  if (!unitTypes.length) return "Cualquier unidad";
  return unitTypes.map(tipoDeUnidad).join(" · ");
}

/** Chips de la tarjeta: papel (si se sabe), páginas y copias. */
export function chipsDelTipo(preset: MaterialCatalogPreset): string[] {
  const copias = textoDeCopias(preset.copies_per);
  return [
    preset.paper ?? "",
    textoDePaginas(preset.pages_per_unit),
    copias ?? "",
  ].filter(Boolean);
}

/**
 * Por qué un tipo no aplica al plan. `null` si aplica.
 *
 * El motivo nombra lo que el tipo espera y, si se sabe, lo que el plan tiene:
 * «Es para viviendas; el plan tiene cursos-horario».
 */
export function motivoIncompatible(
  preset: Pick<MaterialCatalogPreset, "compatible" | "compatible_unit_types">,
  unitTypeDelPlan: string | null | undefined,
): string | null {
  if (preset.compatible) return null;
  const espera = preset.compatible_unit_types.length
    ? `Es para ${preset.compatible_unit_types.map((t) => tipoDeUnidad(t).toLowerCase()).join(" o ")}`
    : "No aplica a estas unidades";
  if (!unitTypeDelPlan) return `${espera}.`;
  return `${espera}; el plan tiene ${tipoDeUnidad(unitTypeDelPlan).toLowerCase()}.`;
}

/** Páginas que el inspector enseña: lo que declara el tipo o lo que dijo la vista previa. */
export function paginasDelTipo(preset: MaterialCatalogPreset, paginasDeLaVista?: number | null): number {
  return Math.max(preset.pages_per_unit, preset.faces, paginasDeLaVista ?? 0, 1);
}

/** Qué tarjeta se elige al abrir: la activa, si no la primera compatible, si no la primera. */
export function seleccionInicial(presets: readonly MaterialCatalogPreset[]): string | null {
  return (
    presets.find((p) => p.active)?.preset_id
    ?? presets.find((p) => p.compatible)?.preset_id
    ?? presets[0]?.preset_id
    ?? null
  );
}

/** Clave de la caché de miniaturas. */
export function claveDeVista(presetId: string, page: number): string {
  return `${presetId}#${page}`;
}

/**
 * Páginas que la galería necesita para pintar una tarjeta: la primera y, si el
 * tipo tiene dorso, la segunda (va detrás, rotada).
 */
export function paginasDeLaTarjeta(preset: MaterialCatalogPreset): number[] {
  return preset.faces === 2 ? [1, 2] : [1];
}
