// Pasos del asistente de fuentes independientes (L6, maqueta m/L06-wizard-stepper).
//
// Son los bloques que el asistente ya tenía apilados, en el orden en que se
// usan: la plantilla de referencia, la familia ya cargada, el catálogo con el
// alcance por encuesta y la auditoría con su importación. La maqueta dibuja
// seis; el código no separa perfil de catálogo ni alcance de selección, así
// que el stepper muestra los cuatro que existen.

import type { StageStepperItem } from "../../../components/StageStepper";

export type PasoIndependiente = "referencia" | "familia" | "catalogo" | "auditar";

export type EstadoAsistente = {
  hayReferencia: boolean;
  hayFamilia: boolean;
  muestraCatalogo: boolean;
  hayAuditoria: boolean;
};

/** Dónde aterriza el asistente si nadie eligió paso: lo más avanzado que ya tiene contenido. */
export function pasoSugerido(estado: EstadoAsistente): PasoIndependiente {
  if (estado.hayAuditoria) return "auditar";
  if (estado.muestraCatalogo) return "catalogo";
  if (estado.hayFamilia) return "familia";
  return "referencia";
}

/** El paso elegido, salvo que ya no tenga qué mostrar: entonces el sugerido. */
export function pasoVigente(elegido: PasoIndependiente | null, estado: EstadoAsistente): PasoIndependiente {
  if (!elegido) return pasoSugerido(estado);
  if (elegido === "familia" && !estado.hayFamilia) return pasoSugerido(estado);
  if (elegido === "catalogo" && !estado.muestraCatalogo) return pasoSugerido(estado);
  if (elegido === "auditar" && !estado.hayAuditoria && !estado.muestraCatalogo) return pasoSugerido(estado);
  return elegido;
}

export function pasosDelAsistente(estado: EstadoAsistente): StageStepperItem<PasoIndependiente>[] {
  return [
    { key: "referencia", label: "Referencia", description: "Plantilla para las reglas compartidas", completed: estado.hayReferencia },
    {
      key: "familia",
      label: "Familia cargada",
      description: "Bases que ya existen",
      completed: estado.hayFamilia,
      disabled: !estado.hayFamilia,
      disabledReason: "Todavía no hay bases importadas",
    },
    {
      key: "catalogo",
      label: "Catálogo y alcance",
      description: "Encuestas, colectores y rango",
      disabled: !estado.muestraCatalogo,
      disabledReason: "Abre el catálogo con «Agregar encuestas» en Familia cargada",
    },
    {
      key: "auditar",
      label: "Auditar e importar",
      description: "Una base por encuesta",
      completed: estado.hayAuditoria,
      disabled: !estado.hayAuditoria && !estado.muestraCatalogo,
      disabledReason: "Primero elige encuestas en el catálogo",
    },
  ];
}
