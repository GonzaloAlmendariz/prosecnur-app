import { describe, expect, it } from "vitest";
import { PROSECNUR_MODULES } from "../modules";
import {
  ALIAS_DE_MODULO,
  ALIAS_DE_RUTA,
  rutaCanonicaDeModulo,
  slugCanonicoDeModulo,
  slugsCanonicosDeModulo,
} from "./aliasDeModulo";

describe("alias de módulo (ADR 0108)", () => {
  it("lee `recopiladores` como Material de campo", () => {
    expect(slugCanonicoDeModulo("recopiladores")).toBe("material-campo");
    expect(slugCanonicoDeModulo("material-campo")).toBe("material-campo");
    expect(slugCanonicoDeModulo("monitoreo")).toBe("monitoreo");
  });

  it("un alias nunca es un slug vigente y siempre apunta a uno", () => {
    const vigentes = new Set<string>(PROSECNUR_MODULES.map((m) => m.slug));
    for (const [viejo, nuevo] of Object.entries(ALIAS_DE_MODULO)) {
      expect(vigentes.has(viejo), viejo).toBe(false);
      expect(vigentes.has(nuevo), nuevo).toBe(true);
    }
    const rutas = new Set(PROSECNUR_MODULES.map((m) => m.to));
    for (const [vieja, nueva] of Object.entries(ALIAS_DE_RUTA)) {
      expect(rutas.has(vieja), vieja).toBe(false);
      expect(rutas.has(nueva), nueva).toBe(true);
    }
  });

  it("deduplica cuando el proyecto trae el slug viejo y el nuevo", () => {
    expect(slugsCanonicosDeModulo(["recopiladores", "monitoreo", "material-campo"])).toEqual([
      "material-campo",
      "monitoreo",
    ]);
  });

  it("reescribe la ruta del módulo conservando query y hash", () => {
    expect(rutaCanonicaDeModulo("/recopiladores")).toBe("/material-campo");
    expect(rutaCanonicaDeModulo("/recopiladores?seccion=accesos&pestana=canales#x")).toBe(
      "/material-campo?seccion=accesos&pestana=canales#x",
    );
  });

  it("traduce la sección Entrega de Hojas de ruta a Selección", () => {
    expect(rutaCanonicaDeModulo("/hojas-ruta?seccion=entrega&pestana=cuotas")).toBe(
      "/hojas-ruta?seccion=seleccion&pestana=cuotas",
    );
    expect(rutaCanonicaDeModulo("/hojas-ruta?stage=entrega")).toBe("/hojas-ruta?stage=seleccion");
    expect(rutaCanonicaDeModulo("/hojas-ruta?seccion=muestra")).toBe("/hojas-ruta?seccion=muestra");
  });

  it("deja intactas las rutas vigentes y las externas", () => {
    expect(rutaCanonicaDeModulo("/monitoreo?seccion=avance")).toBe("/monitoreo?seccion=avance");
    expect(rutaCanonicaDeModulo("https://example.org/recopiladores")).toBe(
      "https://example.org/recopiladores",
    );
    expect(rutaCanonicaDeModulo("")).toBe("");
  });
});
