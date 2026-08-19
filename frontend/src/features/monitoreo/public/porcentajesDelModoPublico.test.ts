import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// El build público —el que ve el cliente— formateaba así:
//
//     const pct = Math.abs(value) <= 1 ? value * 100 : value;
//
// Con eso **todo porcentaje menor que 1 % se multiplicaba por cien**: un estado
// que era el 0.8 % del total se publicaba como «80%». Y como la conjetura era
// por VALOR y no por columna, dentro de una misma lista unas filas se escalaban
// y otras no.
//
// Es el mismo molde que rompió el detector de escala del perfil de aulas —una
// heurística decidiendo la escala sin mirar el grueso de la columna—, y aquí ni
// siquiera había columna que mirar.
//
// La conjetura sigue existiendo, pero acotada a `pctDelPayload`: un porcentaje
// que llega de una hoja ajena puede venir en cualquiera de las dos escalas. Lo
// que ya nunca se adivina es lo que esta pantalla calcula.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "MonitoreoPublicReportPage.tsx"),
  "utf8",
);

const cuerpo = (nombre: string) => {
  const inicio = fuente.indexOf(`function ${nombre}(`);
  return inicio < 0 ? "" : fuente.slice(inicio, fuente.indexOf("\n}", inicio));
};

describe("el formateo no adivina la escala de lo que la pantalla calcula", () => {
  it("se encontraron las dos funciones", () => {
    // Si el parseo falla, los tests de abajo pasarían sin mirar nada.
    expect(cuerpo("formatPercent")).toContain("toLocaleString");
    expect(cuerpo("pctDelPayload")).toContain("<= 1");
  });

  it("formatPercent recibe 0-100 y no multiplica", () => {
    expect(cuerpo("formatPercent")).not.toContain("* 100");
    expect(cuerpo("formatPercent")).not.toContain("<= 1");
  });

  it("safePercent sigue devolviendo 0-100", () => {
    expect(cuerpo("safePercent")).toContain("* 100");
  });

  it("todo porcentaje leído del payload pasa por pctDelPayload", () => {
    // Las lecturas crudas que alimentan un `progress` o un `formatPercent`.
    const crudas = [...fuente.matchAll(/(?<!pctDelPayload\()rowNumber\((\w+), \[([^\]]*)\]\)/g)]
      .filter((m) => /pct|avance|porcentaje/i.test(m[2]))
      .map((m) => m[0]);
    expect(crudas).toEqual([]);
  });
});
