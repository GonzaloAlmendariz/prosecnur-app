import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { motivosDeLaBarra, construirOcurrencias } from "./ocurrenciasModel";

const CORTE = {
  field_occurrences: {
    summary: { total_records: 3, intentos: 200, efectivas: 30, no_efectivas: 170 },
    by_outcome: [
      { key: "efectiva", label: "Efectiva", total: 30 },
      { key: "no_contesta", label: "No contesta", total: 90 },
      { key: "rechazo", label: "Rechazo", total: 50 },
      { key: "ausente", label: "Ausente", total: 20 },
      { key: "vivienda_desocupada", label: "Vivienda desocupada", total: 6 },
      { key: "otro", label: "Otro", total: 4 },
    ],
    by_district: [
      { distrito: "SAN MARTIN DE PORRES", intentos: 100, ump_reportadas: 2, efectivas: 20, outcomes: [{ key: "no_contesta", label: "No contesta", total: 40 }, { key: "rechazo", label: "Rechazo", total: 25 }] },
      { distrito: "ATE", intentos: 0, ump_reportadas: 0, efectivas: 0, outcomes: [] },
    ],
    by_day: [{ date: "2026-06-14", intentos: 80, efectivas: 10 }, { date: "2026-06-13", intentos: 120, efectivas: 20 }],
    by_ump: [
      { ump: "1", has_report: true, reportes: 1, intentos: 100, efectivas: 15 },
      { ump: "2", has_report: true, reportes: 2, intentos: 100, efectivas: 15 },
      { ump: "3", has_report: false, reportes: 0, intentos: 0, efectivas: 0 },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Ocurrencias", () => {
  const modelo = construirOcurrencias(CORTE);

  it("la banda: intentos, efectivas declaradas, tasa y no efectivas, con su base", () => {
    expect(modelo).toMatchObject({ conPartes: true, partes: 3, umpsConParte: 2, intentos: 200, efectivas: 30, noEfectivas: 170, tasa: "15 %" });
  });

  it("los motivos van de mayor a menor y las columnas son los cuatro de no efectividad", () => {
    expect(modelo.motivos[0]).toMatchObject({ rotulo: "No contesta", total: 90, proporcion: 0.45 });
    expect(modelo.columnas.map((m) => m.rotulo)).toEqual(["No contesta", "Rechazo", "Ausente", "Vivienda desocupada"]);
  });

  it("por distrito, cada motivo por cada 100 intentos; sin intentos, cero y no NaN", () => {
    expect(modelo.distritos.map((fila) => [fila.distrito, fila.porCien])).toEqual([
      ["Ate", [0, 0, 0, 0]],
      ["San Martín de Porres", [40, 25, 0, 0]],
    ]);
  });

  it("el ritmo va por fecha y la tasa por UMP solo cuenta las que tienen parte", () => {
    expect(modelo.dias.map((dia) => dia.rotulo)).toEqual(["13/06", "14/06"]);
    expect(modelo.tasas.find((tramo) => tramo.rotulo === "10 a 20 %")?.umps).toBe(2);
    expect(modelo.medianaDeTasa).toBe(15);
  });

  it("la barra lleva cinco motivos y junta el resto en «Otros», sin repetir color", () => {
    const motivos = Array.from({ length: 8 }, (_, indice) => ({ clave: `m${indice}`, rotulo: `Motivo ${indice}`, total: 10 - indice, proporcion: (10 - indice) / 100 }));
    const barra = motivosDeLaBarra(motivos);
    expect(barra).toHaveLength(6);
    expect(barra[5]).toMatchObject({ clave: "otros", rotulo: "Otros 3 motivos", total: 5 + 4 + 3 });
    expect(barra.reduce((suma, motivo) => suma + motivo.total, 0)).toBe(motivos.reduce((suma, motivo) => suma + motivo.total, 0));
    expect(motivosDeLaBarra(motivos.slice(0, 6))).toHaveLength(6);
  });

  it("sin partes no hay ocurrencias", () => {
    expect(construirOcurrencias(null).conPartes).toBe(false);
  });
});
