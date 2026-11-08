// F1: la ficha de la maqueta dice el nombre que el mazo guardó en `meta.nombre`, no el del tipo del gráfico.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { nombreTipoEnFicha } from "./nombreEnFicha";

const lamina = (meta: Record<string, unknown> = {}): Slide => ({
  id: "s26", tipo: "p_slide_1_grafico",
  payload: { titulo: "", meta, grafico: { graficador: "p_barras_divergentes", args: {} } },
});

describe("el nombre en la ficha de la maqueta", () => {
  it("con meta.nombre y un solo gráfico, el nombre del mazo", () => {
    expect(nombreTipoEnFicha(lamina({ nombre: "Escala bajo 60%, Docentes" }), "Escala con Sin información aparte", 1)).toBe("Escala bajo 60%, Docentes");
  });

  it("sin meta.nombre, con dos gráficos o sin gráfico, el del tipo", () => {
    expect(nombreTipoEnFicha(lamina(), "Escala con Sin información aparte", 1)).toBe("Escala con Sin información aparte");
    expect(nombreTipoEnFicha(lamina({ nombre: "  " }), "Escala con Sin información aparte", 1)).toBe("Escala con Sin información aparte");
    expect(nombreTipoEnFicha(lamina({ nombre: "Escala bajo 60%" }), "Escala con Sin información aparte", 2)).toBe("Escala con Sin información aparte");
    expect(nombreTipoEnFicha(lamina({ nombre: "Escala bajo 60%" }), null, 1)).toBeNull();
  });

  it("la Dicotómica conserva su nombre (de él sale su ícono)", () => {
    expect(nombreTipoEnFicha(lamina({ nombre: "Sí y No" }), "Dicotómica", 1)).toBe("Dicotómica");
  });
});
