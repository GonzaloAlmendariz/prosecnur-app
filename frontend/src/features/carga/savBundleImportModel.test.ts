import { describe, expect, test } from "vitest";
import type { SurveyMonkeySavBundleFileInspection, SurveyMonkeySavBundleInspection } from "../../api/client";
import {
  savBundleContractFingerprint,
  savBundleFileBaseMapValidation,
  savBundleInspectionIsStale,
  savBundleResolvedFileBaseMap,
  savBundleRevisionView,
} from "./savBundleImportModel";

function savFile(
  entryName: string,
  baseName: string | null,
  revision: Partial<SurveyMonkeySavBundleFileInspection["instrument_revision"]> = {},
): SurveyMonkeySavBundleFileInspection {
  return {
    file_name: entryName.split("/").at(-1) ?? entryName,
    entry_name: entryName,
    base_name: baseName,
    matched: Boolean(baseName),
    blocking: false,
    action: "replace_data",
    n_rows: 10,
    n_columns: 8,
    n_output_columns: 7,
    expected_variables: 5,
    matched_variables: 5,
    missing_variables: [],
    blank_filled_variables: [],
    all_empty_variables: [],
    metadata_columns: [],
    instrument_revision: {
      status: "pinned_healthy",
      healthy: true,
      revision_id: "revision-publicada-1234567890",
      revision_hash: "hash",
      base_revision_hash: "hash",
      base_xlsform_file_id: "xls-1",
      revision_xlsform_file_id: "xls-1",
      reasons: [],
      warning: "",
      ...revision,
    },
    warnings: [],
    change_plan: {
      action: "replace_data",
      base_name: baseName ?? "",
      source_file: entryName,
      current: {},
      incoming: { raw_rows: 10, raw_columns: 8, normalized_rows: 10, normalized_columns: 7 },
      impact: {
        expected_variables: 5,
        matched_variables: 5,
        missing_variables: [],
        blank_filled_variables: [],
        all_empty_variables: [],
        metadata_columns: [],
      },
      effects: { xlsform: "preserved", data: "replaced", invalidates: [] },
    },
  };
}

function inspection(files: SurveyMonkeySavBundleFileInspection[]): SurveyMonkeySavBundleInspection {
  return {
    ok: true,
    file_id: "zip-1",
    filename: "bases.zip",
    n_files: files.length,
    n_matched: files.length,
    n_blocking: 0,
    blocking_files: [],
    inspection_fingerprint: "backend-fingerprint-1",
    files,
    change_plan: files,
    warnings: [],
  };
}

describe("ZIP SAV inspection contract", () => {
  test("uses exact entry names and a stable sorted policy-map fingerprint", () => {
    const files = [
      savFile("carpeta/Civil.sav", "civil"),
      savFile("carpeta/Docentes.sav", "docentes"),
    ];
    const result = inspection(files);
    const resolved = savBundleResolvedFileBaseMap(result, {}, ["docentes", "civil"]);

    expect(resolved).toEqual({
      "carpeta/Civil.sav": "civil",
      "carpeta/Docentes.sav": "docentes",
    });
    expect(savBundleContractFingerprint("strict", resolved)).toBe(
      savBundleContractFingerprint("strict", {
        "carpeta/Docentes.sav": "docentes",
        "carpeta/Civil.sav": "civil",
      }),
    );
  });

  test("marks policy or mapping edits stale and rejects duplicate assignments", () => {
    const files = [savFile("a.sav", "civil"), savFile("b.sav", "docentes")];
    const map = { "a.sav": "civil", "b.sav": "docentes" };
    const credit = {
      policy: "strict" as const,
      fileBaseMap: map,
      localFingerprint: savBundleContractFingerprint("strict", map),
      backendFingerprint: "backend-fingerprint-1",
    };

    expect(savBundleInspectionIsStale(credit, "strict", map)).toBe(false);
    expect(savBundleInspectionIsStale(credit, "fill_blank_warn", map)).toBe(true);
    expect(savBundleInspectionIsStale(credit, "strict", { ...map, "b.sav": "civil" })).toBe(true);
    expect(savBundleFileBaseMapValidation(files, { "a.sav": "civil", "b.sav": "civil" }, ["civil", "docentes"]))
      .toMatchObject({ complete: true, duplicateBases: ["civil"], unknownBases: [] });
  });

  test("presents published, legacy and blocked revision evidence", () => {
    expect(savBundleRevisionView(savFile("healthy.sav", "civil"))).toMatchObject({
      tone: "success",
      label: "Publicada · revision…7890",
    });
    expect(savBundleRevisionView(savFile("legacy.sav", "civil", {
      status: "legacy_unpinned",
      healthy: null,
      revision_id: "",
      warning: "Sin pin publicado",
    }))).toEqual({ tone: "warning", label: "Legacy sin pin", detail: "Sin pin publicado" });
    expect(savBundleRevisionView(savFile("blocked.sav", "civil", {
      status: "blocked",
      reasons: ["El hash no coincide."],
    }))).toMatchObject({ tone: "danger", detail: "El hash no coincide." });
  });
});
