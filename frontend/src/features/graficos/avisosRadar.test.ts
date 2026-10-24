import { describe, expect, it } from "vitest";
import { avisoRadarDe } from "./avisosRadar";

const criterios = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`T${i}`, [`a$p${i}`]]));
const g = (args: Record<string, unknown>, graficador = "p_radar") => ({ graficador, args });

describe("avisoRadarDe", () => {
  it("avisa con más de 8 criterios y con la forma Radar forzada con pocos", () => {
    expect(avisoRadarDe(g({ modo: "publicos", vars: criterios(9) }))).toMatch(/más de 8/);
    expect(avisoRadarDe(g({ modo: "publicos", forma: "radar", vars: criterios(4) }))).toMatch(/rombo/);
    expect(avisoRadarDe(g({ modo: "publicos", forma: "radar", vars: criterios(2) }))).toMatch(/no se puede dibujar/);
  });
  it("calla cuando el motor dibuja bien o no es un radar entre públicos", () => {
    expect(avisoRadarDe(g({ modo: "publicos", vars: criterios(4) }))).toBeNull();
    expect(avisoRadarDe(g({ modo: "publicos", vars: criterios(6) }))).toBeNull();
    expect(avisoRadarDe(g({ modo: "general", vars: criterios(9) }))).toBeNull();
    expect(avisoRadarDe(g({ modo: "publicos", vars: criterios(9) }, "p_dumbbell"))).toBeNull();
  });
});
