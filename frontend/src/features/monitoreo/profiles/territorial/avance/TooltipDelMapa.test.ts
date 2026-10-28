import { describe, expect, it } from "vitest";
import { anchoEstimadoDeTooltip } from "./TooltipDelMapa";

describe("TooltipDelMapa", () => {
  it("el globo crece con la línea más larga", () => {
    const corto = anchoEstimadoDeTooltip({ titulo: "UMP 1", lineas: ["Completa"] });
    const largo = anchoEstimadoDeTooltip({ titulo: "UMP 1", lineas: ["San Juan de Lurigancho, manzana titular 0210"] });
    expect(largo).toBeGreaterThan(corto);
  });
});
