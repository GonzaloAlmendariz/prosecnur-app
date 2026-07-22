import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import * as Dialog from "@radix-ui/react-dialog";
import type { SurveyMonkeySavBundleFileInspection } from "../../api/client";
import { SavNormalizationReviewDialogContent } from "./SavNormalizationReviewDialog";

function reviewedFile(): SurveyMonkeySavBundleFileInspection {
  return {
    file_name: "Civil.sav",
    entry_name: "bases/Civil.sav",
    base_name: "civil",
    matched: true,
    blocking: false,
    action: "replace_data",
    n_rows: 20,
    n_columns: 3,
    n_output_columns: 3,
    expected_variables: 2,
    matched_variables: 2,
    missing_variables: [],
    blank_filled_variables: [],
    all_empty_variables: [],
    metadata_columns: ["collector_id"],
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
    normalization_review: {
      schema: "sav_normalization_review/v1",
      normalizer_contract: "sav_to_xlsform/v1",
      fingerprint: "review-1",
      privacy: {
        response_values_included: false,
        direct_identifier_values_included: false,
        free_text_values_included: false,
        schema_names_included: true,
        xlsform_labels_included: true,
        choice_catalog_included: true,
      },
      summary: {
        total_variables: 2,
        expected_variables: 1,
        source_only_variables: 1,
        status_counts: { unchanged: 0, transformed: 1, warning: 0, source_only: 1 },
        operation_counts: { recode_choice_map: 1, preserve_metadata: 1 },
        alerts: 1,
      },
      alerts: [{ severity: "warning", code: "W_LABEL", count: 1, variables: ["p12"], message: "Confirma la etiqueta." }],
      variables: [{
        id: "p12",
        variable: "p12",
        source_columns: [{ name: "P12", storage_type: "double", label: "", labelled: true }],
        xlsform: { name: "p12", label: "Satisfacción", type: "select_one escala", type_base: "select_one", list_name: "escala" },
        status: "transformed",
        operations: [{ kind: "recode", label: "Recodificar", detail: "Alinea el catálogo sellado.", source: "1.00", target: "1" }],
        catalog: {
          list_name: "escala",
          origin: "xlsform",
          sealed_sha256: "sealed",
          choices: [],
          mappings: [{ source_code: "1.00", source_column: "P12", source_label: "Sí SAV", xls_code: "1", xls_label: "Sí", match: "recode", source: "1.00", target: "1", target_label: "Sí" }],
        },
        alerts: [{ severity: "warning", code: "W_LABEL", count: 1, variables: ["p12"], message: "Confirma la etiqueta." }],
      }, {
        id: "collector_id",
        variable: "collector_id",
        source_columns: [{ name: "collector_id", storage_type: "string", label: "", labelled: false }],
        xlsform: null,
        status: "source_only",
        operations: [],
        catalog: null,
        alerts: [],
      }],
    },
    warnings: [],
    change_plan: {
      action: "replace_data",
      base_name: "civil",
      source_file: "Civil.sav",
      current: {},
      incoming: { raw_rows: 20, raw_columns: 3, normalized_rows: 20, normalized_columns: 3 },
      impact: {
        expected_variables: 2,
        matched_variables: 2,
        missing_variables: [],
        blank_filled_variables: [],
        all_empty_variables: [],
        metadata_columns: ["collector_id"],
      },
      effects: { xlsform: "preserved", data: "replaced", invalidates: [] },
    },
  };
}

describe("SavNormalizationReviewDialog", () => {
  test("renders a data-first, privacy-safe and semantic normalization review", () => {
    const file = reviewedFile();
    const html = renderToStaticMarkup(
      <Dialog.Root open>
        <SavNormalizationReviewDialogContent
          files={[file]}
          selectedEntryName={file.entry_name}
          reviewedEntryNames={new Set()}
          onSelectedEntryNameChange={() => undefined}
          onConfirm={() => undefined}
          onClose={() => undefined}
        />
      </Dialog.Root>,
    );

    expect(html).toContain("Revisar normalización SAV");
    expect(html).toContain("Sin datos personales");
    expect(html).toContain("SAV");
    expect(html).toContain("Transformación");
    expect(html).toContain("XLSForm");
    expect(html).toContain("Catálogo de códigos");
    expect(html).toContain("<table");
    expect(html).toContain("Código SAV");
    expect(html).toContain("Código XLSForm");
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="true" tabindex="0"');
    expect(html).toContain('aria-selected="false" tabindex="-1"');
    expect(html).toContain('class="pulso-sav-review-catalog-frame" tabindex="0"');
    expect(html).toContain("Confirmar archivo");
    expect(html).not.toContain("response_values");
    expect(html).toContain('class="pulso-sav-review-commandbar"');
    expect(html).toContain('class="pulso-sav-review-metrics"');
    expect(html).not.toContain("pulso-sav-review-overview");
    expect(html).not.toContain("pulso-sav-review-toolbar");
    expect(html).toContain(">01<");
    expect(html.indexOf("pulso-sav-review-header")).toBeLessThan(html.indexOf("pulso-sav-review-commandbar"));
    expect(html.indexOf("pulso-sav-review-commandbar")).toBeLessThan(html.indexOf("pulso-sav-review-body"));
    expect(html.indexOf("pulso-sav-review-body")).toBeLessThan(html.indexOf("pulso-sav-review-footer"));
  });

  test("shows an accessible blocker when the review contract is absent", () => {
    const file = { ...reviewedFile(), normalization_review: null };
    const html = renderToStaticMarkup(
      <Dialog.Root open>
        <SavNormalizationReviewDialogContent
          files={[file]}
          selectedEntryName={file.entry_name}
          reviewedEntryNames={new Set()}
          onSelectedEntryNameChange={() => undefined}
          onConfirm={() => undefined}
          onClose={() => undefined}
        />
      </Dialog.Root>,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Detalle no disponible");
    expect(html).toContain("Reinspecciona antes de aplicar");
    expect(html).toContain('disabled=""');
  });
});
