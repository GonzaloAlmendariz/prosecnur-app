import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import { construirBarrido, llamadosPorFecha } from "./barridoModel";
import { clasificadorDeStatus } from "./familiasDelCliente";

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

// El vocabulario de ACNUR PDM tal como lo guarda el proyecto.
const REGLAS: MonitoreoStateRule[] = [
  { id: "a", label: "", final_state: "complete", priority: 1, stop_contact: false, outcome_values: ["efectivo", "completo"] },
  { id: "b", label: "", final_state: "pending", priority: 2, stop_contact: false, outcome_values: ["no_barrido", "contactar_despues"] },
  { id: "c", label: "", final_state: "refusal", priority: 3, stop_contact: false, outcome_values: ["rechazo"] },
  { id: "d", label: "", final_state: "non_effective", priority: 4, stop_contact: false, outcome_values: ["no_contesta", "apagado", "numero_suspendido"] },
];

describe("Control › Barrido del telefónico", () => {
  it("agrupa los status del cliente por la familia de su regla y marca los que no tienen", () => {
    const clasificar = clasificadorDeStatus(REGLAS);
    expect(clasificar("No contesta")).toEqual({ familia: "reintentable", conRegla: true, porRegla: false });
    expect(clasificar("Contactar después")).toEqual({ familia: "reintentable", conRegla: true, porRegla: false });
    expect(clasificar("Colgó / Cortó la llamada")).toEqual({ familia: "reintentable", conRegla: false, porRegla: false });
    expect(clasificar("No existe el número")).toEqual({ familia: "terminal", conRegla: false, porRegla: false });
    expect(clasificar("No efectivo / No beneficiario")).toEqual({ familia: "terminal", conRegla: false, porRegla: false });
    expect(clasificar("Encuesta parcial")).toEqual({ familia: "parcial", conRegla: false, porRegla: false });
    expect(clasificar("No barrido").familia).toBe("sin-llamar");
    // Medios de Vida: su regla declara que el rechazo cierra. Es Terminal y se rotula.
    const cierra = clasificadorDeStatus([{ id: "r", label: "", final_state: "refusal", priority: 1, stop_contact: true, outcome_values: ["rechazo"] }]);
    expect(cierra("Rechazo")).toEqual({ familia: "terminal", conRegla: true, porRegla: true });
  });

  it("une las fechas tecleadas de dos formas y aparta las de otro año", () => {
    const { porFecha, otraFecha } = llamadosPorFecha([
      { Estado: "No barrido", "2/07/2026": 11, "Sin fecha": 1654, Total: 1665 },
      { Estado: "Efectivo", "1/07/2026": 87, "2026-07-01": 3, "30/06/2026": 22, "30/06/2020": 1, "Sin fecha": 4, Total: 117 },
    ]);
    expect(porFecha).toEqual([{ fecha: "30/06", casos: 22 }, { fecha: "01/07", casos: 90 }]);
    expect(otraFecha).toBe(5);
  });

  it("arma el embudo, la tabla por categoría y los status desde los bloques", () => {
    const modelo = construirBarrido({
      reports: reportes({
        resumen_telefonico: [
          { Indicador: "Casos barridos", Casos: 631 },
          { Indicador: "No barridos", Casos: 1665 },
          { Indicador: "Total telefónico", Casos: 2296 },
        ],
        estatus_telefonico: [
          { Estatus: "No barrido", Casos: 1665 },
          { Estatus: "Efectivo", Casos: 222 },
          { Estatus: "No contesta", Casos: 197 },
          { Estatus: "Encuesta parcial", Casos: 2 },
        ],
        no_barridos_responsable: [
          { Responsable: "Sin responsable", "No barridos": 1197 },
          { Responsable: "Op-01", "No barridos": 49 },
        ],
      }),
      reglas: REGLAS,
      cuotas: [{ actor: "SJL", universe: 614, effective: 109, partial: 0, refusals: 3, pending: 456 }],
    });
    expect([modelo.listado, modelo.llamados, modelo.sinLlamar, modelo.efectivasHoja, modelo.efectivasKobo]).toEqual([2296, 631, 1665, 222, 109]);
    expect(modelo.categorias[0]).toMatchObject({ nombre: "SJL", llamados: 158, sinLlamar: 456 });
    expect(modelo.status.map((grupo) => [grupo.familia, grupo.total])).toEqual([["efectiva", 222], ["parcial", 2], ["reintentable", 197]]);
    expect([modelo.porLlamarAsignados, modelo.sinAsignar]).toEqual([49, 1197]);
  });
});
