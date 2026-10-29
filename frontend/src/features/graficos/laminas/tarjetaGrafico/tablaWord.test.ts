import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import { CLAVE_TABLA_WORD, aplicaTablaWord, leerTablaWord, NOTA_TABLA_WORD, patchTablaWord, tablaWordPorLaLamina } from "./tablaWord";

type R = Record<string, unknown>;
// Un radar entre públicos con 6 criterios: Automática lo dibuja como radar con su tabla.
const vars6 = { vars: { a: ["x"], b: ["x"], c: ["x"], d: ["x"], e: ["x"], f: ["x"] } };
const publicos = { modo: "publicos", ...vars6 };
const aplicar = (args: R, v: boolean): R =>
  JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patchTablaWord(args, v)))) as R;

describe("tabla de datos en el Word (la regla de .radar_mb_word_tabla_procede)", () => {
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
  it("sin marcar sigue a «Tabla de datos»: Automática la pone con radar y con líneas y puntos, no con barras", () => {
    expect(leerTablaWord(publicos)).toBe(true);
    expect(leerTablaWord({ ...publicos, forma: "puntos" })).toBe(true);
    expect(leerTablaWord({ ...publicos, forma: "barras" })).toBe(false);
    expect(leerTablaWord({ ...publicos, forma: "barras", tabla: "si" })).toBe(true);
    expect(leerTablaWord({ ...publicos, tabla: "no" })).toBe(false);
    expect(tablaWordPorLaLamina(publicos)).toBe(true);
  });
  it("marcada va siempre, también con «No» o con barras (el motor: isTRUE(word_tabla) || ...)", () => {
    expect(leerTablaWord({ ...publicos, tabla: "no", word_tabla: true })).toBe(true);
    expect(leerTablaWord({ ...publicos, forma: "barras", word_tabla: true })).toBe(true);
    expect(tablaWordPorLaLamina({ ...publicos, forma: "barras", word_tabla: true })).toBe(false);
  });
  it("la clave vieja dentro de overrides no cuenta: el motor no la lee", () => {
    expect(leerTablaWord({ ...publicos, forma: "barras", overrides: { word_tabla: true } })).toBe(false);
  });
  it("encenderla escribe el argumento word_tabla = true y conserva los overrides", () => {
    const out = aplicar({ ...publicos, forma: "barras", overrides: { barra_extra: false } }, true);
    expect(out.word_tabla).toBe(true);
    expect(out.overrides).toEqual({ barra_extra: false });
  });
  it("apagarla retira el argumento, y retira la clave vieja de overrides si un plan la trae", () => {
    expect(aplicar({ ...publicos, forma: "barras", word_tabla: true }, false).word_tabla).toBeUndefined();
    const viejo = aplicar({ ...publicos, forma: "barras", overrides: { word_tabla: true, x: 1 } }, true);
    expect(viejo.overrides).toEqual({ x: 1 });
    expect(viejo.word_tabla).toBe(true);
    expect(aplicar({ ...publicos, overrides: { word_tabla: true } }, false).overrides).toBeUndefined();
  });
});
