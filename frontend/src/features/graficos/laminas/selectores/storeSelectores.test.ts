// Las dos acciones del plan que usan los selectores de F6.2: cambiar el tipo de una lámina y insertar una nueva. Ambas
// son ediciones (marcan `dirty`, entran al historial y se deshacen) y la inserción acota el índice al plan.
import { beforeEach, describe, expect, it } from "vitest";
import { usePlanStore, type GraficosConfig } from "../../store";

const plan = (): GraficosConfig => ({
  version: "graficos/4",
  plan: { slides: [
    { id: "a", tipo: "p_slide_portada", payload: { titulo: "A" } },
    { id: "b", tipo: "p_slide_1_grafico", payload: { titulo: "B", grafico: { graficador: "p_pie", args: { var: "P1" } } } },
  ] },
  presets: {},
  paletas: {},
  iconos: [],
} as unknown as GraficosConfig);

const ids = () => usePlanStore.getState().plan.slides.map((s) => s.id);

describe("setSlideTipo", () => {
  beforeEach(() => usePlanStore.getState().hydrate(plan()));

  it("cambia el tipo y el payload, marca dirty y se deshace en un paso", () => {
    usePlanStore.getState().setSlideTipo("b", "p_slide_2_graficos", { titulo: "B", izquierda: { graficador: "p_pie", args: {} }, derecha: null });
    let s = usePlanStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.past).toHaveLength(1);
    expect(s.plan.slides[1].tipo).toBe("p_slide_2_graficos");
    expect(s.plan.slides[0].tipo).toBe("p_slide_portada");

    s.undo();
    s = usePlanStore.getState();
    expect(s.plan.slides[1].tipo).toBe("p_slide_1_grafico");
    expect((s.plan.slides[1].payload as Record<string, unknown>).grafico).toEqual({ graficador: "p_pie", args: { var: "P1" } });
  });
});

describe("insertSlideAt", () => {
  beforeEach(() => usePlanStore.getState().hydrate(plan()));

  it("inserta en el índice pedido, la selecciona y es deshacible", () => {
    const id = usePlanStore.getState().insertSlideAt("p_slide_texto", { titulo: "N" }, 1);
    expect(ids()).toEqual(["a", id, "b"]);
    expect(usePlanStore.getState().selectedSlideId).toBe(id);
    expect(usePlanStore.getState().dirty).toBe(true);
    usePlanStore.getState().undo();
    expect(ids()).toEqual(["a", "b"]);
  });

  it("un índice fuera del plan se acota: más allá del final va al final, negativo al principio", () => {
    const fin = usePlanStore.getState().insertSlideAt("p_slide_texto", {}, 99);
    expect(ids()).toEqual(["a", "b", fin]);
    // -1 sin acotar entraría antes de la última (`slice(0, -1)`), no al principio.
    const inicio = usePlanStore.getState().insertSlideAt("p_slide_texto", {}, -1);
    expect(ids()).toEqual([inicio, "a", "b", fin]);
    const fraccion = usePlanStore.getState().insertSlideAt("p_slide_texto", {}, 1.7);
    expect(ids()).toEqual([inicio, fraccion, "a", "b", fin]);
  });
});
