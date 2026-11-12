import { describe, expect, it } from "vitest";
import { respuestasAplicadas } from "./modeloRespuestasDeAplicar";

describe("respuestasAplicadas", () => {
  it("cada texto con sus veces y su código, por clave alineada como en el motor; sin código, vacío", () => {
    const filas = respuestasAplicadas(
      [
        { texto_normalizado: "en el barrio", texto: "En el barrio", variantes: 1, frecuencia: 2, uuids: [] },
        { texto_normalizado: "iglesia", texto: "Iglesia", variantes: 1, frecuencia: 5, uuids: [] },
      ],
      [{ id: "g", codigo: "10", etiqueta: "Centro religioso", respuestas: ["Iglesia"] }],
    );
    expect(filas.map((f) => [f.texto, f.veces, f.codigos])).toEqual([
      ["Iglesia", 5, ["10. Centro religioso"]],
      ["En el barrio", 2, []],
    ]);
  });
});
