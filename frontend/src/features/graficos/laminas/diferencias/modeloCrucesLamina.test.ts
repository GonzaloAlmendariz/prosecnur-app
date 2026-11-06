import { describe, expect, it } from "vitest";
import { crucesDeLamina, crucesImplicitos, parcheCrucesLamina, tarjetasDeLamina } from "./modeloCrucesLamina";

const real = {
  cruces: ["area", "nivel_curricular", "sexo_marco", "primera_gen"],
  rotulos: { area: "Área", nivel_curricular: "Nivel", sexo_marco: "Sexo", primera_gen: "Estudios de padres" },
  cortos: { "Economía y Finanzas": "Econ. y Fin." },
};

describe("cruces de la lámina", () => {
  it("lee los cruces escritos, con sus nombres y cortos", () => {
    expect(crucesDeLamina(real)).toEqual(real.cruces);
    expect(crucesImplicitos(real)).toBe(false);
    expect(tarjetasDeLamina(real)).toEqual(real);
  });

  it("sin cruces escritos rigen los que la lámina rotula, como en el motor", () => {
    const p = { rotulos: { area: "Área", sexo: "Sexo" } };
    expect(crucesDeLamina(p)).toEqual(["area", "sexo"]);
    expect(crucesImplicitos(p)).toBe(true);
    expect(crucesDeLamina({})).toEqual([]);
    expect(crucesImplicitos({})).toBe(false);
  });

  it("cambiar un nombre con cruces implícitos los escribe y no pierde el cruce al vaciar su nombre", () => {
    const p = { rotulos: { area: "Área", sexo: "Sexo" } };
    expect(parcheCrucesLamina(p, { rotulos: { sexo: "Sexo" } })).toEqual({ cruces: ["area", "sexo"], rotulos: { sexo: "Sexo" } });
  });

  it("quitar un cruce quita su nombre; sin cruces, las dos claves van vacías", () => {
    expect(parcheCrucesLamina(real, { cruces: ["area"] })).toEqual({ cruces: ["area"], rotulos: { area: "Área" } });
    expect(parcheCrucesLamina({ cruces: ["area"], rotulos: { area: "Área" } }, { cruces: [] })).toEqual({ cruces: null, rotulos: null });
  });

  it("un cruce con base conserva el nombre escrito por su variable sin base", () => {
    expect(parcheCrucesLamina({ rotulos: { area: "Área" } }, { cruces: ["estudiantes$area"] }))
      .toEqual({ cruces: ["estudiantes$area"], rotulos: { area: "Área" } });
  });

  it("los cortos van solos; vacíos, como null", () => {
    expect(parcheCrucesLamina(real, { cortos: { A: "a" } })).toEqual({ cortos: { A: "a" } });
    expect(parcheCrucesLamina(real, { cortos: {} })).toEqual({ cortos: null });
  });
});
