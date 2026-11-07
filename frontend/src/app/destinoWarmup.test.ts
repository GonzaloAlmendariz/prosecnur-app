import { describe, expect, it } from "vitest";
import { destinoWarmup } from "./destinoWarmup";

describe("destino del warm start", () => {
  it("una sección con ruta propia se rotula con su nombre y toma el color de su módulo", () => {
    const d = destinoWarmup("/validacion");
    expect(d?.rotulo).toBe("Validación");
    expect(d?.modulo.slug).toBe("procesamiento");
  });

  it("un módulo se rotula con su nombre corto", () => {
    expect(destinoWarmup("/calc-muestra")?.rotulo).toBe("Cálculo de muestra");
    expect(destinoWarmup("/monitoreo/")?.modulo.slug).toBe("monitoreo");
  });

  it("el Home no tiene destino", () => {
    expect(destinoWarmup("/")).toBeNull();
  });
});
