import { describe, expect, test } from "vitest";
import type {
  MonitoreoProcessingHandoffResult,
  MonitoreoPublicationEvidencePackResult,
  MonitoreoTerritorialOperationalPackageReviewResult,
} from "../../../api/client";
import {
  monitoreoEvidencePackFileLinks,
  monitoreoEvidencePackHighlights,
  monitoreoOperationalPackageDetail,
  monitoreoOperationalPackageMessage,
  monitoreoOperationalPackageReviewForPublication,
  monitoreoOperationalPackageReviewSource,
  monitoreoOperationalPackageStatusKind,
  monitoreoProcessingHandoffDetail,
  monitoreoProcessingHandoffFileLinks,
  preflightHasOnlyColdPerformanceWarnings,
} from "./MonitoreoOutputsWorkbench";

function reviewResult(
  overrides: Partial<MonitoreoTerritorialOperationalPackageReviewResult> = {},
): MonitoreoTerritorialOperationalPackageReviewResult {
  const review = {
    schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
    status: "review_ready",
    publication_gate: "operational_package_review_ready",
    blocks_publication: true,
    apply_ready: false,
    requires_revalidation: false,
    publication_ready: false,
    safe_to_apply: false,
    would_mutate_pulso: false,
    coverage: {
      package_rows: 2,
      reviewable_rows: 2,
      missing_ump_items: [],
      missing_tachas: 0,
      incomplete_rows: 0,
    },
    ...(overrides.review ?? {}),
  };
  return {
    ok: true,
    status: review.status,
    publication_gate: review.publication_gate,
    blocks_publication: review.blocks_publication,
    apply_ready: review.apply_ready,
    requires_revalidation: review.requires_revalidation,
    publication_ready: review.publication_ready,
    safe_to_apply: review.safe_to_apply,
    would_mutate_pulso: review.would_mutate_pulso,
    review,
    ...overrides,
  };
}

describe("MonitoreoOutputsWorkbench operational package status", () => {
  test("treats cold performance as a non-blocking publication warning", () => {
    expect(preflightHasOnlyColdPerformanceWarnings({
      schema: "monitoreo_deliverables_preflight_v1",
      generated_at: "2026-07-06T12:37:00Z",
      family: "acreditacion",
      audience: "client",
      project: "ACRDCONTA",
      cut: "2026-07-06T12:37:00Z",
      source: "Motor canonico Prosecnur",
      status: "warnings",
      score: 93,
      blocking_issues: [],
      warnings: [{
        code: "cold_performance_over_threshold",
        severity: "warning",
        message: "Cold generation performance exceeds the expected threshold.",
      }],
      scorecard: { status: "warnings", score: 93, blocking_count: 0, warning_count: 1 },
    })).toBe(true);
  });

  test("keeps mixed warnings under regular review", () => {
    expect(preflightHasOnlyColdPerformanceWarnings({
      schema: "monitoreo_deliverables_preflight_v1",
      generated_at: "2026-07-06T12:37:00Z",
      family: "acreditacion",
      audience: "client",
      project: "ACRDCONTA",
      cut: "2026-07-06T12:37:00Z",
      source: "Motor canonico Prosecnur",
      status: "warnings",
      score: 86,
      blocking_issues: [],
      warnings: [
        {
          code: "cold_performance_over_threshold",
          severity: "warning",
          message: "Cold generation performance exceeds the expected threshold.",
        },
        {
          code: "client_pii_or_internal_columns",
          severity: "warning",
          message: "Client deliverable contains internal or PII-like columns.",
        },
      ],
      scorecard: { status: "warnings", score: 86, blocking_count: 0, warning_count: 2 },
    })).toBe(false);
  });

  test("blocks a review-ready territorial package when apply payload is missing", () => {
    const result = reviewResult({
      review: {
        schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
        status: "review_ready",
        apply_ready: false,
        requires_revalidation: false,
        publication_ready: false,
        application_plan: {
          schema: "monitoreo_deliverables_territorial_application_plan_v1",
          payload_ready: false,
          blocked_rows: 3,
          ready_rows: 0,
        },
        coverage: {
          package_rows: 3,
          reviewable_rows: 3,
          missing_ump_items: [],
          missing_tachas: 0,
          incomplete_rows: 0,
        },
      },
    });

    const kind = monitoreoOperationalPackageStatusKind(result);

    expect(kind).toBe("blocked");
    expect(monitoreoOperationalPackageMessage(result, kind)).toBe(
      "Paquete revisable, pero faltan campos para aplicar con seguridad.",
    );
    expect(monitoreoOperationalPackageDetail(result)).toContain("3 filas sin payload aplicable");
  });

  test("marks endpoint-ready territorial packages as applicable while publication remains blocked", () => {
    const result = reviewResult({
      safe_to_apply: true,
      blocks_publication: true,
      review: {
        schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
        status: "review_ready",
        apply_ready: true,
        requires_revalidation: true,
        publication_ready: false,
        safe_to_apply: true,
        blocks_publication: true,
        application_plan: {
          schema: "monitoreo_deliverables_territorial_application_plan_v1",
          payload_ready: true,
          blocked_rows: 0,
          ready_rows: 2,
        },
        coverage: {
          package_rows: 2,
          reviewable_rows: 2,
          missing_ump_items: [],
          missing_tachas: 0,
          incomplete_rows: 0,
        },
      },
    });

    const kind = monitoreoOperationalPackageStatusKind(result);

    expect(kind).toBe("applicable");
    expect(monitoreoOperationalPackageMessage(result, kind)).toBe(
      "Paquete aplicable; falta aplicar y revalidar antes de publicar.",
    );
    expect(monitoreoOperationalPackageDetail(result)).toContain("payload aplicable; falta aplicar/revalidar");
    expect(monitoreoOperationalPackageDetail(result)).not.toContain("payload publicable listo");
  });

  test("uses ready only after the operational package no longer blocks publication", () => {
    const result = reviewResult({
      safe_to_apply: true,
      blocks_publication: false,
      review: {
        schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
        status: "review_ready",
        apply_ready: true,
        requires_revalidation: false,
        publication_ready: true,
        safe_to_apply: true,
        blocks_publication: false,
        application_plan: {
          schema: "monitoreo_deliverables_territorial_application_plan_v1",
          payload_ready: true,
          blocked_rows: 0,
          ready_rows: 2,
        },
        coverage: {
          package_rows: 2,
          reviewable_rows: 2,
          missing_ump_items: [],
          missing_tachas: 0,
          incomplete_rows: 0,
        },
      },
    });

    const kind = monitoreoOperationalPackageStatusKind(result);

    expect(kind).toBe("ready");
    expect(monitoreoOperationalPackageMessage(result, kind)).toBe(
      "Paquete aplicado y revalidado; la salida puede continuar a publicación.",
    );
    expect(monitoreoOperationalPackageDetail(result)).toContain("payload publicable listo");
  });

  test("labels uploaded package files as the review source", () => {
    expect(monitoreoOperationalPackageReviewSource({ filename: "operational-package-completed.csv" })).toBe(
      "Paquete cargado: operational-package-completed.csv",
    );
    expect(monitoreoOperationalPackageReviewSource(
      { filename: "operational-package-completed.csv" },
      { filename: "territorial-drift-report.csv" },
    )).toBe("Paquete cargado: operational-package-completed.csv; referencia: territorial-drift-report.csv");
    expect(monitoreoOperationalPackageReviewSource(null, { filename: "territorial-drift-report.csv" })).toBe(
      "Referencia cargada: territorial-drift-report.csv",
    );
    expect(monitoreoOperationalPackageReviewSource(null)).toBe("Referencia territorial validada");
    expect(monitoreoOperationalPackageReviewSource({ filename: "   " }, null, "Sheet validado ACNURCG")).toBe("Sheet validado ACNURCG");
  });

  test("passes the normalized review payload into publication gates", () => {
    const result = reviewResult({
      review: {
        schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
        status: "review_ready",
        publication_gate: "operational_package_review_ready",
        blocks_publication: true,
        apply_ready: true,
        requires_revalidation: true,
        publication_ready: false,
        safe_to_apply: true,
        coverage: {
          package_rows: 2,
          reviewable_rows: 2,
          missing_ump_items: [],
          missing_tachas: 0,
          incomplete_rows: 0,
        },
      },
    });

    const payload = monitoreoOperationalPackageReviewForPublication(result);

    expect((payload as { schema?: string } | undefined)?.schema).toBe("monitoreo_deliverables_territorial_operational_package_review_v1");
    expect((payload as { publication_ready?: boolean } | undefined)?.publication_ready).toBe(false);
    expect(payload).not.toHaveProperty("files");
  });

  test("labels payload-ready partial packages as blocked evidence", () => {
    const result = reviewResult({
      status: "blocked",
      publication_gate: "critical_reference_drift",
      safe_to_apply: false,
      review: {
        schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
        status: "blocked",
        publication_gate: "critical_reference_drift",
        apply_ready: false,
        requires_revalidation: false,
        publication_ready: false,
        safe_to_apply: false,
        application_plan: {
          schema: "monitoreo_deliverables_territorial_application_plan_v1",
          payload_ready: true,
          blocked_rows: 0,
          ready_rows: 2,
        },
        coverage: {
          package_rows: 2,
          reviewable_rows: 2,
          missing_ump_items: ["ump_subsanada:UMP 102"],
          missing_tachas: 0,
          incomplete_rows: 0,
        },
      },
    });

    const kind = monitoreoOperationalPackageStatusKind(result);
    const detail = monitoreoOperationalPackageDetail(result);

    expect(kind).toBe("blocked");
    expect(monitoreoOperationalPackageMessage(result, kind)).toBe(
      "Paquete parcial con payload listo, pero faltan filas críticas.",
    );
    expect(detail).toContain("1 UMP faltantes");
    expect(detail).toContain("payload parcial listo");
    expect(detail).not.toContain("payload aplicable listo");
  });
});

describe("MonitoreoOutputsWorkbench evidence pack highlights", () => {
  test("surfaces the operational payload request as non-mutating handoff evidence", () => {
    const result = {
      evidence_pack: {
        schema: "monitoreo_deliverables_evidence_pack_result_v1",
        operational_package_status: "operational-package-status.json",
        operational_package_request: "operational-package-request.json",
        operational_package_request_csv: "operational-package-request.csv",
        publication_decision: "publication-decision.json",
      },
    } as MonitoreoPublicationEvidencePackResult;

    const highlights = monitoreoEvidencePackHighlights(result);

    expect(highlights[0]).toMatchObject({
      kind: "operational_request",
      label: "Solicitud de payload operacional",
    });
    expect(highlights[0].detail).toContain("no aplica cambios");
    expect(highlights[0].detail).toContain(".pulso");
    expect(highlights.map((item) => item.kind)).toEqual([
      "operational_request",
      "operational_status",
      "publication_decision",
    ]);
  });

  test("does not show pack highlights before evidence metadata exists", () => {
    expect(monitoreoEvidencePackHighlights(null)).toEqual([]);
    expect(monitoreoEvidencePackHighlights({ evidence_pack: null } as unknown as MonitoreoPublicationEvidencePackResult)).toEqual([]);
  });

  test("returns direct download links for actionable pack files only", () => {
    const result = {
      evidence_pack: { schema: "monitoreo_deliverables_evidence_pack_result_v1" },
      files: {
        operational_package_request_csv: {
          file_id: "request-csv",
          filename: "request.csv",
          download_url: "/api/files/request-csv/download",
        },
        operational_package_request: {
          file_id: "request-json",
          filename: "request.json",
          download_url: "/api/files/request-json/download",
        },
        operational_package_status: {
          file_id: "status-json",
          filename: "status.json",
        },
        publication_decision: {
          file_id: "decision-json",
          filename: "decision.json",
          download_url: "/api/files/decision-json/download",
        },
      },
    } as MonitoreoPublicationEvidencePackResult;

    expect(monitoreoEvidencePackFileLinks(result)).toEqual([
      {
        key: "operational_package_request_csv",
        label: "Request CSV",
        downloadUrl: "/api/files/request-csv/download",
      },
      {
        key: "operational_package_request",
        label: "Request JSON",
        downloadUrl: "/api/files/request-json/download",
      },
      {
        key: "publication_decision",
        label: "Decisión",
        downloadUrl: "/api/files/decision-json/download",
      },
    ]);
  });
});

describe("MonitoreoOutputsWorkbench processing handoff package", () => {
  test("summarizes processable rows and direct package links", () => {
    const result = {
      ok: true,
      schema: "monitoreo_processing_handoff_v1",
      universe: "processable",
      included_statuses: ["validada", "revision"],
      counts: {
        exported_rows: 1283,
        validada: 1028,
        revision: 255,
      },
      file_id: "zip-file",
      filename: "acnurcg-procesable-processing-handoff.zip",
      size: 2048,
      download_url: "/api/files/zip-file/download",
      files: {
        package: {
          file_id: "zip-file",
          filename: "acnurcg-procesable-processing-handoff.zip",
          download_url: "/api/files/zip-file/download",
        },
        data_xlsx: {
          file_id: "data-file",
          filename: "acnurcg-procesable-data-procesamiento.xlsx",
          download_url: "/api/files/data-file/download",
        },
        xlsform: {
          file_id: "xlsform-file",
          filename: "acnurcg-xlsform.xlsx",
          download_url: "/api/files/xlsform-file/download",
        },
      },
      would_mutate_pulso: false,
    } as MonitoreoProcessingHandoffResult;

    expect(monitoreoProcessingHandoffDetail(result)).toBe("1,283 filas · estatus validada + revision · 2 KB");
    expect(monitoreoProcessingHandoffFileLinks(result)).toEqual([
      {
        key: "package",
        label: "ZIP completo",
        downloadUrl: "/api/files/zip-file/download",
      },
      {
        key: "data_xlsx",
        label: "Data XLSX",
        downloadUrl: "/api/files/data-file/download",
      },
      {
        key: "xlsform",
        label: "XLSForm",
        downloadUrl: "/api/files/xlsform-file/download",
      },
    ]);
  });

  test("omits package links that do not have a download URL yet", () => {
    expect(monitoreoProcessingHandoffFileLinks({
      ok: true,
      schema: "monitoreo_processing_handoff_v1",
      universe: "strict_validada",
      included_statuses: ["validada"],
      counts: { exported_rows: 12 },
      file_id: "zip-file",
      files: {
        data_xlsx: {
          file_id: "data-file",
          filename: "data.xlsx",
          download_url: "/api/files/data-file/download",
        },
      },
    })).toEqual([
      {
        key: "data_xlsx",
        label: "Data XLSX",
        downloadUrl: "/api/files/data-file/download",
      },
    ]);
  });
});
