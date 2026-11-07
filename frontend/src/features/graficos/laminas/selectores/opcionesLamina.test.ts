import { describe, expect, it } from "vitest";
import { payloadPorDefecto } from "../../store";
import { conOpcion, opcionDeLamina, opcionesDe, presetDe, PRESETS_LAMINA, tipoDeOpcion } from "./opcionesLamina";
import { INTENCIONES } from "./tiposLamina";

const resumir = INTENCIONES.find((i) => i.id === "resumen")!;

describe("«Hallazgos por capítulo» como tarjeta propia (H7; ADR 0135)", () => {
  it("«Resumir el informe» ofrece Hallazgos por capítulo, Hallazgos clave, Resumen de diferencias y Cierre con hallazgos", () => {
    expect(opcionesDe(resumir)).toEqual(["p_slide_hallazgos:resumen", "p_slide_hallazgos", "p_slide_resumen_diferencias", "p_slide_cierre_hallazgos"]);
    expect(presetDe("p_slide_hallazgos:resumen")?.nombre).toBe("Hallazgos por capítulo");
    expect(tipoDeOpcion("p_slide_hallazgos:resumen")).toBe("p_slide_hallazgos");
    expect(tipoDeOpcion("p_slide_resumen_diferencias")).toBe("p_slide_resumen_diferencias");
  });

  it("insertarla escribe el modo resumen con selección automática", () => {
    const p = conOpcion("p_slide_hallazgos:resumen", payloadPorDefecto("p_slide_hallazgos"));
    expect(p).toMatchObject({ modo: "resumen", seleccion: "auto" });
  });

  it("«Hallazgos clave» son las cifras: pasar desde un resumen quita el modo y la selección", () => {
    const p = conOpcion("p_slide_hallazgos", { titulo: "T", modo: "resumen", seleccion: "auto", capitulos: [] });
    expect(p).toEqual({ titulo: "T", modo: "cifras", capitulos: [] });
  });

  it("una lámina en resumen o en titulares ya es el resumen ejecutivo; en cifras, Hallazgos clave", () => {
    expect(opcionDeLamina({ tipo: "p_slide_hallazgos", payload: { modo: "resumen" } })).toBe("p_slide_hallazgos:resumen");
    expect(opcionDeLamina({ tipo: "p_slide_hallazgos", payload: { modo: "titulares" } })).toBe("p_slide_hallazgos:resumen");
    expect(opcionDeLamina({ tipo: "p_slide_hallazgos", payload: { modo: "cifras_con_graficos" } })).toBe("p_slide_hallazgos");
    expect(opcionDeLamina({ tipo: "p_slide_hallazgos", payload: {} })).toBe("p_slide_hallazgos");
    expect(opcionDeLamina({ tipo: "p_slide_1_grafico", payload: {} })).toBe("p_slide_1_grafico");
  });

  it("un tipo sin preset ni parche no cambia su payload", () => {
    expect(conOpcion("p_slide_texto", { titulo: "x" })).toEqual({ titulo: "x" });
    expect(opcionesDe(INTENCIONES.find((i) => i.id === "una")!)).toEqual(INTENCIONES.find((i) => i.id === "una")!.tipos);
  });

  it("cada preset pertenece a una intención que ofrece su tipo y su línea cabe en la tarjeta", () => {
    for (const p of PRESETS_LAMINA) {
      expect(INTENCIONES.find((i) => i.id === p.intencion)?.tipos, p.clave).toContain(p.tipo);
      expect(p.uso.length, p.clave).toBeLessThanOrEqual(56);
      expect(p.uso, p.clave).not.toMatch(/[·;—]/);
    }
  });
});
