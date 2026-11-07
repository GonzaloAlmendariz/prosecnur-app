import { describe, expect, it } from "vitest";
import { densidadDelAncho } from "./useDensidadDelChrome";

describe("densidad de la barra de Material", () => {
  it("compacta desde 1120 hacia abajo, que incluye 1024 de la matriz de QA", () => {
    expect(densidadDelAncho(1024)).toBe("compact");
    expect(densidadDelAncho(1120)).toBe("compact");
    expect(densidadDelAncho(1280)).toBe("normal");
  });
});
