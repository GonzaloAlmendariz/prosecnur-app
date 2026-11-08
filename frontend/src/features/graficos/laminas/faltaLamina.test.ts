// Lo que le falta a una lámina para dibujarse (Q4-2/Q4-4): mientras falte, ni «Sale como imagen» ni vista previa del motor.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { FALTAN_GRUPOS } from "./brecha/modeloBrechaGrupos";
import { faltaEnLamina } from "./faltaLamina";

const conGrafico = (graficador: string, args: Record<string, unknown>): Slide => ({
  id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador, args } },
});

describe("lo que le falta a una lámina", () => {
  const aperturas = { estilo: "resumen", vars: ["docentes$*"], regla: { tipo: "mayor_diferencia", n: 10 }, corte: "4,5" };

  it("las aperturas piden, en orden, la pregunta que divide y los grupos", () => {
    expect(faltaEnLamina(conGrafico("p_dumbbell", aperturas))).toMatch(/pregunta que define/);
    expect(faltaEnLamina(conGrafico("p_dumbbell", { ...aperturas, cruce: "docentes$p3", grupos: [] }))).toBe(FALTAN_GRUPOS);
    expect(faltaEnLamina(conGrafico("p_dumbbell", { ...aperturas, cruce: "docentes$p3", grupos: ["1", "2"] }))).toBeNull();
  });

  it("el contraste entre públicos, los demás gráficos y una lámina sin gráfico no piden nada", () => {
    expect(faltaEnLamina(conGrafico("p_dumbbell", { estilo: "resumen", cruce: null, bases: ["a", "b"] }))).toBeNull();
    expect(faltaEnLamina(conGrafico("p_panorama", {}))).toBeNull();
    expect(faltaEnLamina({ id: "p", tipo: "p_slide_portada", payload: { titulo: "Informe" } })).toBeNull();
  });
});
