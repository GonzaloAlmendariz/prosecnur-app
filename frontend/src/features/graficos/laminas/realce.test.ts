// Mata: dos realces a la vez (la mayor encendida con respuestas elegidas), un arg viejo que deja la mayor encendida al
// apagarla, o perder el resto de los overrides al alternar.
import { describe, expect, it } from "vitest";
import { conMayorAlternada, conRespuestasDestacadas, mayorActiva, resaltaMayor } from "./realce";

describe("realce de barras: un solo control", () => {
  it("«La más alta» se enciende soltando las respuestas y conserva lo demás", () => {
    const args = { overrides: { titulo: "x", resaltar_opciones: ["Sí"] } };
    const ov = conMayorAlternada(args, ["Sí"]);
    expect(ov).toEqual({ titulo: "x", resaltar_mayor: true });
    expect(mayorActiva({ overrides: ov }, [])).toBe(true);
  });
  it("pulsada otra vez se apaga; con un arg viejo queda en false para que no vuelva", () => {
    expect(conMayorAlternada({ overrides: { resaltar_mayor: true } }, [])).toEqual({});
    const viejo = { resaltar_mayor: true };
    const ov = conMayorAlternada(viejo, []);
    expect(ov).toEqual({ resaltar_mayor: false });
    expect(resaltaMayor({ ...viejo, overrides: ov })).toBe(false);
  });
  it("elegir una respuesta apaga la mayor; quitar la última la deja sin realce", () => {
    expect(conRespuestasDestacadas({ overrides: { resaltar_mayor: true } }, ["No"])).toEqual({ resaltar_opciones: ["No"] });
    expect(conRespuestasDestacadas({ overrides: { resaltar_opciones: ["No"] } }, [])).toEqual({});
  });
  it("con respuestas elegidas «La más alta» no rige aunque esté guardada", () => {
    expect(mayorActiva({ overrides: { resaltar_mayor: true } }, ["Sí"])).toBe(false);
  });
});
