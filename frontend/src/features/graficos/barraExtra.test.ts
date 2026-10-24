import { describe, expect, it } from "vitest";
import {
  alternarOpcion,
  barraExtraDeBloque,
  barraExtraDePreset,
  barraExtraDeTarjeta,
  encenderBarraExtra,
  estadoOpcion,
  mismaBarraExtra,
  normalizarBarraExtra,
  resolverBarraExtra,
  resumenBarraExtra,
  resumenDeBloques,
} from "./barraExtra";

describe("normalizarBarraExtra", () => {
  it("false y los arrays válidos pasan; el orden es el de las columnas (Top, Bottom, Conteos)", () => {
    expect(normalizarBarraExtra(false)).toBe(false);
    expect(normalizarBarraExtra(["bottom2box", "top2box"])).toEqual(["top2box", "bottom2box"]);
    expect(normalizarBarraExtra(["conteos"])).toEqual(["conteos"]);
  });
  it("lo ausente o ajeno es undefined: no declara nada", () => {
    for (const v of [undefined, null, "top2box", true, 3, {}]) expect(normalizarBarraExtra(v)).toBeUndefined();
  });
  it("un array vacío o sin opciones válidas es false; quita duplicados y opciones desconocidas", () => {
    expect(normalizarBarraExtra([])).toBe(false);
    expect(normalizarBarraExtra(["otra"])).toBe(false);
    expect(normalizarBarraExtra(["top2box", "top2box", "x"])).toEqual(["top2box"]);
  });
  it("Conteos no se combina con boxes: gana el box", () => {
    expect(normalizarBarraExtra(["conteos", "top2box"])).toEqual(["top2box"]);
  });
});

describe("alternarOpcion y estadoOpcion", () => {
  it("encender un box desde apagada deja solo ese box; Top y Bottom se combinan en orden de columnas", () => {
    expect(alternarOpcion(false, "bottom2box")).toEqual(["bottom2box"]);
    expect(alternarOpcion(["bottom2box"], "top2box")).toEqual(["top2box", "bottom2box"]);
  });
  it("quitar la última opción apaga la barra", () => {
    expect(alternarOpcion(["top2box"], "top2box")).toBe(false);
    expect(alternarOpcion(["conteos"], "conteos")).toBe(false);
  });
  it("Conteos y boxes se excluyen: la combinación se deshabilita y no cambia nada", () => {
    expect(estadoOpcion(["conteos"], "top2box")).toMatchObject({ activa: false, deshabilitada: true });
    expect(estadoOpcion(["top2box"], "conteos")).toMatchObject({ activa: false, deshabilitada: true });
    expect(estadoOpcion(["top2box"], "conteos").motivo).toMatch(/Conteos/);
    expect(alternarOpcion(["conteos"], "top2box")).toEqual(["conteos"]);
    expect(alternarOpcion(["top2box"], "conteos")).toEqual(["top2box"]);
  });
  it("sin nada elegido todo está disponible", () => {
    for (const o of ["top2box", "bottom2box", "conteos"] as const) expect(estadoOpcion(false, o)).toEqual({ activa: false, deshabilitada: false });
  });
});

describe("encenderBarraExtra", () => {
  it("ofrece Top Two Box si la pregunta tiene escala, y Conteos si no", () => {
    expect(encenderBarraExtra(true)).toEqual(["top2box"]);
    expect(encenderBarraExtra(false)).toEqual(["conteos"]);
  });
});

describe("lectura", () => {
  it("la tarjeta lee overrides.barra_extra y, sin él, args.barra_extra", () => {
    expect(barraExtraDeTarjeta({ overrides: { barra_extra: ["conteos"] }, barra_extra: ["top2box"] })).toEqual(["conteos"]);
    expect(barraExtraDeTarjeta({ barra_extra: ["top2box"] })).toEqual(["top2box"]);
    expect(barraExtraDeTarjeta({ overrides: { barra_extra: false } })).toBe(false);
    expect(barraExtraDeTarjeta({})).toBeUndefined();
  });
  it("el bloque lee su propia barra_extra", () => {
    expect(barraExtraDeBloque({ barra_extra: false })).toBe(false);
    expect(barraExtraDeBloque({ titulo: "x" })).toBeUndefined();
    expect(barraExtraDeBloque(null)).toBeUndefined();
  });
  it("el preset lee barra_extra; sin ella, las claves viejas (solo lectura de estilos guardados)", () => {
    expect(barraExtraDePreset({ barra_extra: ["conteos"] })).toEqual(["conteos"]);
    expect(barraExtraDePreset({ mostrar_barra_extra: true, barra_extra_preset: "top2box", columna_bottom2box: true })).toEqual(["top2box", "bottom2box"]);
    expect(barraExtraDePreset({ mostrar_barra_extra: false })).toBe(false);
    expect(barraExtraDePreset({ barra_extra: false, mostrar_barra_extra: true })).toBe(false);
    expect(barraExtraDePreset({})).toBeUndefined();
  });
});

describe("resolverBarraExtra: bloque > lámina > preset", () => {
  it("dice de dónde viene el valor efectivo", () => {
    expect(resolverBarraExtra({ bloque: ["conteos"], lamina: ["top2box"], preset: false })).toEqual({ valor: ["conteos"], origen: "bloque" });
    expect(resolverBarraExtra({ lamina: ["top2box"], preset: false })).toEqual({ valor: ["top2box"], origen: "lamina" });
    expect(resolverBarraExtra({ preset: ["top2box"] })).toEqual({ valor: ["top2box"], origen: "preset" });
  });
  it("un false propio manda sobre un preset encendido", () => {
    expect(resolverBarraExtra({ bloque: false, preset: ["top2box"] })).toEqual({ valor: false, origen: "bloque" });
  });
  it("sin nada declarado, apagada y de origen 'ninguno' (o el por defecto que se pase)", () => {
    expect(resolverBarraExtra({})).toEqual({ valor: false, origen: "ninguno" });
    expect(resolverBarraExtra({}, ["top2box"])).toEqual({ valor: ["top2box"], origen: "ninguno" });
  });
});

describe("comparar y resumir", () => {
  it("mismaBarraExtra ignora el orden de entrada normalizado", () => {
    expect(mismaBarraExtra(false, false)).toBe(true);
    expect(mismaBarraExtra(["top2box"], ["top2box"])).toBe(true);
    expect(mismaBarraExtra(["top2box"], false)).toBe(false);
    expect(mismaBarraExtra(["top2box"], ["conteos"])).toBe(false);
  });
  it("resumen legible", () => {
    expect(resumenBarraExtra(false)).toBe("Sin barra extra");
    expect(resumenBarraExtra(["top2box", "bottom2box"])).toBe("Top Two Box + Bottom Two Box");
    expect(resumenBarraExtra(["conteos"])).toBe("Conteos");
  });
});

describe("resumenDeBloques", () => {
  it("cuenta bloques con box, con barra propia y con box sin categorías, resolviendo contra la lámina", () => {
    const bloques = [
      { barra_extra: ["top2box"], top2box_labels: ["A", "B"] },
      { barra_extra: ["top2box"] },
      { barra_extra: false },
      { titulo: "hereda" },
      { barra_extra: ["conteos"] },
    ];
    expect(resumenDeBloques(bloques, ["top2box"])).toEqual({ total: 5, conBarra: 4, propios: 4, sinCategorias: 2, conBottomSinCategorias: 0 });
  });
  it("sin bloques, todo en cero", () => {
    expect(resumenDeBloques(undefined, false)).toEqual({ total: 0, conBarra: 0, propios: 0, sinCategorias: 0, conBottomSinCategorias: 0 });
  });
});
