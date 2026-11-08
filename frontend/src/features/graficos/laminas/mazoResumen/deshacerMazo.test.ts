import { beforeEach, describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { agrupadorDelPlan } from "../../historialAgrupado";
import { usePlanStore } from "../../store";
import { deshacerInsercion } from "./deshacerMazo";
import { insertarTras } from "./modeloMazo";

const lamina = (id: string): Slide => ({ id, tipo: "p_slide_texto", payload: {} });

function insertar(ids: string[]) {
  agrupadorDelPlan.cortar();
  usePlanStore.getState().transformarLaminas((slides) => insertarTras(slides, ids.map(lamina), 1));
  return { slides: usePlanStore.getState().plan.slides, ids };
}

describe("deshacer la inserción del mazo", () => {
  beforeEach(() => {
    usePlanStore.setState({ plan: { slides: [lamina("a"), lamina("b")] }, past: [], future: [], selectedSlideId: "a" });
  });

  it("sin otra edición entre medio: deshace el paso y el plan queda como estaba", () => {
    const ins = insertar(["x", "y"]);
    expect(deshacerInsercion(usePlanStore.getState(), ins)).toBe("deshacer");
    expect(usePlanStore.getState().plan.slides.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("con otra edición después: quita sólo las del mazo y la otra edición sobrevive", () => {
    const ins = insertar(["x", "y"]);
    agrupadorDelPlan.cortar();
    usePlanStore.getState().transformarLaminas((slides) => [...slides, lamina("z")]);
    expect(deshacerInsercion(usePlanStore.getState(), ins)).toBe("quitar");
    expect(usePlanStore.getState().plan.slides.map((s) => s.id)).toEqual(["a", "b", "z"]);
    // Y el quitar también se deshace.
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.slides.map((s) => s.id)).toEqual(["a", "x", "y", "b", "z"]);
  });

  it("si ya no queda ninguna del mazo, no hace nada", () => {
    const ins = insertar(["x"]);
    agrupadorDelPlan.cortar();
    usePlanStore.getState().transformarLaminas((slides) => slides.filter((s) => s.id !== "x"));
    const antes = usePlanStore.getState().plan.slides;
    expect(deshacerInsercion(usePlanStore.getState(), ins)).toBe("nada");
    expect(usePlanStore.getState().plan.slides).toBe(antes);
  });
});
