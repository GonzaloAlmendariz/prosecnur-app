import { describe, expect, test } from "vitest";
import type {
  SurveyMonkeySavBundleFileInspection,
  SurveyMonkeySavNormalizationVariable,
} from "../../api/client";
import {
  filterSavNormalizationVariables,
  savNormalizationApplyReason,
  savNormalizationCatalogRows,
  savNormalizationConfirmationState,
  savNormalizationOperationLabel,
  savNormalizationStatusCounts,
} from "./savNormalizationReviewModel";

function variable(
  id: string,
  status: SurveyMonkeySavNormalizationVariable["status"],
  overrides: Partial<SurveyMonkeySavNormalizationVariable> = {},
): SurveyMonkeySavNormalizationVariable {
  return {
    id,
    variable: id,
    source_columns: [{ name: id.toUpperCase(), storage_type: "double", label: "", labelled: true }],
    xlsform: { name: id, label: `Etiqueta ${id}`, type: "integer", type_base: "integer", list_name: "" },
    status,
    operations: [],
    catalog: null,
    alerts: [],
    ...overrides,
  };
}

function file(entryName: string, blocking = false, hasReview = true): SurveyMonkeySavBundleFileInspection {
  const variables = [variable("p1", "unchanged")];
  return {
    file_name: entryName,
    entry_name: entryName,
    base_name: "base",
    matched: true,
    blocking,
    action: "replace_data",
    n_rows: 1,
    n_columns: 1,
    n_output_columns: 1,
    expected_variables: 1,
    matched_variables: 1,
    missing_variables: [],
    blank_filled_variables: [],
    all_empty_variables: [],
    metadata_columns: [],
    instrument_revision: {
      status: "pinned_healthy",
      healthy: true,
      revision_id: "revision-1",
      revision_hash: "hash",
      base_revision_hash: "hash",
      base_xlsform_file_id: "xls",
      revision_xlsform_file_id: "xls",
      reasons: [],
      warning: "",
    },
    normalization_review: hasReview ? {
      schema: "sav_normalization_review/v1",
      normalizer_contract: "sav_to_xlsform/v1",
      fingerprint: `review-${entryName}`,
      privacy: {
        response_values_included: false,
        direct_identifier_values_included: false,
        free_text_values_included: false,
        schema_names_included: true,
        xlsform_labels_included: true,
        choice_catalog_included: true,
      },
      summary: {
        total_variables: 1,
        expected_variables: 1,
        source_only_variables: 0,
        status_counts: { unchanged: 1, transformed: 0, warning: 0, source_only: 0 },
        operation_counts: {},
        alerts: 0,
      },
      alerts: [],
      variables,
    } : null,
    warnings: [],
    change_plan: {
      action: "replace_data",
      base_name: "base",
      source_file: entryName,
      current: {},
      incoming: { raw_rows: 1, raw_columns: 1, normalized_rows: 1, normalized_columns: 1 },
      impact: {
        expected_variables: 1,
        matched_variables: 1,
        missing_variables: [],
        blank_filled_variables: [],
        all_empty_variables: [],
        metadata_columns: [],
      },
      effects: { xlsform: "preserved", data: "replaced", invalidates: [] },
    },
  };
}

describe("SAV normalization review model", () => {
  test("filters changes, warnings, metadata and accent-insensitive text without response data", () => {
    const variables = [
      variable("p1", "unchanged"),
      variable("p2", "transformed", { operations: [{ kind: "recode", label: "Recodificar", detail: "Escala única", source: "", target: "" }] }),
      variable("p3", "unchanged", { alerts: [{ severity: "warning", code: "W_LABEL", count: 1, variables: ["p3"], message: "Revisar catálogo" }] }),
      variable("collector_id", "source_only", { xlsform: null }),
    ];

    expect(filterSavNormalizationVariables(variables, "changes", "").map((item) => item.id)).toEqual(["p2"]);
    expect(filterSavNormalizationVariables(variables, "warnings", "catalogo").map((item) => item.id)).toEqual(["p3"]);
    expect(filterSavNormalizationVariables(variables, "metadata", "COLLECTOR").map((item) => item.id)).toEqual(["collector_id"]);
    expect(savNormalizationStatusCounts(variables)).toEqual({ unchanged: 2, transformed: 1, warning: 0, source_only: 1 });
  });

  test("builds semantic catalog rows from mappings or sealed choices", () => {
    const mapped = variable("p4", "transformed", {
      catalog: {
        list_name: "respuesta",
        origin: "xlsform",
        sealed_sha256: "sealed",
        choices: [{ name: "1", value: "1", label: "Sí" }],
        mappings: [{ source_code: "1.00", source_column: "P4", source_label: "Sí SAV", xls_code: "1", xls_label: "Sí", match: "recode", source: "1.00", target: "1", target_label: "Sí" }],
      },
    });
    const choicesOnly = variable("p5", "unchanged", {
      catalog: { list_name: "respuesta", origin: "xlsform", sealed_sha256: "sealed", choices: [{ name: "2", value: "2", label: "No" }], mappings: [] },
    });

    expect(savNormalizationCatalogRows(mapped)).toEqual([
      { source_code: "1.00", source_column: "P4", source_label: "Sí SAV", xls_code: "1", xls_label: "Sí", match: "recode", source: "1.00", target: "1", target_label: "Sí" },
    ]);
    expect(savNormalizationCatalogRows(choicesOnly)[0]).toMatchObject({ source: "2", target: "2", target_label: "No" });
    expect(savNormalizationOperationLabel("coerce_type")).toBe("Convertir tipo");
  });

  test("requires every non-blocked file and reports missing review payloads", () => {
    const files = [file("a.sav"), file("b.sav"), file("blocked.sav", true), file("legacy.sav", false, false)];
    const partial = savNormalizationConfirmationState(files, new Set(["a.sav", "blocked.sav"]));

    expect(partial).toMatchObject({
      requiredEntryNames: ["a.sav", "b.sav", "legacy.sav"],
      confirmedEntryNames: ["a.sav"],
      pendingEntryNames: ["b.sav", "legacy.sav"],
      unavailableEntryNames: ["legacy.sav"],
      complete: false,
    });
    expect(savNormalizationApplyReason(files, new Set(["a.sav", "b.sav"]))).toContain("Falta el detalle de normalización");
    expect(savNormalizationConfirmationState(files.slice(0, 2), new Set(["a.sav", "b.sav"])).complete).toBe(true);
  });
});
