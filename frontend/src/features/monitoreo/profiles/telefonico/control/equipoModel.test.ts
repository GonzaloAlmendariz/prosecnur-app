import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { buildTelefonicoStatusMatrix } from "../telefonicoTeamModel";
import { construirEquipo, contarDesvios } from "./equipoModel";
// `estatus_responsable` del corte de ACNUR PDM, con los responsables
// anonimizados como Op-01…Op-15 (orden alfabético de los nombres reales).
import estatusPdm from "./fixtures/estatusResponsablePdm.json";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test",
    generated_at: "",
    reference_tabs: [],
    sheets: [{
      id: "monitoreo_telefonico",
      title: "Telefónico",
      blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })),
    }],
  } as unknown as MonitoreoAcreditacionReports;
}

describe("Control › Equipo del telefónico", () => {
  it("los desvíos de PDM son los 18 del modelo de hoy", () => {
    expect(contarDesvios(buildTelefonicoStatusMatrix(estatusPdm))).toBe(18);
    const equipo = construirEquipo({ reports: reportes({ estatus_responsable: estatusPdm }), reglas: [] });
    expect(equipo.desvios).toBe(18);
    expect(equipo.matriz.responsables).toHaveLength(15);
  });

  it("suma por persona las filas de dos actores y separa «Sin asignar»", () => {
    const equipo = construirEquipo({
      reports: reportes({
        operacion_responsable: [
          { Actor: "Homologación", Responsable: "Op-01", "Casos asignados": 40, Barridos: 30, "No barridos": 10, "Efectivas telefónicas": 12, "Efectivas Kobo": 14, "Efectiva Kobo sin tel. efectiva": 2, "Sin efectiva": 18 },
          { Actor: "Vinculación", Responsable: "Op-01", "Casos asignados": 6, Barridos: 6, "No barridos": 0, "Efectivas telefónicas": 3, "Efectivas Kobo": 3, "Efectiva Kobo sin tel. efectiva": 0, "Sin efectiva": 3 },
          { Actor: "Homologación", Responsable: "Sin responsable", "Casos asignados": 19, Barridos: 0, "No barridos": 19, "Efectivas Kobo": 0 },
        ],
        reintentos_responsable: [
          { Responsable: "Op-01", "Casos reintentables": 10, "Promedio intentos": 3, "No contesta": 6 },
          { Responsable: "Op-01", "Casos reintentables": 2, "Promedio intentos": 6, "No contesta": 1 },
        ],
      }),
      reglas: [],
    });
    expect(equipo.operadores).toHaveLength(1);
    expect(equipo.operadores[0]).toMatchObject({ asignados: 46, llamados: 36, sinLlamar: 10, efectivasHoja: 15, efectivasKobo: 17, brecha: 2, sinEfectiva: 21, reintentables: 12, noContesta: 7 });
    expect(equipo.operadores[0].pctSinEfectiva).toBeCloseTo(58.33, 1);
    expect(equipo.operadores[0].promedioIntentos).toBeCloseTo(3.5, 5);
    expect(equipo.sinAsignar).toEqual({ asignados: 19, efectivasKobo: 0 });
  });
});
