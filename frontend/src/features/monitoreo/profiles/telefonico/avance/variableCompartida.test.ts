import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { phoneQuotaAdvanceCardsFromRows } from "../TelefonicoMonitoreoPage";
import { segmentoDeCuotas } from "./ritmoModel";
import { entradaDeCuotasFaltante } from "./entradaDeCuotas";

function reportes(filas: Array<Record<string, unknown>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: [{ id: "cuotas_variable", title: "Cuotas", columns: [], rows: filas }] }],
  } as unknown as MonitoreoAcreditacionReports;
}

// Metas por sexo y un listado por sede con más filas: antes Cuotas pintaba Sexo
// y Ritmo dibujaba Sede (la más frecuente), dos cortes de la misma cuota.
const filas = [
  { Actor: "Total", Variable: "Sede", Valor: "Norte", Universo: 40, Meta: null, Efectivas: 10 },
  { Actor: "Total", Variable: "Sede", Valor: "Sur", Universo: 30, Meta: null, Efectivas: 8 },
  { Actor: "Total", Variable: "Sede", Valor: "Centro", Universo: 30, Meta: null, Efectivas: 9 },
  { Actor: "Total", Variable: "Sexo", Valor: "Mujer", Universo: 50, Meta: 20, Efectivas: 14 },
  { Actor: "Total", Variable: "Sexo", Valor: "Hombre", Universo: 50, Meta: 20, Efectivas: 13 },
];

describe("Ritmo, Avance › Cuotas y su rótulo leen la misma variable de cuota", () => {
  it("las tarjetas de Cuotas, la serie de Ritmo y el rótulo eligen Sexo", () => {
    const tarjetas = phoneQuotaAdvanceCardsFromRows(filas);
    expect(new Set(tarjetas.map((t) => t.id.split("-")[2]))).toEqual(new Set(["sexo"]));
    expect(segmentoDeCuotas(reportes(filas))).toBe("Sexo");
    const { modelo } = entradaDeCuotasFaltante(reportes(filas), null, []);
    expect(modelo.segmento).toBe("Sexo");
  });
});
