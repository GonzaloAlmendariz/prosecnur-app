import { describe, expect, it } from "vitest";
import { contarEstados, estadosDeLaminas, pasaFiltro } from "./estadoTarjetas";

// I3 (2026-10-14). Mata: una prioridad invertida (la pill diría «Faltan colores» con un aviso que bloquea), avisos sin
// lámina contados en una tarjeta, o una lámina de estructura (sin ranuras) marcada «Sin gráfico».
describe("estado de las tarjetas del Informe", () => {
  const laminas = [
    { id: "a", ranuras: 1, ranurasLlenas: 1 },
    { id: "b", ranuras: 2, ranurasLlenas: 1 },
    { id: "c", ranuras: 1, ranurasLlenas: 1 },
    { id: "d", ranuras: 0, ranurasLlenas: 0 },
    { id: "e", ranuras: 2, ranurasLlenas: 0 },
  ];
  const estados = estadosDeLaminas(laminas, [{ slideId: "a", severity: "error" }, { severity: "warning" }], { b: 2 }, new Set(["a", "c"]));

  it("aviso > faltan colores > sin gráfico > lista", () => {
    expect(estados.get("a")).toEqual({ clave: "aviso", texto: "1 aviso" });
    expect(estados.get("b")).toEqual({ clave: "aviso", texto: "2 avisos" });
    expect(estados.get("c")).toEqual({ clave: "colores", texto: "Faltan colores" });
    expect(estados.get("d")).toEqual({ clave: "lista", texto: "Lista" });
    expect(estados.get("e")).toEqual({ clave: "vacia", texto: "Sin gráfico" });
  });

  it("cuenta por filtro y filtra", () => {
    expect(contarEstados(estados)).toEqual({ todas: 5, aviso: 2, colores: 1, vacia: 1 });
    expect(pasaFiltro("todas", estados.get("d"))).toBe(true);
    expect(pasaFiltro("colores", estados.get("c"))).toBe(true);
    expect(pasaFiltro("colores", estados.get("a"))).toBe(false);
  });
});
