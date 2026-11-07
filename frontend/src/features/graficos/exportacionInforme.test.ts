import { describe, expect, it } from "vitest";
import type { PlanJson } from "../../api/graficos";
import {
  avisosDelResultado, describirFalloDeInforme, ErrorDeInforme, tituloDeExportacion,
} from "./exportacionInforme";

const PLAN = { slides: [] } as unknown as PlanJson;

describe("exportación del informe sobre el kit de entregables", () => {
  it("el título dice qué archivo se genera", () => {
    expect(tituloDeExportacion("ppt", false)).toBe("Informe en PowerPoint");
    expect(tituloDeExportacion("ppt", true)).toBe("Informe compartido en PowerPoint");
    expect(tituloDeExportacion("word", false)).toBe("Informe en Word");
  });

  it("un error ya redactado pasa tal cual, con su cómo seguir", () => {
    const f = describirFalloDeInforme(new ErrorDeInforme({ message: "El informe compartido todavía no está listo para exportarse.", hint: "Completa cada base." }), PLAN);
    expect(f.legible).toEqual({ causa: "El informe compartido todavía no está listo para exportarse. Completa cada base.", codigo: null });
    expect(f.lamina).toBeNull();
  });

  it("el código E_* del backend se separa de la causa; la causa nunca lo arrastra", () => {
    const f = describirFalloDeInforme(new Error("Graficador no registrado: barras_x · E_GRAFICOS_RENDER"), PLAN);
    expect(f.legible.codigo).toBe("E_GRAFICOS_RENDER");
    expect(f.legible.causa).not.toContain("E_GRAFICOS_RENDER");
    expect(f.legible.causa.length).toBeGreaterThan(0);
  });

  it("los avisos del motor se leen del resultado; ausentes o raros quedan vacíos", () => {
    expect(avisosDelResultado({ avisos: ["Letra del eje reducida a 9,5 pt", "", 3] })).toEqual(["Letra del eje reducida a 9,5 pt"]);
    expect(avisosDelResultado({})).toEqual([]);
    expect(avisosDelResultado(null)).toEqual([]);
  });
});
