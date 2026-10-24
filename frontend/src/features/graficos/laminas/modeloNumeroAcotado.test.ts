import { describe, expect, it } from "vitest";
import { ajustarNumeroAcotado, borradorNumeroAcotado, limitesDeNumero } from "./modeloNumeroAcotado";

const maxCat = { name: "max_categorias", label: "Máximo de categorías", min: 2, max: 30, step: 1 };

describe("limitesDeNumero", () => {
  it("lee min, max y si es entero según el paso", () => {
    expect(limitesDeNumero(maxCat)).toEqual({ min: 2, max: 30, paso: 1, entero: true });
    expect(limitesDeNumero({ min: 0, max: 1, step: 0.05 })).toEqual({ min: 0, max: 1, paso: 0.05, entero: false });
  });
  it("sin min ni max no hay límites; un paso inválido se ignora", () => {
    expect(limitesDeNumero({ step: -1 })).toEqual({ min: undefined, max: undefined, paso: undefined, entero: false });
  });
});

describe("ajustarNumeroAcotado", () => {
  const l = limitesDeNumero(maxCat);
  it("dentro de rango: lo deja igual y no avisa", () => {
    expect(ajustarNumeroAcotado(12, l)).toEqual({ valor: 12, ajustado: false });
  });
  it("fuera de rango: va al límite más cercano", () => {
    expect(ajustarNumeroAcotado(1, l)).toEqual({ valor: 2, ajustado: true });
    expect(ajustarNumeroAcotado(99, l)).toEqual({ valor: 30, ajustado: true });
    expect(ajustarNumeroAcotado(-4, l)).toEqual({ valor: 2, ajustado: true });
  });
  it("vacío o no finito: sin valor (borra la clave)", () => {
    expect(ajustarNumeroAcotado(null, l)).toEqual({ valor: null, ajustado: false });
    expect(ajustarNumeroAcotado(Number.NaN, l)).toEqual({ valor: null, ajustado: false });
    expect(ajustarNumeroAcotado(Infinity, l)).toEqual({ valor: null, ajustado: false });
    expect(ajustarNumeroAcotado("abc", l)).toEqual({ valor: null, ajustado: false });
  });
  it("entero: redondea los decimales", () => {
    expect(ajustarNumeroAcotado(5.6, l)).toEqual({ valor: 6, ajustado: true });
  });
  it("decimal con paso: respeta el paso y el rango", () => {
    const d = limitesDeNumero({ min: 0, max: 1, step: 0.05 });
    expect(ajustarNumeroAcotado(0.5, d)).toEqual({ valor: 0.5, ajustado: false });
    expect(ajustarNumeroAcotado(1.4, d)).toEqual({ valor: 1, ajustado: true });
  });
});

describe("borradorNumeroAcotado", () => {
  const l = limitesDeNumero(maxCat);
  it("en enteros ignora lo que no es dígito", () => {
    expect(borradorNumeroAcotado("1a2-", l)).toBe("12");
  });
  it("un borrador sobre el máximo se ajusta de inmediato", () => {
    expect(borradorNumeroAcotado("45", l)).toBe("30");
  });
  it("un borrador bajo el mínimo se conserva hasta salir del campo", () => {
    expect(borradorNumeroAcotado("1", l)).toBe("1");
  });
});
