import { describe, expect, test } from "vitest";
import type { AcreditacionBatchPreview } from "../../api/client";
import {
  acreditacionBatchCanPromote,
  acreditacionBatchEntryDetail,
  acreditacionBatchTotalLabel,
} from "./acreditacionBatchModel";

const preview: AcreditacionBatchPreview = {
  ok: true,
  schema: "accreditation_processing_batch/v1",
  detected: true,
  ready: true,
  replacement_required: false,
  already_materialized: false,
  pins: { intake_revision: 2, family_id: "family-1", cache_token: "cache-1", preview_fingerprint: "fp-1" },
  totals: { selected: 410, excluded: 109, total_rollup: 519 },
  blockers: [],
  entries: [{
    entry_id: "entry-docentes",
    base: "docentes",
    base_label: "Docentes",
    actor_key: "docentes",
    actor: "Docentes",
    instrument_revision_id: "rev-docentes",
    selected: 52,
    excluded: 10,
    status: "ready",
    compatibility: { ok: true, message: "Compatible", missing_columns: [], extra_columns: ["response_id"] },
    extras: [{ name: "auxiliar", fill_pct: 50, n_fill: 26, kind: "con_datos" }],
    extras_checksum: "extras-1",
    blocking_reasons: [],
  }],
};

describe("acreditacion batch model", () => {
  test("only enables the single batch action when every actor is ready", () => {
    expect(acreditacionBatchCanPromote(preview)).toBe(true);
    expect(acreditacionBatchCanPromote({ ...preview, ready: false })).toBe(false);
    expect(acreditacionBatchCanPromote({
      ...preview,
      entries: [{ ...preview.entries[0], status: "blocked" }],
    })).toBe(false);
    expect(acreditacionBatchCanPromote({
      ...preview,
      replacement_required: true,
      entries: [{ ...preview.entries[0], status: "replacement_required" }],
    })).toBe(true);
  });

  test("makes exclusions and extras explicit", () => {
    expect(acreditacionBatchTotalLabel(preview)).toContain("410 efectivas");
    expect(acreditacionBatchTotalLabel(preview)).toContain("109 fuera");
    expect(acreditacionBatchEntryDetail(preview.entries[0])).toContain("excluida");
  });
});
