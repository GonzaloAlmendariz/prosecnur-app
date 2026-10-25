import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirDistritosDePartes, construirRitmoDePartes } from "./ocurrenciasPanelesModel";

const CORTE = {
  field_occurrences: {
    summary: { total_records: 3, intentos: 200, efectivas: 30, no_efectivas: 170 },
    by_outcome: [],
    by_district: [
      {
        distrito: "SIN CRUCE UMP", intentos: 10, ump_reportadas: 1, ump_sin_reporte: 0, efectivas: 2, no_efectivas: 8,
        outcomes: [
          { key: "rechazo", label: "No quería participar", total: 8 },
          { key: "presentes", label: "Miembros del hogar presentes pero ocupados", total: 2 },
        ],
      },
      {
        distrito: "SAN MARTIN DE PORRES", intentos: 150, ump_reportadas: 19, ump_sin_reporte: 6,
        ump_completas_sin_reporte: 4, ump_incompletas_sin_reporte: 2, validas_sin_reporte: 52, ultimo_ingreso_sin_reporte: "2026-06-24",
        efectivas: 20, no_efectivas: 130,
        outcomes: [
          { key: "efectiva", label: "Efectiva", total: 0 },
          { key: "ausente", label: "Miembros del hogar ausentes", total: 60 },
          { key: "cuota", label: "Fuera de cuota (sexo, edad)", total: 30 },
          { key: "rechazo", label: "No quería participar", total: 35 },
          { key: "vivienda", label: "Vivienda abandonada/sin vivencia/inaccesible", total: 5 },
        ],
      },
      { distrito: "ATE", intentos: 40, ump_reportadas: 3, ump_sin_reporte: 0, efectivas: 8, no_efectivas: 32, outcomes: [] },
    ],
    by_day: [
      { date: "2026-06-14", intentos: 80, efectivas: 10, no_efectivas: 70 },
      { date: "2026-06-13", intentos: 120, efectivas: 20, no_efectivas: 100 },
    ],
    by_ump: [],
    history: [
      { id: "a", type: "sync", status: "ok", response_count: 84, created_at: "2026-06-20T20:40:00Z", message: "" },
      { id: "b", type: "inspect", status: "warning", response_count: 0, created_at: "2026-06-21T15:00:00Z", message: "Falta una opción" },
      { id: "c", type: "xlsform", status: "ok", response_count: 0, created_at: "2026-06-12T23:11:00Z", message: "" },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Ocurrencias › Distritos", () => {
  const modelo = construirDistritosDePartes(CORTE);

  it("ordena por nombre y deja al final lo que no es un distrito", () => {
    expect(modelo.distritos.map((fila) => fila.distrito)).toEqual(["Ate", "San Martín de Porres", "UMP sin cruce con la ruta"]);
  });

  it("cada cifra en su campo: cobertura de partes, UMP trabajadas sin parte y no efectividad", () => {
    expect(modelo.distritos[1]).toMatchObject({
      intentos: 150, efectivas: 20, noEfectivas: 130, noEfectividad: "87 %",
      umpConParte: 19, umpTotal: 25, completasSinParte: 4, incompletasSinParte: 2, validasSinParte: 52, ultimoSinParte: "24/06",
    });
    expect(modelo).toMatchObject({ umpConParte: 23, umpTotal: 29 });
  });

  it("los tres motivos más frecuentes, con rótulo corto y el del formulario aparte", () => {
    expect(modelo.distritos[1].motivos.map((motivo) => [motivo.rotulo, motivo.total])).toEqual([
      ["Hogar ausente", 60], ["No quería participar", 35], ["Fuera de cuota", 30],
    ]);
    expect(modelo.distritos[1].motivos[2].completo).toBe("Fuera de cuota (sexo, edad)");
    for (const fila of modelo.distritos) for (const motivo of fila.motivos) expect(motivo.rotulo).not.toMatch(/[·(/]/);
  });

  it("el chip no recorta con «…»: el rótulo largo entra entero y parte línea", () => {
    expect(modelo.distritos[2].motivos.map((motivo) => motivo.rotulo)).toContain("Miembros del hogar presentes pero ocupados");
  });

  it("sin partes no hay modelo que pintar", () => {
    expect(construirDistritosDePartes(null).disponible).toBe(false);
  });
});

describe("Control › Ocurrencias › Ritmo", () => {
  const modelo = construirRitmoDePartes(CORTE);

  it("los días van por fecha, con la efectividad declarada de cada uno", () => {
    expect(modelo.dias.map((dia) => [dia.rotulo, dia.intentos, dia.efectividad])).toEqual([["13/06", 120, "17 %"], ["14/06", 80, "13 %"]]);
    expect(modelo).toMatchObject({ intentos: 200, pico: { intentos: 120, rotulo: "13/06" }, ultimoDia: "14/06" });
  });

  it("las lecturas del formulario, la más reciente primero, con tipo y estado legibles", () => {
    expect(modelo.lecturas.map((lectura) => [lectura.tipo, lectura.estado, lectura.tono, lectura.cuando])).toEqual([
      ["Revisión del formulario", "Con avisos", "aviso", "21/06 10:00"],
      ["Lectura de partes", "Correcta", "ok", "20/06 15:40"],
      ["Formulario generado", "Correcta", "ok", "12/06 18:11"],
    ]);
  });
});
