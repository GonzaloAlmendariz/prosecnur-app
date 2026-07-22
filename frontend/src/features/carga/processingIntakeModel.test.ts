import { describe, expect, test } from "vitest";
import type {
  EstudioProcessingSuggestionGroup,
  ProcessingIntakeEntry,
  ProcessingIntakeRevision,
} from "../../api/client";
import {
  newProcessingIntakeBinding,
  processingIntakeBindingFingerprint,
  processingIntakeDraftValid,
  processingIntakeEntriesFromGuidedPlan,
  processingIntakeEntryFormId,
  processingIntakeGuidedPlan,
  processingIntakePlanComplete,
  processingIntakeResolvedEntry,
  processingIntakeRevisionLabel,
  processingIntakeStatusView,
  processingIntakeSuggestedGroups,
} from "./processingIntakeModel";

const revision: ProcessingIntakeRevision = {
  schema: "instrument_revision/v1",
  revision_id: "rev-1",
  form_id: "form-1",
  revision_no: 1,
  content_sha256: "hash",
  xlsform_file_id: "file-1",
  published_at: "2026-07-20T12:00:00Z",
  form_name: "Encuesta Docentes",
  source_label: "SurveyMonkey",
  source: { kind: "surveymonkey", original_name: "Docentes", actor_key: "docentes" },
  is_latest: false,
  available: true,
  blocking_reasons: [],
};

function group(actorKey: string, actor: string): EstudioProcessingSuggestionGroup {
  return {
    id: `group-${actorKey}`,
    project_kind: "acreditacion",
    actor,
    actor_key: actorKey,
    platform: "surveymonkey",
    label: actor,
    recommended_base_name: actor,
    source_count: 1,
    response_count: 12,
    importable: true,
    import_mode: "surveymonkey_independent_sibling",
    confidence: "high",
    sources: [],
  };
}

test("stable keys come from the UUID, never from visible labels", () => {
  const entry = newProcessingIntakeBinding("AB-CD", {
    actor_key: "docentes",
    actor: "Docentes PUCP",
    recommended_base_name: "Docentes visibles",
  });
  expect(entry).toMatchObject({
    entry_id: "AB-CD",
    base: "base_abcd",
    actor_key: "docentes",
    actor: "Docentes PUCP",
    base_label: "Docentes visibles",
  });
  expect(entry.base).not.toContain("docentes");
});

test("renaming labels preserves stable identity but changes the optimistic fingerprint", () => {
  const entry = newProcessingIntakeBinding("entry-1");
  const renamed = { ...entry, actor: "Egresados", base_label: "Base egresados" };
  expect(renamed.entry_id).toBe(entry.entry_id);
  expect(renamed.base).toBe(entry.base);
  expect(renamed.actor_key).toBe(entry.actor_key);
  expect(processingIntakeBindingFingerprint(renamed)).not.toBe(processingIntakeBindingFingerprint(entry));
});

test("a newer revision never silently replaces the selected historical revision", () => {
  expect(processingIntakeRevisionLabel(revision)).toContain("histórica");
  const draft = { ...newProcessingIntakeBinding("entry-1"), instrument_revision_id: "rev-1" };
  const stale: ProcessingIntakeEntry = {
    ...draft,
    status: "stale",
    form_id: "form-1",
    latest_revision_id: "rev-2",
    blocking_reasons: [],
  };
  expect(processingIntakeResolvedEntry(draft, [stale], [])?.instrument_revision_id).toBe("rev-1");
  expect(processingIntakeStatusView("stale").label).toBe("Revisión desactualizada");
});

test("resolves the editor link by form_id from the immutable revision", () => {
  expect(processingIntakeEntryFormId(null, [revision], "rev-1")).toBe("form-1");
  expect(processingIntakeEntryFormId(null, [revision], "missing")).toBe("");
});

test("suggestions are matched by actor_key rather than actor label", () => {
  const groups = [group("docentes", "Docentes"), group("egresados", "Egresados")];
  const entries = [{ ...newProcessingIntakeBinding("entry-1"), actor_key: "docentes", actor: "Nombre cambiado" }];
  expect(processingIntakeSuggestedGroups(groups, entries).map((group) => group.actor_key)).toEqual(["egresados"]);
});

describe("guided exact actor links", () => {
  test("prefers the unique latest available revision with the same explicit actor_key", () => {
    const historical = { ...revision, revision_id: "rev-old", revision_no: 1, is_latest: false };
    const latest = { ...revision, revision_id: "rev-new", revision_no: 2, is_latest: true };
    const plan = processingIntakeGuidedPlan([group("docentes", "Docentes")], [historical, latest]);

    expect(plan.ready).toBe(true);
    expect(plan.links[0]).toMatchObject({ status: "ready", revision: { revision_id: "rev-new" } });
    expect(processingIntakeEntriesFromGuidedPlan(plan, [], () => "uuid-1")).toMatchObject([{
      entry_id: "uuid-1",
      actor_key: "docentes",
      instrument_revision_id: "rev-new",
    }]);
  });

  test("never guesses from labels and reports missing or ambiguous assignments", () => {
    const sameLabelWrongKey: ProcessingIntakeRevision = {
      ...revision,
      source: { ...(revision.source ?? { kind: null, original_name: null }), actor_key: "otro_actor" },
    };
    const missing = processingIntakeGuidedPlan(
      [group("docentes", "Nombre idéntico al formulario")],
      [{ ...sameLabelWrongKey, form_name: "Nombre idéntico al formulario" }],
    );
    expect(missing).toMatchObject({ ready: false, links: [{ status: "missing", revision: null }] });

    const ambiguous = processingIntakeGuidedPlan(
      [group("docentes", "Docentes")],
      [
        { ...revision, revision_id: "rev-a", is_latest: true },
        { ...revision, revision_id: "rev-b", is_latest: true },
      ],
    );
    expect(ambiguous).toMatchObject({ ready: false, links: [{ status: "ambiguous", revision: null }] });
  });

  test("keeps stable intake identities when preparing the plan again", () => {
    const plan = processingIntakeGuidedPlan([group("docentes", "Docentes actualizados")], [revision]);
    const existing = [{
      ...newProcessingIntakeBinding("stable-entry", group("docentes", "Nombre anterior")),
      base_label: "Base conservada",
      instrument_revision_id: "rev-old",
    }];
    expect(processingIntakeEntriesFromGuidedPlan(plan, existing, () => "unused")[0]).toMatchObject({
      entry_id: "stable-entry",
      base_label: "Base conservada",
      actor: "Docentes actualizados",
      instrument_revision_id: "rev-1",
    });
  });
});

describe("processing intake draft validation", () => {
  test("requires complete stable identities and published revision bindings", () => {
    const valid = { ...newProcessingIntakeBinding("entry-1"), instrument_revision_id: "rev-1" };
    expect(processingIntakeDraftValid([])).toBe(true);
    expect(processingIntakeDraftValid([valid])).toBe(true);
    expect(processingIntakeDraftValid([{ ...valid, instrument_revision_id: "" }])).toBe(false);
    expect(processingIntakeDraftValid([valid, { ...valid, actor: "Otro" }])).toBe(false);
  });
});

describe("processing intake materialized plan", () => {
  function materializedEntry(actorKey: string): ProcessingIntakeEntry {
    return {
      ...newProcessingIntakeBinding(`entry-${actorKey}`, group(actorKey, actorKey)),
      instrument_revision_id: `rev-${actorKey}`,
      status: "materialized",
      form_id: `form-${actorKey}`,
      latest_revision_id: `rev-${actorKey}`,
      blocking_reasons: [],
    };
  }

  test("is complete only when every suggested actor already has a materialized base", () => {
    const suggestions = [group("docentes", "Docentes"), group("egresados", "Egresados")];
    const entries = [materializedEntry("docentes"), materializedEntry("egresados")];

    expect(processingIntakePlanComplete(entries, suggestions)).toBe(true);
    expect(processingIntakePlanComplete([
      { ...entries[0], status: "instrument_ready" },
      entries[1],
    ], suggestions)).toBe(false);
    expect(processingIntakePlanComplete([entries[0]], suggestions)).toBe(false);
  });
});
