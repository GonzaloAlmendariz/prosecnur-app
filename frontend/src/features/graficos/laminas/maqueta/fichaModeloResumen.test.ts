// ADR 0114: lo que la ficha de la maqueta dice de los gráficos del resumen ejecutivo.
import { describe, expect, it } from "vitest";
import { ajustesDelGlifo } from "./fichaModelo";

const ajustes = (g: string, args: Record<string, unknown>) => ajustesDelGlifo(g, args, false).ajustes;

describe("ficha · resumen ejecutivo (ADR 0114)", () => {
  it("divergentes: nombra la escala del resumen y un orden distinto del de por defecto", () => {
    expect(ajustes("p_barras_divergentes", {})).toEqual([]);
    expect(ajustes("p_barras_divergentes", { estilo: "resumen", orden: "top_two_box" })).toEqual(["Escala con Sin información aparte"]);
    expect(ajustes("p_barras_divergentes", { orden: "sin_informacion" })).toEqual(["Por Sin información"]);
  });

  it("brecha: el contraste con tabla de base y su separador; el separador no se nombra en el recetario", () => {
    expect(ajustes("p_dumbbell", { estilo: "resumen", separar_tras: 6 })).toEqual(["Contraste con tabla de base", "Separador tras la fila 6"]);
    expect(ajustes("p_dumbbell", { separar_tras: 6 })).toEqual([]);
    expect(ajustes("p_dumbbell", { estilo: "resumen", base_en: "tabla" })).toEqual(["Contraste con tabla de base", "Base en la tabla"]);
    expect(ajustes("p_dumbbell", { estilo: "resumen", base_en: "auto" })).toEqual(["Contraste con tabla de base"]);
    expect(ajustes("p_dumbbell", { base_en: "tabla" })).toEqual([]);
  });

  it("panorama: sólo una referencia distinta de 60 se nombra", () => {
    expect(ajustes("p_panorama", {})).toEqual([]);
    expect(ajustes("p_panorama", { referencia: 60 })).toEqual([]);
    expect(ajustes("p_panorama", { referencia: 70 })).toEqual(["Referencia 70 %"]);
  });
});
