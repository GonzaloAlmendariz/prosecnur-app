import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { opcionesDeComposicion } from "./opcionesComposicion";

const lamina = (graficador: string, args: Record<string, unknown>) =>
  ({ tipo: "p_slide_1_grafico", payload: { grafico: { graficador, args } } }) as unknown as Slide;
const vars = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`T${i}`, [`a$p${i}`]]));

describe("opcionesDeComposicion", () => {
  it("un radar entre públicos con 4 criterios se dibuja como líneas y puntos sin tabla", () => {
    expect(Object.values(opcionesDeComposicion(lamina("p_radar", { modo: "publicos", vars: vars(4) })))[0]).toEqual({ formaRadar: "puntos", tabla: false });
  });
  it("con 5 criterios, la telaraña con su tabla", () => {
    expect(Object.values(opcionesDeComposicion(lamina("p_radar", { modo: "publicos", vars: vars(5) })))[0]).toEqual({ formaRadar: "radar", tabla: true });
  });
  it("los demás gráficos no cambian su dibujo", () => {
    expect(opcionesDeComposicion(lamina("p_dumbbell", { vars: vars(4) }))).toEqual({});
  });
});
