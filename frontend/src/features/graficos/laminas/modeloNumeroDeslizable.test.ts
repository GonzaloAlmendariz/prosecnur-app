// Mata: arrastrar un número abierto (sin máximo) o de miles de pasos, dejar fuera de Aspecto la referencia del panorama,
// meter en el slider un número de Cálculo o mostrar un guardado fuera del tramo.
import { describe, expect, it } from "vitest";
import { campoDeslizable, rangoDeslizable, valorDeslizable } from "./modeloNumeroDeslizable";

describe("números de la tarjeta que se arrastran", () => {
  it("min y max finitos con hasta 200 pasos: el slider con su paso grande", () => {
    expect(rangoDeslizable({ name: "linea_x", min: 0, max: 100, step: 1 })).toEqual({ min: 0, max: 100, paso: 1, grande: 10 });
    expect(rangoDeslizable({ name: "size_ejes", min: 8, max: 20, step: 0.5 })).toEqual({ min: 8, max: 20, paso: 0.5, grande: 1 });
  });
  it("sin un extremo o con más de 200 pasos sigue el número", () => {
    expect(rangoDeslizable({ name: "max_categorias", min: 1 })).toBeNull();
    expect(rangoDeslizable({ name: "x", min: 0, max: 1000, step: 1 })).toBeNull();
    expect(rangoDeslizable({ name: "x", min: 5, max: 5 })).toBeNull();
  });
  it("el umbral rojo sin rango del registro se arrastra de 0 a 100", () => {
    expect(rangoDeslizable({ name: "umbral_rojo_pct" })).toMatchObject({ min: 0, max: 100 });
  });
  it("sólo Aspecto y la referencia del panorama", () => {
    expect(campoDeslizable({ name: "eje_min", min: 0, max: 99, step: 1 })).not.toBeNull();
    expect(campoDeslizable({ name: "referencia", min: 0, max: 100, step: 5 })).toMatchObject({ grande: 10 });
    expect(campoDeslizable({ name: "min_n", min: 1, max: 100, step: 1 })).toBeNull();
  });
  it("el valor del slider: el guardado acotado, o el de por defecto marcado como vacío", () => {
    const r = { min: 0, max: 100, paso: 1, grande: 10 };
    expect(valorDeslizable(140, 60, r)).toEqual({ valor: 100, vacio: false });
    expect(valorDeslizable(undefined, 60, r)).toEqual({ valor: 60, vacio: true });
    expect(valorDeslizable(null, null, r)).toEqual({ valor: 0, vacio: true });
  });
});
