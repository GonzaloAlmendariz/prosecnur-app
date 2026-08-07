import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../api/client";
import { argAplica, argsQueAplican } from "./argDependencias";

const arg = (name: string, depende?: unknown): ArgMetadata =>
  ({ name, label: name, tipo_input: "string", grupo: "datos", depende }) as unknown as ArgMetadata;

describe("visibilidad de args por modo", () => {
  const args = [
    arg("modo"),
    arg("var", { arg: "modo", valores: ["sm"] }),
    arg("vars", { arg: "modo", valores: ["box"] }),
    arg("cruce", { arg: "modo", valores: ["sm", "box"] }),
    arg("corte", { arg: "modo", valores: ["publicos"] }),
  ];

  it("muestra sólo los campos del modo elegido", () => {
    const visto = (modo: string) =>
      argsQueAplican(args, { modo }).map((a) => a.name);
    expect(visto("sm")).toEqual(["modo", "var", "cruce"]);
    expect(visto("box")).toEqual(["modo", "vars", "cruce"]);
    // El radar entre públicos no lee ni `var` ni `cruce`: sus series son las
    // fuentes del estudio, no un cruce dentro de una base.
    expect(visto("publicos")).toEqual(["modo", "corte"]);
  });

  it("no esconde nada mientras no se haya elegido modo", () => {
    // Un panel vacío al abrir un graficador nuevo se lee como roto.
    expect(argsQueAplican(args, {}).map((a) => a.name)).toEqual(args.map((a) => a.name));
    expect(argsQueAplican(args, { modo: "" }).map((a) => a.name)).toHaveLength(args.length);
  });

  it("un arg sin dependencia siempre aplica", () => {
    expect(argAplica(arg("titulo"), { modo: "publicos" })).toBe(true);
    // Dependencia malformada = sin dependencia, en vez de esconder el campo.
    expect(argAplica(arg("x", { arg: "", valores: [] }), { modo: "sm" })).toBe(true);
    expect(argAplica(arg("y", "modo"), { modo: "sm" })).toBe(true);
  });

  it("acepta el escalar que jsonlite produce con un solo valor", () => {
    expect(argAplica(arg("corte", { arg: "modo", valores: "publicos" }), { modo: "publicos" })).toBe(true);
    expect(argAplica(arg("corte", { arg: "modo", valores: "publicos" }), { modo: "sm" })).toBe(false);
  });
});
