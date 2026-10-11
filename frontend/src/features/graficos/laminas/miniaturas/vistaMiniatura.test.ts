import { describe, expect, it } from "vitest";
import type { EntradaMiniatura } from "./loteMiniaturas";
import { rotuloEstado, vistaDeMiniatura } from "./vistaMiniatura";

const e = (over: Partial<EntradaMiniatura>): EntradaMiniatura => ({ estado: "pendiente", clave: "k", src: null, anterior: null, error: null, ...over });

describe("vistaDeMiniatura", () => {
  it("cubre los cinco estados del lote y la ausencia de lote", () => {
    expect(vistaDeMiniatura(e({ estado: "ok", src: "u" }), undefined)).toEqual({ vista: "imagen", src: "u" });
    expect(vistaDeMiniatura(e({ estado: "sin_imagen" }), undefined).vista).toBe("composicion");
    expect(vistaDeMiniatura(e({ estado: "sin_datos", src: "u" }), undefined)).toEqual({ vista: "sin_datos", src: "u" });
    expect(vistaDeMiniatura(e({ estado: "error", error: "x" }), "p").vista).toBe("error");
    expect(vistaDeMiniatura(e({}), undefined).vista).toBe("esqueleto");
    expect(vistaDeMiniatura(undefined, undefined).vista).toBe("ficha");
    expect(vistaDeMiniatura(undefined, "p")).toEqual({ vista: "imagen", src: "p" });
  });

  it("al rehacer muestra la imagen previa atenuada en vez de vaciar la caja", () => {
    expect(vistaDeMiniatura(e({ anterior: "a" }), "p")).toEqual({ vista: "actualizando", src: "a" });
    expect(vistaDeMiniatura(e({}), "p")).toEqual({ vista: "actualizando", src: "p" });
  });

  it("el estado entra al nombre accesible", () => {
    expect(rotuloEstado("sin_datos")).toMatch(/sin datos/);
    expect(rotuloEstado("error")).toMatch(/no se pudo/);
    expect(rotuloEstado("imagen")).toBe("");
  });
});
