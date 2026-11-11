// Menú de plantillas de la pestaña Plantillas. Cada plantilla es un punto de partida completo: estructura del informe,
// identidad y reglas. Sólo están las que producen un informe completo con el motor de hoy; las de arranque con espacios
// vacíos del catálogo del backend (`.TEMPLATES_META`) quedan fuera hasta comprobarlas
// (checklist-pestana-plantillas-2026-11-11, decisiones por defecto).

export type GrupoPlantilla = "cliente" | "pulso" | "cero";

export type PlantillaInforme = {
  id: string;
  nombre: string;
  descripcion: string;
  grupo: GrupoPlantilla;
  /** Campos que la plantilla agrega a la config al pedir la estructura y el plan. */
  config: Record<string, unknown>;
  /** Pide Hojas de ruta y Monitoreo territorial (mapas de cobertura). */
  requiereTerritorio?: boolean;
  /** No arma preguntas: deja portada e índice y el resto se arma en Láminas. */
  enBlanco?: boolean;
  /** Muestra en miniatura: color de las barras y del título. */
  muestra: { barras: string; titulo: string };
};

export const ROTULO_GRUPO: Record<GrupoPlantilla, string> = {
  cliente: "Informes de cliente",
  pulso: "Informes Pulso",
  cero: "Desde cero",
};

const ACNUR = { barras: "var(--plantilla-marca-acnur)", titulo: "var(--pulso-text)" };
const PULSO = { barras: "var(--pulso-brand-navy)", titulo: "var(--plantilla-marca-coral)" };

export const PLANTILLAS_INFORME: readonly PlantillaInforme[] = [
  {
    id: "acnur",
    nombre: "ACNUR general",
    descripcion: "Plantilla ACNUR, una pregunta por lámina, con decimales",
    grupo: "cliente",
    config: { profile_id: "acnur_kobo_cruncher_plus", acnur_mode: "general", include_coverage_maps: false, comparison_mode: "none" },
    muestra: ACNUR,
  },
  {
    id: "acnur-territorial",
    nombre: "ACNUR territorial",
    descripcion: "Lo anterior con mapas de cobertura y comparación por distrito",
    grupo: "cliente",
    config: { profile_id: "acnur_kobo_cruncher_plus", acnur_mode: "territorial", include_coverage_maps: true, comparison_mode: "paired_district" },
    requiereTerritorio: true,
    muestra: ACNUR,
  },
  {
    id: "pulso",
    nombre: "Informe Pulso",
    descripcion: "Identidad Pulso; las baterías de una misma escala van juntas",
    grupo: "pulso",
    config: {},
    muestra: PULSO,
  },
  {
    id: "blanco",
    nombre: "En blanco",
    descripcion: "Portada e índice; las láminas se arman a mano",
    grupo: "cero",
    config: {},
    enBlanco: true,
    muestra: { barras: "var(--pulso-text-faint)", titulo: "var(--pulso-text-faint)" },
  },
];

export function plantillaPorId(id: string | undefined | null): PlantillaInforme | undefined {
  return PLANTILLAS_INFORME.find((p) => p.id === id);
}

/** La de partida: la que el proyecto ya eligió o, si no, ACNUR cuando el proyecto es de ACNUR y Pulso en otro caso. */
export function plantillaInicial(elegida: unknown, identidadProyecto: string): PlantillaInforme {
  const previa = plantillaPorId(typeof elegida === "string" ? elegida : null);
  if (previa) return previa;
  return /\b(?:ACNUR|UNHCR)\b/i.test(identidadProyecto) ? PLANTILLAS_INFORME[0] : PLANTILLAS_INFORME[2];
}
