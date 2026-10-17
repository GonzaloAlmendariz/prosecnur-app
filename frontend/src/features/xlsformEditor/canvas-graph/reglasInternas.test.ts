// Mata: contar como interna una regla entre dos secciones, atribuirla a la sección de afuera cuando hay una subsección
// común, u olvidar desplegar los ancestros para que la regla se vea.
import { describe, expect, it } from "vitest";
import type { GraphNode } from "./buildGraph";
import { reglasInternas } from "./reglasInternas";

const nodo = (id: string, children: GraphNode[] = []) => ({ id, kind: children.length ? "section" : "question", children }) as unknown as GraphNode;

describe("reglas internas de cada sección", () => {
  it("cuenta en la sección más interna común y despliega su cadena", () => {
    const sub = nodo("s:sub", [nodo("q:3"), nodo("q:4")]);
    const a = nodo("s:a", [nodo("q:1"), nodo("q:2"), sub]);
    const b = nodo("s:b", [nodo("q:5")]);
    const r = reglasInternas({
      rootNodes: [a, b],
      edges: [
        { source: "q:1", target: "q:2" }, // interna de a
        { source: "q:3", target: "q:4" }, // interna de sub (dentro de a)
        { source: "q:2", target: "q:5" }, // entre secciones: no es interna
        { source: "q:1", target: "q:2" }, // repetida
      ] as never,
    });
    expect(Object.fromEntries(r.porSeccion)).toEqual({ "s:a": 1, "s:sub": 1 });
    expect([...r.aDesplegar].sort()).toEqual(["s:a", "s:sub"]);
    expect(r.total).toBe(2);
  });
});
