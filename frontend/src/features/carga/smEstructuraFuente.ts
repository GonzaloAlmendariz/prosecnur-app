/**
 * Diagnóstico de estructura de una fuente SurveyMonkey (ADR 0094).
 *
 * Una fuente se empareja con la base pregunta por pregunta, con la misma clave
 * que usa Equivalencias (ADR 0062). Este módulo traduce lo que el motor
 * devuelve (`kind`/`severity` de cada diferencia) a texto legible para el
 * diagnóstico del refresh y para la auditoría del wizard de fuentes
 * independientes. Sin React: todo lo que puede equivocarse se prueba aquí.
 */
import type {
  EstudioPayload,
  SurveyMonkeyMultibaseDiff,
  SurveyMonkeyRefreshBasePlan,
} from "../../api/client";
import { equivalenciasDisponibles } from "./CargaWorkspaceModel";

/** Qué hacer cuando una fuente resulta ser otro instrumento. */
export const SM_ACCION_INSTRUMENTO_DISTINTO =
  "Impórtala como base separada y relaciónala en Equivalencias.";

/** Qué hacer con una base que juntó encuestas por posición, antes del ADR 0094. */
export const SM_ACCION_BASE_POR_POSICION =
  "Regénerala desde SurveyMonkey para corregir las respuestas que ya estaban.";

const SM_DIFF_KIND_LABELS: Readonly<Record<string, string>> = {
  missing_or_extra: "Variables propias",
  structure: "Estructura distinta",
  options: "Opciones distintas",
  wording: "Fraseo distinto",
  company_list: "Lista de empresas",
  company_logic: "Lógica de empresas",
  metadata_optional: "Metadata opcional",
  question_order: "Preguntas en otro orden",
  unpaired_source: "Preguntas de la fuente sin par",
  unpaired_base: "Preguntas de la base sin par",
  ambiguous: "Preguntas ambiguas",
  different_instrument: "Instrumento distinto",
  legacy_positional: "Base armada por posición",
};

/** Kinds de emparejado que se agrupan por tipo en vez de «Revisar …». */
const SM_UNPAIRED_KINDS = ["unpaired_source", "unpaired_base", "ambiguous"] as const;

/** Bloqueos que son UNA decisión sobre la fuente o la base, no variables rotas. */
const SM_DECISION_KINDS = ["legacy_positional", "different_instrument"] as const;

export function smDiffKindLabel(kind: string): string {
  return SM_DIFF_KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/**
 * El motor marca `question_order` como informativo; el tipo heredado de la API
 * solo declara `blocking | review | special`, así que se compara como texto.
 */
export function smDiffSeverityLabel(severity: string, kind?: string): string {
  if (kind === "question_order" || severity === "info") return "Informativo";
  if (severity === "blocking") return "Estructura";
  if (severity === "special") return "Especial";
  return "Revisión";
}

export function smDiffAccion(kind: string): string | null {
  if (kind === "different_instrument") return SM_ACCION_INSTRUMENTO_DISTINTO;
  if (kind === "legacy_positional") return SM_ACCION_BASE_POR_POSICION;
  return null;
}

export function smTieneInstrumentoDistinto(
  diffs: readonly Pick<SurveyMonkeyMultibaseDiff, "kind">[] | null | undefined,
): boolean {
  return (diffs ?? []).some((diff) => diff.kind === "different_instrument");
}

export function smRefreshAction(row: SurveyMonkeyRefreshBasePlan): string {
  if (row.refresh_action) return row.refresh_action;
  return row.updateable ? "update" : "blocked";
}

function smDiffRef(diff: SurveyMonkeyMultibaseDiff): string {
  // Los diffs de fuente entera (otro instrumento, base por posición) no tienen
  // posición: nunca «pos. null».
  if (diff.variable) return diff.variable;
  return typeof diff.pos === "number" && diff.pos > 0 ? `pos. ${diff.pos}` : "";
}

function smDiffTitle(diffs: readonly SurveyMonkeyMultibaseDiff[]): string {
  return diffs
    .map((diff) => `${smDiffRef(diff)}: ${smDiffKindLabel(diff.kind)} - ${diff.message}`)
    .join(" · ");
}

/** «a, b, c +2»: los primeros nombres y cuántos quedan. */
export function smListaAcotada(values: readonly string[], max = 3): string {
  const clean = values.filter(Boolean);
  const visible = clean.slice(0, max).join(", ");
  return clean.length > max ? `${visible} +${clean.length - max}` : visible;
}

export function smRefreshStructureDetail(
  row: SurveyMonkeyRefreshBasePlan,
): { label: string; title: string } | null {
  const diffs = row.structure?.diffs ?? [];
  const blocking = diffs.filter((diff) => diff.severity === "blocking");
  const warningOnly = smRefreshAction(row) === "noop_structure_warning" || row.structure_warning_only === true;
  if (blocking.length) {
    // Otro instrumento o una base armada por posición no son listas de
    // variables rotas: son una sola decisión.
    for (const kind of SM_DECISION_KINDS) {
      const decision = blocking.filter((diff) => diff.kind === kind);
      if (decision.length) return { label: smDiffKindLabel(kind), title: smDiffTitle(decision) };
    }
    const vars = blocking.map(smDiffRef).filter(Boolean);
    const visible = smListaAcotada(vars, 4);
    return {
      label: warningOnly ? `Revisar si llegan nuevas: ${visible}` : `Bloqueos en ${visible}`,
      title: smDiffTitle(blocking),
    };
  }
  if (row.issues?.length) {
    return {
      label: row.issues.join(" · "),
      title: row.issues.join(" · "),
    };
  }
  const review = diffs.filter((diff) => diff.severity === "review");
  if (review.length) {
    const metadataReview = review.filter((diff) => diff.kind === "metadata_optional");
    const substantiveReview = review.filter((diff) => diff.kind !== "metadata_optional");
    const unpaired = SM_UNPAIRED_KINDS
      .map((kind) => ({ kind, vars: substantiveReview.filter((diff) => diff.kind === kind).map(smDiffRef) }))
      .filter((group) => group.vars.length > 0);
    const otherReview = substantiveReview.filter(
      (diff) => !(SM_UNPAIRED_KINDS as readonly string[]).includes(diff.kind),
    );
    const metadataVars = metadataReview.map(smDiffRef).filter(Boolean);
    const segments: string[] = unpaired.map(
      (group) => `${smDiffKindLabel(group.kind)}: ${smListaAcotada(group.vars)}`,
    );
    if (otherReview.length) {
      segments.push(`Revisar ${smListaAcotada(otherReview.map(smDiffRef))}`);
    }
    if (!substantiveReview.length) {
      segments.push(`Metadata opcional ${smListaAcotada(metadataVars)}`);
    } else if (metadataReview.length) {
      segments.push(`metadata opcional ${smListaAcotada(metadataVars)}`);
    }
    return { label: segments.join(" · "), title: smDiffTitle(review) };
  }
  // Emparejada en otro orden: informativo, no pide nada.
  const reordered = diffs.filter((diff) => diff.kind === "question_order");
  if (reordered.length) {
    return { label: smDiffKindLabel("question_order"), title: smDiffTitle(reordered) };
  }
  return null;
}

/**
 * ¿Existe hoy la pestaña Equivalencias? Espejo del predicado de `CargaPage`
 * (ADR 0061/0062): bases declaradas separadas o independientes y más de una
 * base primaria. Si no existe, el enlace llevaría a una pestaña que el rail no
 * lista, así que solo se ofrece el texto.
 *
 * Fuente única: `equivalencias.disponible` de `GET /api/carga/fuentes/emparejamiento`
 * (`api/cargaFuentes.ts`), que el backend calcula con el predicado de la
 * pestaña. Quien ya tenga ese payload lo usa y no llama a esta copia; queda
 * solo para el diagnóstico del refresh (`SmEstructuraFuenteAccion`), que no lo
 * pide.
 */
export function equivalenciasDisponibleEnEstudio(
  estudio: Pick<EstudioPayload, "topology_declared" | "processing_mode" | "bases"> | null | undefined,
): boolean {
  if (!estudio) return false;
  const primarias = Object.values(estudio.bases ?? {}).filter(
    (base) => base.source_kind !== "kobo_repeat" && !base.parent_base,
  );
  return equivalenciasDisponibles({
    topologiaDeclarada: estudio.topology_declared ?? null,
    modoProcesamiento: estudio.processing_mode ?? null,
    basesPrimarias: primarias.length,
  });
}
