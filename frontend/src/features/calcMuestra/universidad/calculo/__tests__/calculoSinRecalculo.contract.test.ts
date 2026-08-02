import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = [
  new URL("../CalculoCursosHorarioFacultadTab.tsx", import.meta.url),
  new URL("../cursosHorarioResultadoModel.ts", import.meta.url),
].map((file) => readFileSync(file, "utf8")).join("\n");

describe("contrato Cálculo I18", () => {
  it("proyecta el resultado R sin selector ni aritmética estadística React", () => {
    expect(sources).not.toMatch(/MetodoEstAulaSelector|estudiantesPorAula|aula_frame|mediana\s*\(/);
    expect(sources).not.toMatch(/Math\.ceil|\.reduce\s*\(/);
    expect(sources).toMatch(/aulas_por_estrato/);
    expect(sources).toMatch(/alumnos_por_ch_decision/);
  });
});
