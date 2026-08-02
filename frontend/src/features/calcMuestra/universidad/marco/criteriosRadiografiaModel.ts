import type {
  CalcMuestraAulasCriterioRadiografiaFila,
  CalcMuestraAulasCriterioRadiografiaV2Family,
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriteriosRadiografia,
  CriterioScope,
  CriteriosCatalogo,
} from "../../../../api/client";
import { CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA } from "../../../../api/client";

export const MIN_ELIGIBLE_CARD_ID = "minEligible";
export const COMPOSITION_CARD_ID = "composition";
export const COMPOSITION_GATE_IDS = ["c7", "c8_facultad", "c8"] as const;

export type CriterioRadiografiaCardState =
  | "v2"
  | "v1"
  | "legacy"
  | "sin_dato"
  | "no_aplica"
  | "invalido";

export type CriterioRadiografiaCardDescriptor = {
  cardId: string;
  label: string;
  scope: CriterioScope;
  kind: string;
  gateIds: string[];
  source: "catalogo" | "extra";
  expectedFamily: CalcMuestraAulasCriterioRadiografiaV2Family | null;
};

export type CriterioRadiografiaCard = CriterioRadiografiaCardDescriptor & {
  state: CriterioRadiografiaCardState;
  entries: CalcMuestraAulasCriterioRadiografiaV2Entry[];
  v1Rows: CalcMuestraAulasCriterioRadiografiaFila[];
  issue?: string;
};

export type CriteriosRadiografiaModel = {
  cards: CriterioRadiografiaCard[];
  expectedCardIds: string[];
  expectedGateIds: string[];
  orphanGateIds: string[];
  duplicateCardIds: string[];
  sourceInvalid: boolean;
};

export const LEGACY_CLASSROOM_CARD_IDS = new Set([
  "session_type",
  "condicion_curso",
  "course_level",
  MIN_ELIGIBLE_CARD_ID,
]);

function denominator(catalogo: CriteriosCatalogo): {
  descriptors: CriterioRadiografiaCardDescriptor[];
  duplicates: Set<string>;
} {
  const descriptors: CriterioRadiografiaCardDescriptor[] = [];
  const positions = new Map<string, number>();
  const duplicates = new Set<string>();

  for (const variable of catalogo.variables) {
    if (positions.has(variable.id)) {
      duplicates.add(variable.id);
      continue;
    }
    positions.set(variable.id, descriptors.length);
    descriptors.push({
      cardId: variable.id,
      label: variable.label,
      scope: variable.scope,
      kind: variable.kind,
      gateIds: [variable.id],
      source: "catalogo",
      expectedFamily: familyForCatalogVariable(variable.scope, variable.kind),
    });
  }

  const extras: CriterioRadiografiaCardDescriptor[] = [
    {
      cardId: MIN_ELIGIBLE_CARD_ID,
      label: "Elegibles por curso-horario",
      scope: "aula",
      kind: "gate",
      gateIds: [MIN_ELIGIBLE_CARD_ID],
      source: "extra",
      expectedFamily: "threshold_gate",
    },
    {
      cardId: COMPOSITION_CARD_ID,
      label: "Composición del curso-horario",
      scope: "aula",
      kind: "gate",
      gateIds: [...COMPOSITION_GATE_IDS],
      source: "extra",
      expectedFamily: "proportion_gate",
    },
  ];
  for (const extra of extras) {
    if (positions.has(extra.cardId)) {
      duplicates.add(extra.cardId);
      continue;
    }
    positions.set(extra.cardId, descriptors.length);
    descriptors.push(extra);
  }
  return { descriptors, duplicates };
}

function familyForCatalogVariable(
  scope: CriterioScope,
  kind: string,
): CalcMuestraAulasCriterioRadiografiaV2Family | null {
  if (scope === "alumno") {
    if (kind === "flat") return "student_flat";
    if (kind === "numeric") return "student_numeric";
    if (kind === "ordinal") return "student_ordinal";
    return null;
  }
  if (kind === "flat") return "classroom_flat";
  if (kind === "hierarchical") return "classroom_hierarchical";
  if (kind === "range") return "classroom_range";
  if (kind === "numeric") return "classroom_numeric";
  return null;
}

function stateForV2(
  descriptor: CriterioRadiografiaCardDescriptor,
  entries: CalcMuestraAulasCriterioRadiografiaV2Entry[],
  duplicate: boolean,
): { state: CriterioRadiografiaCardState; issue?: string } {
  if (duplicate) return { state: "invalido", issue: "El denominador declara esta tarjeta más de una vez." };
  if (entries.length !== descriptor.gateIds.length) {
    return { state: "invalido", issue: "Faltan gates del contrato analítico para esta tarjeta." };
  }
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    return { state: "invalido", issue: "El contrato repite un gate dentro de esta tarjeta." };
  }
  if (entries.some((entry) => entry.card_id !== descriptor.cardId || entry.scope !== descriptor.scope)) {
    return { state: "invalido", issue: "El gate no pertenece a la tarjeta o scope declarado." };
  }
  if (!descriptor.expectedFamily || entries.some((entry) => entry.family !== descriptor.expectedFamily)) {
    return { state: "invalido", issue: "La familia del gate no coincide con el kind del catálogo." };
  }
  if (entries.some((entry) => entry.status === "invalido")) {
    return { state: "invalido", issue: "El engine publicó una fila o metadato inválido." };
  }
  if (entries.every((entry) => entry.status === "sin_senal")) return { state: "sin_dato" };
  if (entries.every((entry) => entry.status === "no_aplica")) return { state: "no_aplica" };
  return { state: "v2" };
}

export function buildCriteriosRadiografiaModel({
  catalogo,
  radiografia,
  rawPresent = false,
  legacyCardIds = new Set<string>(),
}: {
  catalogo: CriteriosCatalogo;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  /** Distingue ausencia legítima de un sibling presente que falló normalización. */
  rawPresent?: boolean;
  /** Cards con un resumen histórico real, nunca inferido desde el catálogo. */
  legacyCardIds?: ReadonlySet<string>;
}): CriteriosRadiografiaModel {
  const { descriptors, duplicates } = denominator(catalogo);
  const expectedGateToCard = new Map<string, string>();
  for (const descriptor of descriptors) {
    for (const gateId of descriptor.gateIds) expectedGateToCard.set(gateId, descriptor.cardId);
  }

  const isV2 = radiografia?.schema === CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA;
  const entries = isV2 ? radiografia.criterios : [];
  const orphanGateIds = isV2
    ? entries
      .filter((entry) => expectedGateToCard.get(entry.id) !== entry.card_id)
      .map((entry) => entry.id)
    : [];
  const sourceInvalid = rawPresent && radiografia == null;

  const cards = descriptors.map((descriptor): CriterioRadiografiaCard => {
    const duplicate = duplicates.has(descriptor.cardId);
    if (sourceInvalid) {
      return {
        ...descriptor,
        state: "invalido",
        entries: [],
        v1Rows: [],
        issue: "El sibling de radiografía está presente, pero su root no cumple el contrato.",
      };
    }
    if (isV2) {
      const cardEntries = entries.filter((entry) => descriptor.gateIds.includes(entry.id));
      const state = stateForV2(descriptor, cardEntries, duplicate);
      return { ...descriptor, ...state, entries: cardEntries, v1Rows: [] };
    }
    if (duplicate) {
      return {
        ...descriptor,
        state: "invalido",
        entries: [],
        v1Rows: [],
        issue: "El denominador declara esta tarjeta más de una vez.",
      };
    }
    if (descriptor.cardId === "session_type" && radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v1") {
      return { ...descriptor, state: "v1", entries: [], v1Rows: radiografia.filas };
    }
    if (legacyCardIds.has(descriptor.cardId)) {
      return { ...descriptor, state: "legacy", entries: [], v1Rows: [] };
    }
    return { ...descriptor, state: "sin_dato", entries: [], v1Rows: [] };
  });

  return {
    cards,
    expectedCardIds: descriptors.map((descriptor) => descriptor.cardId),
    expectedGateIds: descriptors.flatMap((descriptor) => descriptor.gateIds),
    orphanGateIds,
    duplicateCardIds: [...duplicates],
    sourceInvalid,
  };
}

export function criterioCardsForScope(
  model: CriteriosRadiografiaModel,
  scope: CriterioScope,
): CriterioRadiografiaCard[] {
  return model.cards.filter((card) => card.scope === scope);
}
