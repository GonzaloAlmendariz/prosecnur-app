import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import { CLAVE_TABLA_WORD, aplicaTablaWord, leerTablaWord, NOTA_TABLA_WORD, patchTablaWord } from "./tablaWord";

type R = Record<string, unknown>;
const publicos = { modo: "publicos" };
const aplicar = (args: R, v: boolean): R =>
  JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patchTablaWord(args, v)))) as R;

describe("tabla de datos en el Word (solo-Word, apagada por defecto)", () => {
  it("la clave es word_tabla y la nota dice dónde va", () => {
    expect(CLAVE_TABLA_WORD).toBe("word_tabla");
    expect(NOTA_TABLA_WORD).toBe("Se inserta como tabla de Word, centrada y encima del gráfico");
  });
  it("solo aplica al radar entre públicos", () => {
    expect(aplicaTablaWord("p_radar", publicos)).toBe(true);
    expect(aplicaTablaWord("p_radar", { modo: "sm" })).toBe(false);
    expect(aplicaTablaWord("p_radar", {})).toBe(false);
    expect(aplicaTablaWord("p_barras_apiladas", publicos)).toBe(false);
  });
  it("sin la clave está apagada, aunque `tabla` sea «si»", () => {
    expect(leerTablaWord({ ...publicos, tabla: "si" })).toBe(false);
    expect(leerTablaWord({ ...publicos, overrides: { word_tabla: true } })).toBe(true);
    expect(leerTablaWord({ ...publicos, overrides: { word_tabla: "x" } })).toBe(false);
  });
  it("encenderla escribe overrides.word_tabla = true y conserva el resto", () => {
    const out = aplicar({ ...publicos, overrides: { barra_extra: false } }, true);
    expect(out.overrides).toEqual({ barra_extra: false, word_tabla: true });
  });
  it("apagarla retira la clave (coincide con el default) y deja overrides vacío como null", () => {
    expect(aplicar({ ...publicos, overrides: { word_tabla: true } }, false).overrides).toBeUndefined();
    expect(aplicar({ ...publicos, overrides: { word_tabla: true, x: 1 } }, false).overrides).toEqual({ x: 1 });
  });
});
