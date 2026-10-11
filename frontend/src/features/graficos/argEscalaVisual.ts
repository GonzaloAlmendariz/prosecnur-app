import type { ArgMetadata } from "../../api/graficos";

/**
 * Cómo se muestra un número del catálogo de args en el campo: con qué factor se pinta y con qué unidad.
 *
 * La unidad declarada en el catálogo manda. Un umbral declarado en `"%"` (o en puntos) ya viene en 0–100 y se pinta
 * tal cual: «80 %», no «8000 %». Uno declarado en `"proporción"` viene en 0–1 y se pinta como porcentaje (×100).
 * Sólo cuando el catálogo no declara unidad se cae a la convención de nombres heredada (`umbral_*` sin `_pct` es una
 * proporción); nunca se decide por la magnitud del valor.
 */
export type EscalaVisualArg = {
  /** Factor entre el valor guardado y el que ve el analista (`visto = guardado * escala`). */
  escala: number;
  /** Sufijo que acompaña al número en el campo; `undefined` si no lleva. */
  unidad?: string;
};

function esNombreDeUmbral(meta: ArgMetadata): boolean {
  const name = String(meta.name ?? "").toLowerCase();
  return name.startsWith("umbral_") || name.includes("_umbral_") || name.includes("_threshold");
}

function esProporcion(unidad: string): boolean {
  return unidad.startsWith("propor");
}

export function escalaVisualDeArg(meta: ArgMetadata): EscalaVisualArg {
  const declarada = String(meta.unidad ?? "").trim();
  const unidad = declarada.toLowerCase();
  if (unidad) {
    // Declarada en «%», «pp» o cualquier otra unidad que no sea proporción: el valor ya está en lo que ve el analista.
    if (esProporcion(unidad) && esNombreDeUmbral(meta)) return { escala: 100, unidad: "%" };
    return { escala: 1, unidad: declarada };
  }
  const name = String(meta.name ?? "").toLowerCase();
  if (esNombreDeUmbral(meta) && !name.endsWith("_pct")) return { escala: 100, unidad: "%" };
  return { escala: 1 };
}

/** El campo pinta el valor como porcentaje de una proporción guardada en 0–1. */
export function seMuestraComoPorcentajeDeProporcion(meta: ArgMetadata): boolean {
  return escalaVisualDeArg(meta).escala === 100;
}
