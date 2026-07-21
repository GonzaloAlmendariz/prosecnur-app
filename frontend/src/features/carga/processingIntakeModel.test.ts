import { describe, expect, test } from "vitest";
import type { ProcessingIntakeEntry, ProcessingIntakeRevision } from "../../api/client";
import {
  newProcessingIntakeBinding,
  processingIntakeBindingFingerprint,
  processingIntakeDraftValid,
  processingIntakeEntryFormId,
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
  is_latest: false,
  available: true,
  blocking_reasons: [],
};

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
  const groups = [
    { actor_key: "docentes", actor: "Docentes", recommended_base_name: "Docentes" },
    { actor_key: "egresados", actor: "Egresados", recommended_base_name: "Egresados" },
  ] as any[];
  const entries = [{ ...newProcessingIntakeBinding("entry-1"), actor_key: "docentes", actor: "Nombre cambiado" }];
  expect(processingIntakeSuggestedGroups(groups, entries).map((group) => group.actor_key)).toEqual(["egresados"]);
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
