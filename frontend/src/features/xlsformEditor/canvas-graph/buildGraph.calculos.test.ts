// Mata: un mapa de lógica con cientos de tarjetas de cálculo sueltas, un cálculo que sí condiciona una pregunta y se
// pierde del mapa, y un conteo de omitidos que no dice cuántos son.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { buildLogicGraph } from "./buildGraph";

const fila = (type: string, name: string, extra: Partial<{ label: string; relevant: string; calculation: string }> = {}) =>
  [type, name, extra.label ?? name, extra.relevant ?? "", extra.calculation ?? ""];

describe("cálculos en el Mapa de lógica (E12)", () => {
  const structure = parseBuilderStructure({
    columns: ["type", "name", "label", "relevant", "calculation"],
    rows: [
      fila("calculate", "r1", { calculation: "once(random())" }),
      fila("calculate", "r2", { calculation: "once(random())" }),
      fila("calculate", "perfil", { calculation: "if(${r1} < 0.5, 'A', 'B')" }),
      fila("integer", "edad"),
      fila("calculate", "mayor", { calculation: "${edad} >= 18" }),
      fila("text", "p1", { relevant: "${mayor} = 'true'" }),
    ],
  });
  const g = buildLogicGraph(structure, []);
  const nombres = [...g.byId.values()].map((n) => n.name);

  it("los cálculos que ninguna condición cita no se dibujan y se cuentan", () => {
    expect(nombres).not.toContain("r1");
    expect(nombres).not.toContain("perfil");
    expect(g.calculosOmitidos).toBe(3);
  });

  it("el cálculo que condiciona una pregunta sigue en el mapa con su conexión", () => {
    expect(nombres).toContain("mayor");
    expect(g.edges.some((e) => g.byId.get(e.source)?.name === "mayor")).toBe(true);
  });
});
