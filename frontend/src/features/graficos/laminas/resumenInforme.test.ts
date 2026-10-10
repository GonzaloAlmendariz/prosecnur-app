import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../usePlanValidator";
import { agruparAvisos, rotuloLaminasYPartes, totalAvisos } from "./resumenInforme";

describe("rotuloLaminasYPartes", () => {
  it("sin conocer todas las láminas sólo cuenta láminas", () => {
    expect(rotuloLaminasYPartes(["a", "b"], { a: { estado: "nativa", partes: 2, avisos: 0 } })).toBe("2 láminas");
  });
  it("con todas vistas suma las partes «(cont.)»", () => {
    expect(rotuloLaminasYPartes(["a", "b"], {
      a: { estado: "nativa", partes: 2, avisos: 0 },
      b: { estado: "nativa", partes: 1, avisos: 0 },
    })).toBe("2 láminas · 3 partes");
  });
  it("sin partes extra no repite la cifra", () => {
    expect(rotuloLaminasYPartes(["a"], { a: { estado: "nativa", partes: 1, avisos: 0 } })).toBe("1 lámina");
  });
});

describe("agruparAvisos", () => {
  const issues: ValidationIssue[] = [
    { severity: "error", code: "slot-empty", message: "Falta el gráfico", slideId: "a" },
    { severity: "warning", code: "var-sin-base", message: "Sin base", slideId: "b" },
  ];
  it("separa lo que bloquea, lo que conviene revisar y lo que dijo el motor, en el orden del plan", () => {
    const g = agruparAvisos(issues, {
      b: { estado: "nativa", partes: 1, avisos: 1, avisosTexto: ["Se omitió una columna"] },
      a: { estado: "nativa", partes: 1, avisos: 0, avisosTexto: [] },
    }, ["a", "b"]);
    expect(g.bloquean.map((i) => i.slideId)).toEqual(["a"]);
    expect(g.revisar.map((i) => i.slideId)).toEqual(["b"]);
    expect(g.motor).toEqual([{ slideId: "b", avisos: ["Se omitió una columna"] }]);
    expect(totalAvisos(g)).toBe(3);
  });
});
