/**
 * Avance › Faltante por UMP lee el corte de AVANCE aunque el último corte
 * aplicado sea el de validación.
 *
 * Tras anular, revertir o descartar una sospecha espacial, el backend responde
 * con `validation_summary` y la página lo guarda como último estado. Ese corte
 * publica `operational_adjustments` vacío con `reason: "validation_scope"`:
 * no calcula subsanaciones. Faltante lo pintaba igual y la UMP con déficit
 * salía «Falta 0 · Cubre —» hasta recargar (defecto C5, origen 9c47faba0).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard, TerritorialQuotaProgressBlock } from "../../../../../api/client";
import { renderPestana } from "../TerritorialMonitoreoPage";
import { cortesDePestana } from "../navegacion/cortesDePestana";
import { construirFaltante, textoDeQuienCubre } from "./faltanteModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

const cuota = CORTE_DE_CUOTAS.route_quota_progress!;
const ajustes = CORTE_DE_CUOTAS.operational_adjustments!;

/** Corte de avance: la UMP 143 debe 1 y la cubre la UMP 25, a 0.96 km. */
const CORTE_DE_AVANCE = {
  ...CORTE_DE_CUOTAS,
  operational_adjustments: {
    ...ajustes,
    suggestions: (ajustes.suggestions ?? []).map((item) => ({ ...item, source_ump: "UMP 25", source_manzana: "0310", distance_km: 0.96 })),
  },
} as MonitoreoTerritorialDashboard;

/** Corte de validación: la misma cuota, sin subsanaciones y con el bloque en 0. */
const CORTE_DE_VALIDACION = {
  ...CORTE_DE_CUOTAS,
  report_scope: "validation_summary",
  route_quota_progress: {
    ...cuota,
    blocks: (cuota.blocks ?? []).map((bloque: TerritorialQuotaProgressBlock) => ({ ...bloque, missing_total: 0 })),
  },
  operational_adjustments: { reason: "validation_scope", deficits: [], suggestions: [] },
} as unknown as MonitoreoTerritorialDashboard;

function pintar(reports: MonitoreoTerritorialDashboard, avance: MonitoreoTerritorialDashboard | null) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/monitoreo?modo=territorial&seccion=avance&pestana=faltante"]}>
      {renderPestana(
        { seccion: "avance", pestana: "faltante", panel: null },
        reports,
        { cortes: { avance, validacion: reports, consultas: null } },
      )}
    </MemoryRouter>,
  );
}

describe("Avance › Faltante por UMP tras una mutación de validación", () => {
  it("pide el corte de avance a la página", () => {
    expect(cortesDePestana({ seccion: "avance", pestana: "faltante", panel: null })).toEqual(["avance"]);
  });

  it("pinta la falta y quién la cubre desde el corte de avance, no desde el último aplicado", () => {
    const html = pintar(CORTE_DE_VALIDACION, CORTE_DE_AVANCE);
    expect(html).toContain("Falta 1");
    expect(html).toContain("UMP 25, a 0.96 km");
  });

  it("solo con el corte de validación, la falta sale de las celdas y no publica un 0", () => {
    const fila = construirFaltante(CORTE_DE_VALIDACION).filas.find((item) => item.ump === "143");
    expect(fila).toMatchObject({ falta: 1, estado: "pendiente" });
    // Ese corte no midió quién cubre: no afirma «sin excedente».
    expect(textoDeQuienCubre(fila?.cubre ?? null)).toBe("—");
  });
});
