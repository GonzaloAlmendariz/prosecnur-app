import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../../api/client";
import { advanceCardsFromRows } from "../../avance/tarjetasDeAvance";
import { barridosAcumulados, construirBarridoDeAcreditacion } from "./barridoModelo";
import { BarridoVista } from "./Barrido";

// Cifras del barrido de Egresados de Contabilidad (lienzo Ctl2), con los
// responsables anonimizados.
const BLOQUES: Record<string, Array<Record<string, unknown>>> = {
  resumen_telefonico: [
    { Indicador: "Total telefónico", Casos: 270 },
    { Indicador: "Casos barridos", Casos: 254 },
    { Indicador: "No barridos", Casos: 16 },
  ],
  estatus_telefonico: [
    { Estatus: "Efectivo", Casos: 141 }, { Estatus: "No contesta", Casos: 61 }, { Estatus: "Apagado", Casos: 17 },
    { Estatus: "Contactar después", Casos: 5 }, { Estatus: "Contactado por WhatsApp", Casos: 1 },
    { Estatus: "Número Incorrrecto", Casos: 9 }, { Estatus: "No existe el número", Casos: 6 },
    { Estatus: "Rechazo", Casos: 4 }, { Estatus: "No barrido", Casos: 16 },
  ],
  estatus_dia: [
    { Estado: "Efectivo", "3/06/2026": 10, "2026-06-03": 2, "4/06/2026": 28, "": 1 },
    { Estado: "No contesta", "3/06/2026": 1, "4/06/2026": 1, "15/06/2020": 3 },
    { Estado: "No barrido", "": 16 },
  ],
  operacion_responsable: [
    { Actor: "Egresados", Responsable: "Responsable 1", Conciliadas: 100, "Tel. efectiva sin plataforma completa": 1, "Plataforma completa sin tel. efectiva": 20 },
    { Actor: "Egresados", Responsable: "Responsable 2", Conciliadas: 40, "Tel. efectiva sin plataforma completa": 0, "Plataforma completa sin tel. efectiva": 18 },
  ],
};

const REPORTS = {
  schema: "test", generated_at: "", reference_tabs: [],
  sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(BLOQUES).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
} as unknown as MonitoreoAcreditacionReports;

describe("Control › Barrido de acreditación", () => {
  const modelo = construirBarridoDeAcreditacion(REPORTS, []);

  it("el embudo y la matriz salen de la hoja y de la operación por responsable", () => {
    expect([modelo.padron, modelo.barridos, modelo.efectivosAlTelefono, modelo.conciliadas]).toEqual([270, 254, 141, 140]);
    expect([modelo.soloTelefono, modelo.soloPlataforma]).toEqual([1, 38]);
    expect(modelo.publicos).toEqual(["Egresados"]);
  });

  it("agrupa los status por familia con el rótulo de la acreditación", () => {
    // Sin vocabulario declarado, la errata «Número Incorrrecto» (H7) no casa por
    // nombre y queda Reintentable: la ubica la regla del proyecto, no esta vista.
    expect(modelo.familias.map((grupo) => [grupo.etiqueta, grupo.total])).toEqual([
      ["Efectiva al teléfono", 141], ["Reintentable", 93], ["Cerrado sin efectiva", 6], ["Rechazo", 4], ["No barrido", 16],
    ]);
    const conRegla = construirBarridoDeAcreditacion(REPORTS, [
      { id: "cerrado", label: "Cerrado", final_state: "excluded", stop_contact: true, outcome_values: ["Número Incorrrecto"], priority: 1 } as never,
    ]);
    expect(conRegla.familias.find((grupo) => grupo.familia === "terminal")?.total).toBe(15);
  });

  it("normaliza las fechas antes de agrupar y aparta las de otro año (H2)", () => {
    expect(modelo.porFecha).toEqual([
      { fecha: "2026-06-03", barridos: 13, efectivos: 12 },
      { fecha: "2026-06-04", barridos: 29, efectivos: 28 },
    ]);
    expect(modelo.sinFecha).toEqual({ barridos: 4, efectivos: 1 });
    expect(barridosAcumulados(modelo.porFecha).map((dia) => dia.acumulado)).toEqual([13, 42]);
  });

  it("la vista no muestra claves crudas", () => {
    const tarjetas = advanceCardsFromRows([{ Actor: "Egresados", Universo: 270, Efectivas: 178, Meta: 108 }]);
    const html = renderToStaticMarkup(
      <BarridoVista modelo={modelo} tarjetas={tarjetas} fuentes={[{ Actor: "Egresados", Canal: "Telefónico", Efectivas: 117 }]} />,
    );
    expect(html).toContain("Conciliados con la plataforma");
    expect(html).toContain("Efectivas de Egresados por canal");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
