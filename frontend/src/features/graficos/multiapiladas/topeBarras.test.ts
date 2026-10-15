import { describe, expect, it } from "vitest";
import {
  MAX_BARRAS_MULTIAPILADAS,
  cabeOtroTema,
  conteoBarrasMultiapiladas,
  contarBarrasMultiapiladas,
  cupoBarras,
  excedeTope,
  laminasNecesarias,
  rotuloConteoBarras,
} from "./topeBarras";

describe("una multiapilada lleva hasta seis barras (Gonzalo, 2026-10-14)", () => {
  it("el tope es el del motor", () => {
    expect(MAX_BARRAS_MULTIAPILADAS).toBe(6);
  });

  it("var: una barra por pregunta; sin modo cuenta como var", () => {
    expect(contarBarrasMultiapiladas({ modo: "var", vars: ["p1", "p2", "p3"] })).toBe(3);
    expect(contarBarrasMultiapiladas({ vars: ["p1", "", "p2"] })).toBe(2);
    expect(contarBarrasMultiapiladas({ modo: "var", vars: "p1" })).toBe(1);
    expect(contarBarrasMultiapiladas({})).toBe(0);
    expect(contarBarrasMultiapiladas(null)).toBe(0);
  });

  it("var_cruce por públicos: cada tema aporta tantas barras como referencias", () => {
    const args = { modo: "var_cruce", vars: { tema_1: ["doc$p1", "est$p1", "adm$p1"], tema_2: ["doc$p2", "est$p2"] } };
    expect(contarBarrasMultiapiladas(args)).toBe(5);
  });

  it("cruce y var_cruce con grupo no se cuentan: el editor no sabe cuántas categorías salen", () => {
    expect(contarBarrasMultiapiladas({ modo: "cruce", var: "p1", cruces: "sexo" })).toBeNull();
    expect(contarBarrasMultiapiladas({ modo: "var_cruce", vars: ["p1", "p2"], cruces: "ciclo" })).toBeNull();
    expect(contarBarrasMultiapiladas({ modo: "var_cruce", vars: { tema_1: ["a$p1"] }, cruces: "ciclo" })).toBeNull();
  });

  it("multilista: suma sus bloques; un bloque por grupos vuelve el conteo un mínimo", () => {
    const bloques = [
      { modo: "var", vars: ["p1", "p2"] },
      { modo: "var_cruce", vars: { tema_1: ["a$p3", "b$p3"] } },
    ];
    expect(contarBarrasMultiapiladas({ modo: "multilista", bloques })).toBe(4);
    const conGrupos = { modo: "multilista", bloques: [...bloques, { modo: "cruce", var: "p4", cruces: "sexo" }] };
    expect(contarBarrasMultiapiladas(conGrupos)).toBeNull();
    expect(conteoBarrasMultiapiladas(conGrupos)).toEqual({ barras: 4, exacto: false });
    expect(contarBarrasMultiapiladas({ modo: "multilista", bloques: [{ modo: "multilista", bloques: [] }] })).toBeNull();
  });

  it("pasa del tope sólo con siete o más; un conteo parcial pasa si lo contado ya pasa", () => {
    const seis = conteoBarrasMultiapiladas({ modo: "var", vars: ["1", "2", "3", "4", "5", "6"] });
    expect(excedeTope(seis)).toBe(false);
    expect(cupoBarras(seis)).toBe(0);
    expect(excedeTope({ barras: 7, exacto: true })).toBe(true);
    expect(excedeTope({ barras: 7, exacto: false })).toBe(true);
    expect(excedeTope({ barras: 3, exacto: false })).toBe(false);
    expect(cupoBarras({ barras: 9, exacto: true })).toBe(0);
  });

  it("dice en cuántas láminas partir y rotula el conteo", () => {
    expect(laminasNecesarias(7)).toBe(2);
    expect(laminasNecesarias(12)).toBe(2);
    expect(laminasNecesarias(13)).toBe(3);
    expect(rotuloConteoBarras({ barras: 4, exacto: true })).toBe("4 de 6 barras");
    expect(rotuloConteoBarras({ barras: 4, exacto: false })).toBe("Al menos 4 de 6 barras");
  });

  it("otro tema cabe si queda lugar para uno como los que ya hay, contando los temas vacíos", () => {
    // Tres públicos: un tema lleno (3) deja lugar para otro; dos llenos, no.
    expect(cabeOtroTema([{ vars: ["a", "b", "c"] }], 3, 3)).toBe(true);
    expect(cabeOtroTema([{ vars: ["a", "b", "c"] }, { vars: ["d", "e", "f"] }], 3, 0)).toBe(false);
    // Un tema vacío ya reserva su lugar: no se siembran temas vacíos para pasar de seis al llenarlos.
    expect(cabeOtroTema([{ vars: ["a", "b", "c"] }, { vars: [] }], 3, 3)).toBe(false);
    // Temas de dos públicos entre cuatro bases: caben tres.
    expect(cabeOtroTema([{ vars: ["a", "b"] }, { vars: ["c", "d"] }], 4, 2)).toBe(true);
    // Sin preguntas todavía, el tema ocupa todos los públicos.
    expect(cabeOtroTema([{ vars: [] }], 3, 6)).toBe(true);
    expect(cabeOtroTema([{ vars: [] }, { vars: [] }], 3, 6)).toBe(false);
  });
});
