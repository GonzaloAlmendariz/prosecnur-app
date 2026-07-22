import type {
  EstudioProcessingSuggestionGroup,
  ProcessingIntakeBindingInput,
  ProcessingIntakeEntry,
  ProcessingIntakeRevision,
  ProcessingIntakeStatus,
} from "../../api/client";

export type ProcessingIntakeStatusView = {
  label: string;
  detail: string;
  tone: "ready" | "warning" | "danger" | "info";
};

export type ProcessingIntakeGuidedLink = {
  actor_key: string;
  actor: string;
  suggestion: EstudioProcessingSuggestionGroup;
  status: "ready" | "missing" | "ambiguous";
  revision: ProcessingIntakeRevision | null;
  detail: string;
};

export type ProcessingIntakeGuidedPlan = {
  ready: boolean;
  links: ProcessingIntakeGuidedLink[];
};

const STATUS_VIEW: Record<ProcessingIntakeStatus, ProcessingIntakeStatusView> = {
  instrument_ready: {
    label: "Instrumento listo",
    detail: "La revisión está fijada; los datos siguen pendientes.",
    tone: "ready",
  },
  data_preview_ready: {
    label: "Datos listos para revisar",
    detail: "Existe un preview vigente antes de crear la base.",
    tone: "info",
  },
  stale: {
    label: "Revisión desactualizada",
    detail: "Hay una revisión publicada más reciente. La selección no cambió.",
    tone: "warning",
  },
  blocked: {
    label: "Bloqueado",
    detail: "El instrumento seleccionado necesita revisión.",
    tone: "danger",
  },
  materialized: {
    label: "Base creada",
    detail: "El par instrumento y datos ya fue materializado.",
    tone: "ready",
  },
};

export function processingIntakeStatusView(status: ProcessingIntakeStatus): ProcessingIntakeStatusView {
  return STATUS_VIEW[status];
}

export function processingIntakeBindingInput(
  entry: ProcessingIntakeEntry | ProcessingIntakeBindingInput,
): ProcessingIntakeBindingInput {
  return {
    entry_id: entry.entry_id,
    base: entry.base,
    base_label: entry.base_label,
    actor_key: entry.actor_key,
    actor: entry.actor,
    instrument_revision_id: entry.instrument_revision_id,
  };
}

export function processingIntakeBindingFingerprint(
  entry: ProcessingIntakeEntry | ProcessingIntakeBindingInput,
): string {
  const input = processingIntakeBindingInput(entry);
  return JSON.stringify([
    input.entry_id,
    input.base,
    input.base_label,
    input.actor_key,
    input.actor,
    input.instrument_revision_id,
  ]);
}

/**
 * Crea identidades técnicas solo desde un UUID. Los nombres visibles pueden
 * renombrarse sin alterar `entry_id`, `base` ni `actor_key`.
 */
export function newProcessingIntakeBinding(
  id: string,
  suggestion?: Pick<EstudioProcessingSuggestionGroup, "actor_key" | "actor" | "recommended_base_name">,
): ProcessingIntakeBindingInput {
  const technicalId = id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "entry";
  return {
    entry_id: id,
    base: `base_${technicalId}`,
    base_label: suggestion?.recommended_base_name || suggestion?.actor || "Nueva base",
    actor_key: suggestion?.actor_key || `actor_${technicalId}`,
    actor: suggestion?.actor || "Nuevo actor",
    instrument_revision_id: "",
  };
}

export function processingIntakeRevisionLabel(revision: ProcessingIntakeRevision): string {
  const name = revision.form_name || revision.form_id || "Formulario";
  const current = revision.is_latest ? " · vigente" : " · histórica";
  return `${name} · rev. ${revision.revision_no}${current}`;
}

export function processingIntakeResolvedEntry(
  draft: ProcessingIntakeBindingInput,
  validatedEntries: ProcessingIntakeEntry[],
  persistedEntries: ProcessingIntakeEntry[],
): ProcessingIntakeEntry | null {
  const fingerprint = processingIntakeBindingFingerprint(draft);
  return validatedEntries.find(
    (entry) => processingIntakeBindingFingerprint(entry) === fingerprint,
  ) ?? persistedEntries.find(
    (entry) => processingIntakeBindingFingerprint(entry) === fingerprint,
  ) ?? null;
}

export function processingIntakeEntryFormId(
  entry: ProcessingIntakeEntry | null,
  revisions: ProcessingIntakeRevision[],
  revisionId: string,
): string {
  if (entry?.form_id) return entry.form_id;
  return revisions.find((revision) => revision.revision_id === revisionId)?.form_id ?? "";
}

export function processingIntakeSuggestedGroups(
  groups: EstudioProcessingSuggestionGroup[],
  entries: ProcessingIntakeBindingInput[],
): EstudioProcessingSuggestionGroup[] {
  const used = new Set(entries.map((entry) => entry.actor_key));
  return groups.filter((group) => group.actor_key && !used.has(group.actor_key));
}

export function processingIntakePlanComplete(
  entries: ProcessingIntakeEntry[],
  groups: EstudioProcessingSuggestionGroup[],
): boolean {
  if (entries.length === 0 || entries.some((entry) => entry.status !== "materialized")) {
    return false;
  }
  const materializedActors = new Set(entries.map((entry) => entry.actor_key).filter(Boolean));
  const expectedActors = Array.from(new Set(groups.map((group) => group.actor_key).filter(Boolean)));
  return expectedActors.every((actorKey) => materializedActors.has(actorKey));
}

/**
 * Vincula actores e instrumentos únicamente por actor_key explícito. La
 * revisión vigente y disponible gana sobre revisiones históricas; cualquier
 * empate real queda para resolución humana en el Editor.
 */
export function processingIntakeGuidedPlan(
  groups: EstudioProcessingSuggestionGroup[],
  revisions: ProcessingIntakeRevision[],
): ProcessingIntakeGuidedPlan {
  const groupsByActor = new Map<string, EstudioProcessingSuggestionGroup[]>();
  for (const group of groups) {
    if (!group.actor_key) continue;
    groupsByActor.set(group.actor_key, [...(groupsByActor.get(group.actor_key) ?? []), group]);
  }

  const links = Array.from(groupsByActor.entries()).map(([actorKey, actorGroups]): ProcessingIntakeGuidedLink => {
    const suggestion = actorGroups[0];
    if (actorGroups.length !== 1) {
      return {
        actor_key: actorKey,
        actor: suggestion.actor,
        suggestion,
        status: "ambiguous",
        revision: null,
        detail: "Monitoreo devolvió más de un actor con la misma clave. Revísalo antes de vincular.",
      };
    }

    const exact = revisions.filter((revision) => revision.source?.actor_key === actorKey);
    const available = exact.filter((revision) => revision.available);
    const latestAvailable = available.filter((revision) => revision.is_latest);
    const selected = latestAvailable.length === 1
      ? latestAvailable[0]
      : latestAvailable.length === 0 && available.length === 1
        ? available[0]
        : null;

    if (selected) {
      return {
        actor_key: actorKey,
        actor: suggestion.actor,
        suggestion,
        status: "ready",
        revision: selected,
        detail: `Vínculo exacto con ${processingIntakeRevisionLabel(selected)}.`,
      };
    }

    if (available.length > 1 || latestAvailable.length > 1) {
      return {
        actor_key: actorKey,
        actor: suggestion.actor,
        suggestion,
        status: "ambiguous",
        revision: null,
        detail: "Hay más de una revisión disponible para esta clave de actor. Corrige la asignación en el Editor.",
      };
    }

    return {
      actor_key: actorKey,
      actor: suggestion.actor,
      suggestion,
      status: "missing",
      revision: null,
      detail: exact.length > 0
        ? "El actor está asignado, pero no tiene una revisión publicada disponible."
        : "Ninguna revisión publicada tiene esta clave de actor.",
    };
  });

  return {
    ready: links.length > 0 && links.every((link) => link.status === "ready"),
    links,
  };
}

export function processingIntakeEntriesFromGuidedPlan(
  plan: ProcessingIntakeGuidedPlan,
  existing: ProcessingIntakeBindingInput[],
  newId: () => string,
): ProcessingIntakeBindingInput[] {
  return plan.links.flatMap((link) => {
    if (link.status !== "ready" || !link.revision) return [];
    const current = existing.find((entry) => entry.actor_key === link.actor_key);
    if (current) {
      return [{
        ...current,
        actor: link.actor,
        instrument_revision_id: link.revision.revision_id,
      }];
    }
    return [{
      ...newProcessingIntakeBinding(newId(), link.suggestion),
      instrument_revision_id: link.revision.revision_id,
    }];
  });
}

export function processingIntakeDraftValid(entries: ProcessingIntakeBindingInput[]): boolean {
  const entryIds = new Set<string>();
  const bases = new Set<string>();
  const actorKeys = new Set<string>();
  for (const entry of entries) {
    if (
      !entry.entry_id
      || !entry.base
      || !entry.base_label.trim()
      || !entry.actor_key
      || !entry.actor.trim()
      || !entry.instrument_revision_id
      || entryIds.has(entry.entry_id)
      || bases.has(entry.base)
      || actorKeys.has(entry.actor_key)
    ) return false;
    entryIds.add(entry.entry_id);
    bases.add(entry.base);
    actorKeys.add(entry.actor_key);
  }
  return true;
}
