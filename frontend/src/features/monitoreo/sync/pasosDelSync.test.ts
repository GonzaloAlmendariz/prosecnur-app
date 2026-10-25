import { describe, expect, it } from "vitest";
import { fusionarProgreso, normalizarProgresoDelJob } from "./pasosDelSync";

describe("paso N de M del sync", () => {
  it("lee step y steps del progreso del job", () => {
    expect(normalizarProgresoDelJob({ phase: "kobo_fetch", percent: 30, step: 2, steps: 4 }))
      .toEqual({ phase: "kobo_fetch", percent: 30, message: "", paso: 2, pasos: 4 });
  });

  it("sin step/steps no inventa un paso", () => {
    const progreso = normalizarProgresoDelJob({ phase: "running", percent: 40, current: 120, total: 400 });
    expect(progreso?.paso).toBeUndefined();
    expect(progreso?.pasos).toBeUndefined();
  });

  it("descarta un paso imposible", () => {
    expect(normalizarProgresoDelJob({ phase: "x", step: 5, steps: 4 })?.paso).toBeUndefined();
    expect(normalizarProgresoDelJob({ phase: "x", step: 0, steps: 4 })?.paso).toBeUndefined();
  });

  it("un tick sin paso (fases del on_complete) conserva el último conocido", () => {
    const recalculando = fusionarProgreso(null, { percent: 82, phase: "snapshot", message: "", paso: 4, pasos: 4 });
    const guardando = fusionarProgreso(recalculando, { percent: 96, phase: "save", message: "Guardando" });
    expect(guardando).toMatchObject({ paso: 4, pasos: 4, percent: 96, phase: "save" });
  });

  it("ni el paso ni el porcentaje retroceden", () => {
    const previo = fusionarProgreso(null, { percent: 50, phase: "a", message: "", paso: 3, pasos: 4 });
    const siguiente = fusionarProgreso(previo, { percent: 40, phase: "b", message: "", paso: 2, pasos: 4 });
    expect(siguiente).toMatchObject({ paso: 3, percent: 50 });
  });
});
