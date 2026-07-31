import { describe, expect, it } from "vitest";

import { detalleQueAporta } from "./DetalleDeCelda";

describe("detalleQueAporta", () => {
  it("calla la hora que el sello de fecha ya trae, aunque cambie el cero inicial", () => {
    // Las dos cadenas salen de la misma fila: el sello usa `timeStyle: "short"`
    // y el detalle `hour: "2-digit"`. La diferencia es solo ese cero.
    expect(detalleQueAporta("22/07/26, 1:51 p. m.", "01:51 p. m.")).toBeNull();
  });

  it("deja hablar a la hora cuando dice algo que el sello no dice", () => {
    expect(detalleQueAporta("22/07/26", "Sin hora registrada")).toBe("Sin hora registrada");
    expect(detalleQueAporta("2026-07-22T13:51", "Hora no normalizada")).toBe("Hora no normalizada");
  });

  it("calla el response_id cuando el caso ya se identifica con él", () => {
    expect(detalleQueAporta("119166927083", "119166927083")).toBeNull();
  });

  it("conserva el response_id cuando el caso se identifica por nombre o por código", () => {
    // Estas son las filas que un borrado a secas habría perdido.
    expect(detalleQueAporta("Fiorella Quispe Bustamante", "119155893044")).toBe("119155893044");
    expect(detalleQueAporta("20230804", "119163525400")).toBe("119163525400");
  });

  it("calla el resultado de cruce que repite su propia píldora", () => {
    expect(detalleQueAporta("Sin llave", "Sin llave")).toBeNull();
  });

  it("conserva la llave concreta cuando el cruce sí encontró una", () => {
    expect(detalleQueAporta("Cruzó por llave", "89726404")).toBe("89726404");
  });

  it("no pinta nada cuando no hay detalle", () => {
    expect(detalleQueAporta("Sin llave", "")).toBeNull();
    expect(detalleQueAporta("Sin llave", null)).toBeNull();
    expect(detalleQueAporta("Sin llave", undefined)).toBeNull();
    expect(detalleQueAporta("Sin llave", "   ")).toBeNull();
  });

  it("compara sin acentuar la diferencia de mayúsculas ni de espacios", () => {
    expect(detalleQueAporta("Ficha QR  ·  SurveyMonkey", "ficha qr")).toBeNull();
  });
});
