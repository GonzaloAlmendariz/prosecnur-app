import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { construirRespuestas, duracionLegible, filtrarEnvios, mermaDeRepetidos, rotuloDeRepetidas } from "./respuestasModel";

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

const envio = (codigo: string, segundos: number, fecha = "2026-07-01") => ({
  CodPulso: codigo, "Fecha Kobo": fecha, "Duración segundos": segundos, Clasificación: "Normal (5+ min)", "Response ID": `${codigo}-${segundos}`,
});

describe("Control › Respuestas del telefónico", () => {
  const modelo = construirRespuestas({
    reports: reportes({
      control_tiempo_kobo: [
        envio("PDM1371", 365_100), // 101 h 25: hoy se rotula «Normal (5+ min)»
        envio("PDM1429", 960),
        envio("PDM1429", 1020),
        envio("1231", 1680),
        envio("PDM1640", 200),
      ],
      comparacion_codpulso: [
        { CodPulso: "PDM1371", Sede: "SJL", "Estado telefónico": "No barrido", Responsable: "Op-01" },
        { CodPulso: "PDM1429", Sede: "Pueblo Libre (PL)", "Estado telefónico": "Efectivo", Responsable: "Op-02" },
        { CodPulso: "PDM1640", Sede: "Cercado de Lima", "Estado telefónico": "Efectivo", Responsable: "Op-03" },
      ],
    }),
    segmento: "Sede",
  });

  it("marca más de 2 h, menos de 5 min, repetidas y las que no cruzan con la hoja", () => {
    const marcas = Object.fromEntries(modelo.envios.map((e) => [`${e.codigo}-${e.segundos}`, e.marcas]));
    expect(marcas["PDM1371-365100"]).toEqual(["mas-de-2h"]);
    expect(marcas["PDM1429-960"]).toEqual(["repetida"]);
    expect(marcas["1231-1680"]).toEqual(["no-cruza"]);
    expect(modelo.envios.find((e) => e.codigo === "PDM1371")?.llave).toBe("exacta");
    expect(marcas["PDM1640-200"]).toEqual(["corta"]);
    expect(modelo.porRevisar).toBe(5);
    expect([modelo.unicas, modelo.repetidos]).toEqual([4, 1]);
  });

  it("el chip y la cadena nombran cada uno la unidad que cuentan", () => {
    // PDM1429 llega dos veces: el chip filtra los 2 envíos marcados, la cadena descuenta 1.
    expect(modelo.casosRepetidos).toBe(1);
    expect(modelo.conteos.repetida).toBe(2);
    expect(rotuloDeRepetidas(modelo)).toBe("Repetidas: 1 caso, 2 envíos");
    expect(mermaDeRepetidos(modelo)).toBe("1 envío repetido de 1 caso");
    expect(mermaDeRepetidos({ repetidos: 0, casosRepetidos: 0 })).toBeUndefined();
  });

  it("reparte la duración en tramos con la cola de más de 2 h aparte", () => {
    expect(modelo.tramos.map((t) => t.casos)).toEqual([1, 0, 0, 2, 1, 0, 0, 1]);
    expect(modelo.tramos.at(-1)?.largo).toBe(true);
    expect(modelo.mediana).toBe(1020);
  });

  it("trae lo que dice la hoja de cada efectiva y filtra por marca", () => {
    expect(modelo.envios.find((e) => e.codigo === "PDM1640")).toMatchObject({ categoria: "Cercado de Lima", hojaDice: "Efectivo", cruza: true });
    expect(filtrarEnvios(modelo.envios, "repetida", "").map((e) => e.codigo)).toEqual(["PDM1429", "PDM1429"]);
    expect(filtrarEnvios(modelo.envios, "todas", "1371")).toHaveLength(1);
    // En «Todas» lo que no cruzó tal cual va primero.
    expect(filtrarEnvios(modelo.envios, "todas", "")[0].llave).not.toBe("exacta");
  });

  it("escribe la duración sin abreviaturas raras", () => {
    expect(duracionLegible(1770)).toBe("30 min");
    expect(duracionLegible(8520)).toBe("2 h 22");
  });

  it("cruza por los dígitos sólo cuando señalan un único caso", () => {
    const otro = construirRespuestas({
      reports: reportes({
        control_tiempo_kobo: [envio("1231", 900), envio("0019", 900)],
        comparacion_codpulso: [{ CodPulso: "PDM1231" }, { CodPulso: "MVH0019" }, { CodPulso: "MVV0019" }],
      }),
      segmento: "Sede",
    });
    expect(otro.envios.map((e) => e.llave)).toEqual(["normalizada", "no-cruza"]);
  });
});
