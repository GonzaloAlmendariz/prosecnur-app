import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PlazoVencidoError,
  conPlazo,
  fundirSeccionesDetectadas,
  resumenSecciones,
  seccionesAMaterializar,
  seccionesVisibles,
  variablesAnalizables,
} from "./estructuraDeSecciones";
import type { SeccionConfig } from "./store";

const sec = (id: string, variables: string[], extra: Partial<SeccionConfig> = {}): SeccionConfig => ({
  id,
  nombre: id.toUpperCase(),
  variables,
  oculto: false,
  orden: 0,
  ...extra,
});

describe("conPlazo", () => {
  afterEach(() => vi.useRealTimers());

  it("devuelve el valor si llega antes del plazo", async () => {
    await expect(conPlazo(Promise.resolve(7), 1000, "tarde")).resolves.toBe(7);
  });

  it("rechaza con PlazoVencidoError si la petición no vuelve", async () => {
    vi.useFakeTimers();
    const nunca = new Promise<number>(() => {});
    const espera = conPlazo(nunca, 500, "La detección tardó demasiado");
    vi.advanceTimersByTime(501);
    await expect(espera).rejects.toBeInstanceOf(PlazoVencidoError);
    await expect(espera).rejects.toThrow("La detección tardó demasiado");
  });

  it("propaga el error de la petición", async () => {
    await expect(conPlazo(Promise.reject(new Error("E_X")), 1000, "tarde")).rejects.toThrow("E_X");
  });
});

describe("secciones visibles y materialización", () => {
  const detectadas = [sec("a", ["v1"]), sec("b", ["v2"])];

  it("sin secciones declaradas se pinta lo detectado, sin escribirlo", () => {
    expect(seccionesVisibles([], detectadas).map((s) => s.id)).toEqual(["a", "b"]);
    expect(seccionesVisibles([], null)).toEqual([]);
  });

  it("con secciones declaradas mandan las declaradas", () => {
    const declaradas = [sec("x", ["v1", "v2"])];
    expect(seccionesVisibles(declaradas, detectadas).map((s) => s.id)).toEqual(["x"]);
    expect(seccionesAMaterializar(declaradas, detectadas)).toBeNull();
  });

  it("una decisión del usuario materializa lo detectado con su orden", () => {
    const m = seccionesAMaterializar([], detectadas);
    expect(m?.map((s) => [s.id, s.orden, s.manual])).toEqual([["a", 0, false], ["b", 1, false]]);
    expect(seccionesAMaterializar([], [])).toBeNull();
  });
});

describe("fundirSeccionesDetectadas", () => {
  it("conserva las manuales y añade al final las huérfanas", () => {
    const declaradas = [
      sec("a", ["viejo"], { nombre: "Renombrada", manual: true, oculto: true, orden: 1 }),
      sec("z", ["v9"], { manual: true, orden: 5 }),
      sec("b", ["v2"], { manual: false }),
    ];
    const fundidas = fundirSeccionesDetectadas(
      [sec("a", ["v1"]), sec("b", ["v2", "v3"])],
      declaradas,
    );
    expect(fundidas.map((s) => s.id)).toEqual(["a", "b", "z"]);
    expect(fundidas[0]).toMatchObject({ nombre: "Renombrada", oculto: true, variables: ["v1"] });
    expect(fundidas[1]).toMatchObject({ manual: false, variables: ["v2", "v3"] });
    expect(fundidas.map((s) => s.orden)).toEqual([0, 1, 2]);
  });
});

describe("Frecuencias sin secciones declaradas", () => {
  const variables = [
    { name: "p1", categorica: true },
    { name: "p2", categorica: true },
    { name: "edad", categorica: false },
    { name: "texto", categorica: false },
  ];

  it("no dice «0 activas»: usa la estructura del instrumento", () => {
    expect(resumenSecciones([])).toEqual({ modo: "instrumento" });
    expect(variablesAnalizables([], variables, new Set(["p2"]), ["edad"])).toBe(2);
  });

  it("con secciones declaradas cuenta solo las visibles", () => {
    const declaradas = [sec("a", ["p1", "edad"]), sec("b", ["p2"], { oculto: true })];
    expect(resumenSecciones(declaradas)).toEqual({ modo: "declaradas", activas: 1 });
    expect(variablesAnalizables(declaradas, variables, new Set(), ["edad"])).toBe(2);
    expect(variablesAnalizables(declaradas, variables, new Set(["p1"]), [])).toBe(0);
  });
});
