import { beforeEach, describe, expect, it } from "vitest";
import { usePlanStore } from "./store";

describe("seleccionar una lámina no es una edición", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate({
      version: "graficos/4",
      plan: { slides: [
        { id: "a", tipo: "p_slide_portada", payload: { titulo: "A" } },
        { id: "b", tipo: "p_slide_1_grafico", payload: { titulo: "B" } },
      ] },
      presets: {},
      paletas: {},
      iconos: [],
    } as never);
    usePlanStore.getState().markClean();
  });

  it("select cambia la lámina sin marcar dirty ni tocar el historial", () => {
    const antes = usePlanStore.getState().past.length;
    usePlanStore.getState().select("b");
    const s = usePlanStore.getState();
    expect(s.selectedSlideId).toBe("b");
    expect(s.dirty).toBe(false);
    expect(s.past.length).toBe(antes);
  });

  it("una edición posterior sí marca dirty y conserva la selección para el guardado", () => {
    usePlanStore.getState().select("b");
    usePlanStore.getState().updateSlidePayload("b", { titulo: "B2" });
    const s = usePlanStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.selectedSlideId).toBe("b");
  });
});
