// R3 (2026-10-15). Mata: perder la nota con un motor viejo (el booleano tiene que seguir escribiéndose), un modo que no
// se deduce del booleano viejo, o un texto automático distinto del que escribe el motor.
import { describe, expect, it } from "vitest";
import { conModoNota, conTextoNota, leerNota, textoAutomatico } from "./notaRedondeo";

describe("nota al pie del redondeo", () => {
  it("sin modo guardado, se deduce del booleano viejo", () => {
    expect(leerNota({}, true).modo).toBe("siempre");
    expect(leerNota({}, false).modo).toBe("nunca");
  });
  it("cada modo escribe también el booleano que entiende un motor viejo", () => {
    expect(conModoNota({}, "si_no_cierra").base).toMatchObject({ nota_redondeo_modo: "si_no_cierra", nota_redondeo: true });
    expect(leerNota(conModoNota({}, "si_no_cierra"), false).modo).toBe("si_no_cierra");
    const nunca = conModoNota(conModoNota({}, "siempre"), "nunca");
    expect(leerNota(nunca, false).modo).toBe("nunca");
  });
  it("el texto propio se guarda y, vacío, vuelve al automático", () => {
    const con = conTextoNota({}, "Se excluyen las respuestas en blanco.");
    expect(leerNota(con, true).texto).toBe("Se excluyen las respuestas en blanco.");
    expect(leerNota(conTextoNota(con, "  "), true).texto).toBe("");
  });
  it("el automático dice lo mismo que el motor", () => {
    expect(textoAutomatico("estandar", 0)).toBe("Los porcentajes están redondeados al entero más cercano, por lo que pueden no sumar exactamente 100 %.");
    expect(textoAutomatico("reparto", 1)).toContain("a 1 decimal repartiendo el resto");
  });
});
