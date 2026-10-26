// Renzo (Arte_v1-7, 2026-10-26): la app se congelaba al abrir el gráfico dependiente de la lámina del Sí/No. El efecto de los
// conteos dependía del arreglo de ranuras, que la maqueta re-arma en cada render: con los conteos en memoria, efecto →
// estado → render → ranuras nuevas → efecto, sin fin. Ahora depende de una firma de texto y no guarda lo mismo dos veces.
import { describe, expect, it } from "vitest";
import type { RanuraMaqueta } from "../modeloMaqueta";
import { firmaPedidos, mismosConteos } from "./useConteosMaqueta";

const ranura = (variable: string, graficador = "p_barras_agrupadas"): RanuraMaqueta =>
  ({ graficador, variable, pinta: "categorias", preguntas: [variable] }) as unknown as RanuraMaqueta;

describe("firmaPedidos", () => {
  it("dos arreglos distintos con lo mismo dan la misma firma (el efecto no se re-dispara)", () => {
    const a = [ranura("docentes$p18"), ranura("docentes$p19_1", "p_barras_apiladas")];
    const b = [ranura("docentes$p18"), ranura("docentes$p19_1", "p_barras_apiladas")];
    expect(a).not.toBe(b);
    expect(firmaPedidos(a)).toBe(firmaPedidos(b));
    expect(firmaPedidos(a)).toBe("docentes$p18");   // las apiladas no piden conteos
  });
  it("no depende del orden ni de las repetidas", () => {
    expect(firmaPedidos([ranura("b"), ranura("a"), ranura("b")])).toBe("a|b");
  });
});

describe("mismosConteos", () => {
  const c = (n: number) => new Map([["v", [{ codigo: "1", etiqueta: "Sí", n }]]]);
  it("los mismos conteos en otro Map son iguales (no se vuelve a guardar el estado)", () => {
    expect(mismosConteos(c(77), c(77))).toBe(true);
  });
  it("un conteo distinto sí cambia", () => {
    expect(mismosConteos(c(77), c(78))).toBe(false);
    expect(mismosConteos(c(77), new Map())).toBe(false);
  });
});
