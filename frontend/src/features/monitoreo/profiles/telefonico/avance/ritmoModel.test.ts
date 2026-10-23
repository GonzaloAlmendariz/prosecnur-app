import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import { efectivasPorDia, estadosDeLaHoja, formatosDeFecha, motivoSinSerie, resumenDeRitmo, serieHoja, serieKobo } from "./ritmoModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "", reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const REGLAS = [
  { id: "a", label: "", final_state: "complete", priority: 1, stop_contact: false, outcome_values: ["Efectivo"] },
  { id: "b", label: "", final_state: "non_effective", priority: 2, stop_contact: false, outcome_values: ["No contesta"] },
] as MonitoreoStateRule[];

const REPORTS = reportes({
  avance_efectivo_variable_dia: [
    { Variable: "Sede", Valor: "SJL", Fecha: "2026-06-30", "Efectivas Kobo": 3 },
    { Variable: "Sede", Valor: "SJL", Fecha: "2026-07-01", "Efectivas Kobo": 14 },
    { Variable: "Sede", Valor: "Chorrillos", Fecha: "2026-07-01", "Efectivas Kobo": 1 },
    { Variable: "Sede", Valor: "Chorrillos", Fecha: "Sin fecha", "Efectivas Kobo": 2 },
    { Variable: "Origen", Valor: "Muestra", Fecha: "2026-07-01", "Efectivas Kobo": 99 },
  ],
  estatus_dia: [
    { Estado: "No barrido", "Sin fecha": 1654, Total: 1654 },
    { Estado: "Efectivo", "1/07/2026": 87, "01/07/2026": 3, "30/06/2026": 22, "30/06/2020": 1, "Sin fecha": 4, Total: 117 },
    { Estado: "No contesta", "2/07/2026": 50, Total: 50 },
  ],
});

describe("Avance › Ritmo del telefónico", () => {
  it("suma las efectivas de Kobo por día y categoría de la variable de cuota", () => {
    const serie = serieKobo(REPORTS, "Sede");
    expect(serie.fechas).toEqual(["2026-06-30", "2026-07-01"]);
    expect(serie.categorias).toEqual([{ nombre: "SJL", total: 17 }, { nombre: "Chorrillos", total: 1 }]);
    expect(serie.porFecha["2026-07-01"]).toBe(15);
    expect(serie.sinFecha).toBe(2);
  });

  it("reparte los llamados de la hoja por familia del status y deja fuera la fecha de otro año", () => {
    const hoja = serieHoja(REPORTS, REGLAS);
    expect(hoja.totalPorFecha).toEqual({ "2026-06-30": 22, "2026-07-01": 90, "2026-07-02": 50 });
    expect(hoja.porFecha["2026-07-02"].reintentable).toBe(50);
    expect(hoja.ultima).toBe("2026-07-02");
  });

  it("dice cómo vienen escritas las fechas de la hoja", () => {
    const { formatos, columnas, dias, valores } = formatosDeFecha(REPORTS);
    expect(valores[0]).toEqual({ valor: "1/07/2026", casos: 87, aviso: false });
    expect(valores.find((item) => item.valor === "30/06/2020")?.aviso).toBe(true);
    expect(columnas).toBe(6);
    expect(dias).toBe(3);
    expect(formatos.map((item) => [item.etiqueta, item.casos])).toEqual([
      ["Día con un dígito (1/07/2026)", 137],
      ["Día con dos dígitos (01/07/2026)", 25],
      ["Llamados sin fecha", 4],
      ["Con año 2020 (fuera del periodo)", 1],
    ]);
  });

  it("calcula promedio, pico y el día en que se cruza la meta", () => {
    const resumen = resumenDeRitmo({ fechas: ["a", "b", "c"], porFecha: { a: 10, b: 30, c: 20 }, total: 60 }, 35);
    expect(resumen).toMatchObject({ dias: 3, promedio: 20, pico: { fecha: "b", casos: 30 }, metaCruzada: "b" });
    expect(resumen.acumulado).toEqual({ a: 10, b: 40, c: 60 });
  });

  it("cuenta las efectivas de Kobo por día sin las de fecha ilegible", () => {
    const dias = efectivasPorDia(reportes({ avance_efectivo_dia: [
      { Fecha: "2026-07-01", "Efectivas Kobo": 74 }, { Fecha: "2026-06-30", "Efectivas Kobo": 14 }, { Fecha: "Sin fecha", "Efectivas Kobo": 2 },
    ] }));
    expect(dias).toEqual([{ fecha: "2026-06-30", casos: 14 }, { fecha: "2026-07-01", casos: 74 }]);
  });
});

describe("Ritmo sin serie", () => {
  it("un barrido que no empezó dice cuántas filas hay y en qué estado", () => {
    const hoja = estadosDeLaHoja(reportes({ estatus_telefonico: [{ Estatus: "No barrido", Casos: 800, "% del total telefónico": 1 }] }));
    expect(hoja).toEqual({ estados: [{ estado: "No barrido", casos: 800 }], filas: 800 });
    expect(motivoSinSerie(hoja, 0)).toBe(
      "Las 800 filas de la hoja de barrido están en «No barrido» y ninguna tiene fecha de llamada. Kobo no trae efectivas en este corte.",
    );
  });

  it("con varios estados y efectivas sin fecha, lo dice sin suponer", () => {
    const hoja = estadosDeLaHoja(reportes({ estatus_telefonico: [
      { Estatus: "No barrido", Casos: 1200 },
      { Estatus: "No contesta", Casos: 34 },
      { Estatus: "Vacío", Casos: 0 },
    ] }));
    expect(hoja.estados.map((item) => item.estado)).toEqual(["No barrido", "No contesta"]);
    expect(motivoSinSerie(hoja, 3)).toBe(
      "Ninguna de las 1,234 filas de la hoja de barrido tiene fecha de llamada. Kobo trae 3 efectivas sin fecha.",
    );
    expect(motivoSinSerie({ estados: [], filas: 0 }, 1)).toBe(
      "La hoja de barrido no trae filas en este corte. Kobo trae 1 efectiva sin fecha.",
    );
  });
});
