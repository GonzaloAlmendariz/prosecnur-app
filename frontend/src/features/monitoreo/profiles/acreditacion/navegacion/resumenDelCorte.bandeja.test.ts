import { afterEach, describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { useResumenDelCorte } from "./resumenDelCorte";

const bandeja = (scope: string, cases: unknown[]) => ({
  schema: "t",
  generated_at: "",
  reference_tabs: [],
  sheets: [],
  report_scope: scope,
  internal_queries: { issues: [], cases, case_rollup: [] },
}) as unknown as MonitoreoAcreditacionReports;

afterEach(() => useResumenDelCorte.getState().olvidar());

describe("resumen del corte, bandeja de respuestas", () => {
  it("una bandeja de Control sin filas que unir queda como lista vacía, no como «todavía no llega»", () => {
    useResumenDelCorte.getState().observar(bandeja("queries_summary", [{ actor: "Profesores", response_id: "", response_row: "" }]), [], null);
    expect(useResumenDelCorte.getState().respuestasConFila).toEqual([]);
  });

  it("un corte que no es el de Control no pisa la bandeja ya recibida", () => {
    useResumenDelCorte.getState().observar(bandeja("queries_summary", [{ actor: "Profesores", response_id: "115", response_row: 12, platform_state: "Parcial" }]), [], null);
    useResumenDelCorte.getState().observar(bandeja("advance_summary", []), [], null);
    expect(useResumenDelCorte.getState().respuestasConFila).toHaveLength(1);
  });
});
