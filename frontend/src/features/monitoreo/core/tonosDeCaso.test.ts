import { describe, expect, it } from "vitest";
import { tonoDeCruce, tonoDeLectura, tonoDeRespuesta } from "./tonosDeCaso";

describe("tonos de los estados de un caso (P6)", () => {
  it("la respuesta: completa en verde, parcial en ámbar, rechazo en rojo, el resto sin color", () => {
    expect(["complete", "partial", "refusal", "pending", "otra"].map(tonoDeRespuesta)).toEqual(["success", "warn", "danger", "neutral", "neutral"]);
  });

  it("el cruce: lo que no cruza avisa; lo que cruza lleva el azul", () => {
    expect(["sin_cruce", "sin_llave", "sin_base", "cruzado"].map(tonoDeCruce)).toEqual(["warn", "warn", "warn", "info"]);
  });

  it("la lectura de plataforma o cruce", () => {
    expect((["effective", "partial", "refusal", "warning", "muted"] as const).map(tonoDeLectura)).toEqual(["success", "warn", "danger", "warn", "neutral"]);
  });
});
