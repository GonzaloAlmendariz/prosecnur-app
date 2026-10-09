import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exploradorListo } from "./exploradorReadiness";

describe("AD6 · readiness del Explorador de bases", () => {
  it("es false mientras lee la base", () => {
    expect(exploradorListo({ fuenteTipo: "archivo", cargando: true, tienePerfil: false, error: null })).toBe(false);
  });

  it("es false en el primer render, antes de que arranque la lectura", () => {
    expect(exploradorListo({ fuenteTipo: "archivo", cargando: false, tienePerfil: false, error: null })).toBe(false);
  });

  it("es true en los estados terminales: leída, error o marco", () => {
    expect(exploradorListo({ fuenteTipo: "archivo", cargando: false, tienePerfil: true, error: null })).toBe(true);
    expect(exploradorListo({ fuenteTipo: "archivo", cargando: false, tienePerfil: false, error: "HTTP 500" })).toBe(true);
    expect(exploradorListo({ fuenteTipo: "marco", cargando: false, tienePerfil: false, error: null })).toBe(true);
    expect(exploradorListo({ fuenteTipo: null, cargando: false, tienePerfil: false, error: null })).toBe(true);
  });

  it("la marca de la vista sale de exploradorListo, no del conteo de columnas", () => {
    const fuente = readFileSync(join(__dirname, "ExploradorBasesTab.tsx"), "utf8");
    expect(fuente).toContain("data-audit-ready={exploradorListo(");
    expect(fuente).not.toContain('data-audit-ready={columnas.length');
    expect(fuente).not.toMatch(/data-audit-ready="false"/);
  });
});
