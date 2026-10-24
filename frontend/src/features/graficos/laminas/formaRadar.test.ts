import { describe, expect, it } from "vitest";
import { criteriosDelRadar, formaEfectivaRadar, type EntradaForma } from "./formaRadar";

const f = (e: Partial<EntradaForma>) => formaEfectivaRadar({ nCriterios: 5, ...e });

describe("formaEfectivaRadar (replica .radar_mb_forma del motor)", () => {
  it("auto con 5 a 8 criterios: radar con tabla, sin nota", () => {
    for (const n of [5, 6, 8]) expect(f({ nCriterios: n })).toEqual({ forma: "radar", conTabla: true, nota: null, aviso: null });
  });
  it("auto con menos de 5: líneas y puntos por defecto, sin tabla, con nota que dice por qué", () => {
    const r = f({ nCriterios: 4 });
    expect(r).toMatchObject({ forma: "puntos", conTabla: false, aviso: null });
    expect(r.nota).toBe("Se dibujará como líneas y puntos: este radar tiene 4 criterios (el radar pide 5 a 8)");
  });
  it("auto con menos de 5 y fallback barras", () => {
    const r = f({ nCriterios: 3, fallback_pocos: "barras" });
    expect(r).toMatchObject({ forma: "barras", conTabla: false });
    expect(r.nota).toContain("barras comparativas");
  });
  it("fallback_pocos no cambia una forma elegida ni los radares de 5 o más", () => {
    expect(f({ nCriterios: 6, fallback_pocos: "barras" }).forma).toBe("radar");
    expect(f({ nCriterios: 4, forma: "radar", fallback_pocos: "barras" }).forma).toBe("radar");
  });
  it("forma puntos y barras siempre, con cualquier número de criterios, sin nota", () => {
    expect(f({ forma: "puntos", nCriterios: 7 })).toEqual({ forma: "puntos", conTabla: false, nota: null, aviso: null });
    expect(f({ forma: "barras", nCriterios: 2 })).toEqual({ forma: "barras", conTabla: false, nota: null, aviso: null });
  });
  it("forma radar con 3 o 4 criterios: radar con aviso de triángulo o rombo", () => {
    expect(f({ forma: "radar", nCriterios: 4 })).toMatchObject({ forma: "radar", conTabla: true });
    expect(f({ forma: "radar", nCriterios: 4 }).aviso).toMatch(/rombo/);
    expect(f({ forma: "radar", nCriterios: 3 }).aviso).toMatch(/triángulo/);
  });
  it("forma radar con menos de 3: no se puede dibujar", () => {
    const r = f({ forma: "radar", nCriterios: 2 });
    expect(r.aviso).toMatch(/no se puede dibujar/);
    expect(r.forma).toBe("radar");
  });
  it("más de 8 criterios, en cualquier forma: aviso", () => {
    for (const forma of ["auto", "puntos", "radar", "barras"] as const) expect(f({ forma, nCriterios: 9 }).aviso).toMatch(/más de 8/);
  });
  it("tabla: auto sólo con radar; si en cualquier forma; no nunca", () => {
    expect(f({ nCriterios: 4, tabla: "si" }).conTabla).toBe(true);
    expect(f({ forma: "barras", tabla: "si" }).conTabla).toBe(true);
    expect(f({ nCriterios: 6, tabla: "no" }).conTabla).toBe(false);
    expect(f({ forma: "puntos", tabla: "auto" }).conTabla).toBe(false);
  });
  it("valores desconocidos caen en los defectos", () => {
    expect(f({ nCriterios: 4, forma: "x", fallback_pocos: "y", tabla: "z" })).toMatchObject({ forma: "puntos", conTabla: false });
  });
  it("sin criterios elegidos todavía: el dibujo de siempre, sin nota", () => {
    expect(f({ nCriterios: 0 })).toEqual({ forma: "radar", conTabla: true, nota: null, aviso: null });
  });
});

describe("criteriosDelRadar", () => {
  it("cuenta las entradas de vars (objeto por criterio) o los elementos de una lista", () => {
    expect(criteriosDelRadar({ vars: { a: ["x"], b: ["y"], c: ["z"] } })).toBe(3);
    expect(criteriosDelRadar({ vars: ["a", "b"] })).toBe(2);
    expect(criteriosDelRadar({})).toBe(0);
  });
});
