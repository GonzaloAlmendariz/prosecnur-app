import { describe, expect, it } from "vitest";

import { estadoGuardado } from "./estadoGuardado";

describe("estadoGuardado", () => {
  it("sin hidratar no afirma nada", () => {
    expect(estadoGuardado({ hidratada: false, sucia: false, tocada: false })).toBe("loading");
  });

  it("sin cambios mientras la superficie no tocó la config", () => {
    expect(estadoGuardado({ hidratada: true, sucia: false, tocada: false })).toBe("idle");
  });

  it("cambios sin guardar mientras el autosave no confirma", () => {
    expect(estadoGuardado({ hidratada: true, sucia: true, tocada: true })).toBe("dirty");
  });

  it("guardado cuando lo que cambió ya se escribió", () => {
    expect(estadoGuardado({ hidratada: true, sucia: false, tocada: true })).toBe("saved");
  });
});
