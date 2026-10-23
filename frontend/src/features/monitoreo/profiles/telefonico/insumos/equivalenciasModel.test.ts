import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoProfile } from "../../../../../api/client";
import { sugerenciasDeEquivalencia } from "../control/discrepanciasModel";
import { filasDeEquivalencia, paresParaGuardar } from "./equivalenciasModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const CORTE = reportes({
  control_tiempo_kobo: [
    { CodPulso: "A1", "Responsable plataforma": "Operador 14" },
    { CodPulso: "A2", "Responsable plataforma": "Op-03" },
    { CodPulso: "A3", "Responsable plataforma": "Ana Torres" },
    { CodPulso: "A4", "Responsable plataforma": "K-7" },
  ],
  comparacion_codpulso: [
    { CodPulso: "A1", Responsable: "Op-14" },
    { CodPulso: "A2", Responsable: "Op-03" },
    { CodPulso: "A3", Responsable: "Ana María Torres" },
    { CodPulso: "A5", Responsable: "Sin asignar" },
  ],
});

describe("equivalencia de nombres (P4)", () => {
  it("sugiere por dígitos y por nombre contenido, y deja sin pareja lo que no se parece", () => {
    expect(sugerenciasDeEquivalencia(["Operador 14", "op-03", "Ana Torres", "K-7"], ["Op-14", "Op-03", "Ana María Torres"])).toEqual([
      { kobo: "Ana Torres", hoja: "" },
      { kobo: "K-7", hoja: "" },
      { kobo: "Operador 14", hoja: "Op-14" },
    ]);
  });

  it("las confirmadas van primero y no se vuelven a sugerir", () => {
    const perfil = { enumerator_equivalences: [{ kobo: "Ana Torres", hoja: "Ana María Torres" }] } as unknown as MonitoreoProfile;
    const { filas, responsables, mismoNombre } = filasDeEquivalencia(CORTE, perfil);
    expect(filas.map((fila) => [fila.kobo, fila.estado])).toEqual([
      ["Ana Torres", "confirmada"], ["K-7", "sin_pareja"], ["Operador 14", "sugerida"],
    ]);
    expect(responsables).toEqual(["Ana María Torres", "Op-03", "Op-14"]);
    expect(mismoNombre).toBe(1);
  });

  it("guarda sólo pares con nombre de la hoja, sin repetir enumerador", () => {
    expect(paresParaGuardar([{ kobo: "op14", hoja: "Op-14" }, { kobo: "op14", hoja: "Otro" }, { kobo: "K-7", hoja: "" }]))
      .toEqual([{ kobo: "op14", hoja: "Op-14" }]);
  });
});

describe("con el bloque equivalencias_nombres del motor", () => {
  it("muestra lo que no es igual, con criterio y envíos, y cuenta los iguales", () => {
    const corte = reportes({
      equivalencias_nombres: [
        { "Enumerador Kobo": "K-7", "Responsable hoja": "", Estado: "sin_par", Criterio: "", "Envíos Kobo": 3 },
        { "Enumerador Kobo": "Operador 14", "Responsable hoja": "Op-14", Estado: "sugerida", Criterio: "mismo número", "Envíos Kobo": 57 },
        { "Enumerador Kobo": "Ana Torres", "Responsable hoja": "Ana María Torres", Estado: "confirmada", Criterio: "confirmada", "Envíos Kobo": 12 },
        { "Enumerador Kobo": "Op-03", "Responsable hoja": "Op-03", Estado: "igual", Criterio: "", "Envíos Kobo": 20 },
      ],
    });
    const { filas, responsables, mismoNombre } = filasDeEquivalencia(corte, null);
    expect(filas.map((fila) => [fila.kobo, fila.estado, fila.envios])).toEqual([
      ["K-7", "sin_pareja", 3], ["Operador 14", "sugerida", 57], ["Ana Torres", "confirmada", 12],
    ]);
    expect(filas[1].criterio).toBe("mismo número");
    expect(mismoNombre).toBe(1);
    expect(responsables).toEqual(["Ana María Torres", "Op-03", "Op-14"]);
  });
});
