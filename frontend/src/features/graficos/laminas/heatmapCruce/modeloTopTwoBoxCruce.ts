// Columna Top Two Box del «Mapa de calor por cruce» (ADR 0137). `p_heatmap_cruce()` no tiene `top2box` ni
// `top2box_labels` como formales: el motor los lee de `overrides` (graficos_heatmap_top2box.R, `[[` exacto). Así que aquí
// se leen y se escriben sólo ahí. Vacío es automático: encendida si la escala es ordinal de cuatro puntos o más; con
// categorías declaradas, encendida en cualquier escala que el criterio admita; `top2box = FALSE` la apaga. Módulo puro.

export type ModoTopTwoBoxCruce = "auto" | "si" | "no";

export type TopTwoBoxCruce = { modo: ModoTopTwoBoxCruce; etiquetas: string[] };

type Args = Readonly<Record<string, unknown>>;

const esRegistro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function overridesDe(args: Args): Record<string, unknown> {
  return esRegistro(args.overrides) ? args.overrides : {};
}

function etiquetasDe(v: unknown): string[] {
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return lista
    .map((x) => (typeof x === "string" || typeof x === "number" ? String(x).trim() : ""))
    .filter(Boolean);
}

/** Lo que la lámina dibuja hoy: `overrides` manda, como en el motor. */
export function leerTopTwoBoxCruce(args: Args): TopTwoBoxCruce {
  const ov = overridesDe(args);
  const on = ov.top2box;
  const modo: ModoTopTwoBoxCruce = on === false || on === "false" ? "no" : on === true || on === "true" ? "si" : "auto";
  return { modo, etiquetas: etiquetasDe(ov.top2box_labels) };
}

/** El parche de `overrides` para un cambio de modo o de categorías; lo vacío se borra para que rija el automático. */
export function parcheTopTwoBoxCruce(args: Args, cambio: Partial<TopTwoBoxCruce>): { overrides: Record<string, unknown> | null } {
  const overrides: Record<string, unknown> = { ...overridesDe(args) };
  if (cambio.modo !== undefined) {
    if (cambio.modo === "auto") delete overrides.top2box;
    else overrides.top2box = cambio.modo === "si";
  }
  if (cambio.etiquetas !== undefined) {
    const etiquetas = etiquetasDe(cambio.etiquetas);
    if (etiquetas.length) overrides.top2box_labels = etiquetas;
    else delete overrides.top2box_labels;
  }
  return { overrides: Object.keys(overrides).length ? overrides : null };
}

/** Estado de la columna que se dice bajo el control (no ayuda: lo que pasará en la lámina). */
export function estadoTopTwoBoxCruce(t: TopTwoBoxCruce): string | null {
  if (t.modo === "no") return null;
  if (t.modo === "si" && t.etiquetas.length === 0) return "Sin categorías elegidas la columna no sale y la lámina lo avisa.";
  return null;
}
