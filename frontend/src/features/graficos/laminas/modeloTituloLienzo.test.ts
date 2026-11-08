import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { cuantasSinTitulo, parcheTitulo, siguienteSinTitulo, tituloEscrito } from "./modeloTituloLienzo";

const s = (id: string, titulo: unknown, tipo = "p_slide_1_grafico") => ({ id, tipo, payload: { titulo } }) as unknown as Slide;
const conTitulo = (x: Slide) => x.tipo !== "p_slide_portada";

describe("título en el lienzo: modelo", () => {
  it("lo escrito, sin sugerir: string o { text }, vacío si no hay", () => {
    expect(tituloEscrito({ titulo: "Género" })).toBe("Género");
    expect(tituloEscrito({ titulo: { text: "Edad", size: 20 } })).toBe("Edad");
    expect(tituloEscrito({})).toBe("");
  });

  it("el parche recorta y conserva la forma { text, … }", () => {
    expect(parcheTitulo({ titulo: "a" }, "  Nuevo ")).toEqual({ titulo: "Nuevo" });
    expect(parcheTitulo({ titulo: { text: "a", size: 20 } }, "B")).toEqual({ titulo: { text: "B", size: 20 } });
  });

  it("«Siguiente sin título» busca después de la actual, da la vuelta y salta las que no llevan título", () => {
    const plan = [s("p", "", "p_slide_portada"), s("a", "Uno"), s("b", ""), s("c", "Tres"), s("d", "  ")];
    expect(siguienteSinTitulo(plan, 2, conTitulo)).toBe(3);
    expect(siguienteSinTitulo(plan, 3, conTitulo)).toBe(5);
    expect(siguienteSinTitulo(plan, 5, conTitulo)).toBe(3);
    expect(siguienteSinTitulo(plan, null, conTitulo)).toBe(3);
    expect(cuantasSinTitulo(plan, conTitulo)).toBe(2);
  });

  it("la actual cuenta sólo al final de la vuelta; sin ninguna, null", () => {
    expect(siguienteSinTitulo([s("a", ""), s("b", "Dos")], 1, conTitulo)).toBe(1);
    expect(siguienteSinTitulo([s("a", "Uno")], 1, conTitulo)).toBeNull();
    expect(siguienteSinTitulo([], null, conTitulo)).toBeNull();
  });
});
