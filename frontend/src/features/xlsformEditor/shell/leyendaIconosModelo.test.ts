import { describe, expect, it } from "vitest";
import { GLIFOS_MARCA } from "../kit/glifosMarca";
import { TIPOS_PREGUNTA } from "../kit/tiposPregunta";
import { gruposDeTipos, marcasDeLaLeyenda } from "./leyendaIconosModelo";

describe("leyenda de íconos del editor", () => {
  it("explica cada marca del riel con una línea propia", () => {
    const marcas = marcasDeLaLeyenda();
    expect(marcas.map((m) => m.clave).sort()).toEqual(Object.keys(GLIFOS_MARCA).sort());
    for (const m of marcas) expect(m.significado.length).toBeGreaterThan(15);
  });

  it("lista cada tipo con sello propio una sola vez, sin los cierres", () => {
    const listados = gruposDeTipos().flatMap((g) => g.tipos.map((t) => t.base));
    expect(new Set(listados).size).toBe(listados.length);
    expect(listados).not.toContain("end_group");
    expect(listados.length).toBe(TIPOS_PREGUNTA.length - 2);
    expect(gruposDeTipos()[0].grupo).toBe("opciones");
  });
});
