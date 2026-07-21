import { describe, expect, test } from "vitest";
import type { ProcessingReleaseCatalog } from "../../api/client";
import { processingReleaseActive, processingReleaseCounts, processingReleaseStatusView } from "./processingReleaseModel";

const catalog = {
  detected: true,
  active_base: "docentes",
  entries: [
    { base: "administrativos", status: "approved" },
    { base: "docentes", status: "ready" },
    { base: "estudiantes", status: "stale" },
  ],
} as ProcessingReleaseCatalog;

describe("processing release model", () => {
  test("selects by stable base and summarizes sisters independently", () => {
    expect(processingReleaseActive(catalog, "administrativos")?.status).toBe("approved");
    expect(processingReleaseCounts(catalog)).toEqual({ total: 3, approved: 1, stale: 1, ready: 1 });
  });

  test("distinguishes approved, stale and pending language", () => {
    expect(processingReleaseStatusView("approved").label).toBe("Aprobada");
    expect(processingReleaseStatusView("stale").label).toBe("Desactualizada");
    expect(processingReleaseStatusView("pending").label).toBe("Pendiente");
  });
});
