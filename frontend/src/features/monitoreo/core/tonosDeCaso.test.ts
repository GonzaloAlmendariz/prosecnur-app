import { describe, expect, it } from "vitest";
import { tonoDeConteo, tonoDeCruce, tonoDeLectura, tonoDeRespuesta } from "./tonosDeCaso";

describe("tonos de los estados de un caso (P6)", () => {
  it("la respuesta: completa en verde, parcial en ámbar, rechazo en rojo, el resto sin color", () => {
    expect(["complete", "partial", "refusal", "pending", "otra"].map(tonoDeRespuesta)).toEqual(["success", "warn", "danger", "neutral", "neutral"]);
  });

  it("el cruce: lo que no cruza avisa; lo que cruza lleva el azul", () => {
    expect(["sin_cruce", "sin_llave", "sin_base", "cruzado"].map(tonoDeCruce)).toEqual(["warn", "warn", "warn", "info"]);
  });

  it("el conteo: sólo el sí es verde; el no y la revisión avisan", () => {
    expect([true, false, null].map(tonoDeConteo)).toEqual(["success", "warn", "warn"]);
  });

  it("la lectura de plataforma o cruce", () => {
    expect((["effective", "partial", "refusal", "warning", "muted"] as const).map(tonoDeLectura)).toEqual(["success", "warn", "danger", "warn", "neutral"]);
  });
});
