// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";

const apiMonitoreoState = vi.fn();
vi.mock("../api/client", () => ({ apiMonitoreoState: (...args: unknown[]) => apiMonitoreoState(...args) }));
vi.mock("../features/monitoreo/profiles/registry", () => ({
  preloadMonitoreoFamily: async () => ({ chunk: "monitoreo-acreditacion", warmupScopes: ["source", "advance_summary", "queries_summary", "phone_summary"] }),
}));
vi.mock("../features/monitoreo/core/reportScopeCache", () => ({ monitoreoScopeCache: { putTerritorialState: vi.fn() } }));

import { WARMUP_MODULES } from "./warmupRegistry";

// El warm start de acreditación pedía los cuatro scopes en serie antes de
// entrar y Avance esperaba detrás de consultas y teléfono. Fija que ahora sólo
// pide el estado liviano y el corte de la vista de aterrizaje.
describe("warm start de Monitoreo · acreditación", () => {
  const cargar = () => WARMUP_MODULES.find((m) => m.id === "monitoreo_datos")!.load();

  beforeEach(() => {
    apiMonitoreoState.mockReset();
    apiMonitoreoState.mockImplementation(async (opts: { includeReports?: boolean }) => (
      opts.includeReports ? {} : { monitoreo_profile: { family: "acreditacion" } }
    ));
  });

  test.each([
    ["/monitoreo", "advance_summary"],
    ["/monitoreo?modo=acreditacion&seccion=insumos&pestana=publicos", "source"],
    ["/monitoreo?modo=acreditacion&seccion=control&pestana=resolver", "queries_summary"],
  ])("%s calienta sólo %s", async (ruta, scope) => {
    window.history.replaceState(null, "", ruta);
    const resultado = await cargar();
    const conReportes = apiMonitoreoState.mock.calls.filter(([opts]) => opts.includeReports);
    expect(conReportes.map(([opts]) => opts.reportScope)).toEqual([scope]);
    expect(resultado).toMatchObject({ family: "acreditacion", scopes: [scope] });
  });
});
