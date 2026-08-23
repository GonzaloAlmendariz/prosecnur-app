import { describe, expect, it } from "vitest";
import { capitalizarDelMarco } from "./textoDelMarco";

describe("capitalizarDelMarco", () => {
  it("baja el grito del marco sin perder tildes ni eñes", () => {
    expect(capitalizarDelMarco("TALLER DE URBANISMO")).toBe("Taller de Urbanismo");
    expect(capitalizarDelMarco("ARTE Y DISEÑO")).toBe("Arte y Diseño");
    expect(capitalizarDelMarco("ARTES ESCÉNICAS")).toBe("Artes Escénicas");
  });

  it("respeta el formato apellido, nombre de los docentes", () => {
    expect(capitalizarDelMarco("CHINCHAYÁN BARRETO, RUTH ZARAGOZA"))
      .toBe("Chinchayán Barreto, Ruth Zaragoza");
  });

  it("no toca los números ni los romanos del nombre del curso", () => {
    // «TALLER DE URBANISMO 1» no puede volverse «... 1» con el 1 alterado, ni
    // «NIVEL III» convertirse en «Nivel Iii».
    expect(capitalizarDelMarco("TALLER DE URBANISMO 1")).toBe("Taller de Urbanismo 1");
    expect(capitalizarDelMarco("HISTORIA III")).toBe("Historia III");
    expect(capitalizarDelMarco("CÁLCULO 2 PARA INGENIERÍA")).toBe("Cálculo 2 para Ingeniería");
  });

  it("una partícula al principio sí lleva mayúscula", () => {
    expect(capitalizarDelMarco("DE LA CRUZ, JUAN")).toBe("De la Cruz, Juan");
  });

  it("deja intacto lo que ya viene en caja mixta", () => {
    // Volver a capitalizar destrozaria un nombre bien escrito.
    expect(capitalizarDelMarco("de la Cruz, Juan")).toBe("de la Cruz, Juan");
    expect(capitalizarDelMarco("McKenzie Ruiz")).toBe("McKenzie Ruiz");
  });

  it("no inventa texto donde no lo hay", () => {
    expect(capitalizarDelMarco("")).toBe("");
    expect(capitalizarDelMarco("   ")).toBe("");
  });
});

describe("capitalizarDelMarco · basura del marco", () => {
  it("quita el espacio colgado antes de la coma", () => {
    // Pasa cuando falta el segundo apellido: «CONTE , ANTONIO».
    expect(capitalizarDelMarco("CONTE , ANTONIO")).toBe("Conte, Antonio");
  });

  it("colapsa los espacios dobles", () => {
    expect(capitalizarDelMarco("TALLER  DE   URBANISMO")).toBe("Taller de Urbanismo");
  });
});
