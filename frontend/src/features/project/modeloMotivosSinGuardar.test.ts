import { describe, expect, it } from "vitest";
import { areaDeMotivo, normalizarMotivosSinGuardar, textoChipSinGuardar } from "./modeloMotivosSinGuardar";

describe("motivos de «sin guardar» (L22)", () => {
  it("normaliza lo que manda el backend y descarta lo ilegible", () => {
    const motivos = normalizarMotivosSinGuardar([
      { motivo: "codif_source_active", veces: 2, primera: "x", ultima: "2026-10-28T10:00:00Z" },
      { motivo: ["hojas_ruta_ok"], veces: [1], ultima: ["2026-10-28T09:00:00Z"] },
      { motivo: "" },
      null,
    ]);
    expect(motivos).toEqual([
      { motivo: "codif_source_active", veces: 2, ultima: "2026-10-28T10:00:00Z" },
      { motivo: "hojas_ruta_ok", veces: 1, ultima: "2026-10-28T09:00:00Z" },
    ]);
  });

  it("un backend viejo sin el campo no rompe nada", () => {
    expect(normalizarMotivosSinGuardar(undefined)).toEqual([]);
    expect(normalizarMotivosSinGuardar({})).toEqual([]);
  });

  it("traduce la clave a su área y deja «Otro cambio» para la función que marcó", () => {
    expect(areaDeMotivo("choice_code_mapping (migrado al abrir un .pulso antiguo)")).toBe("Códigos de respuesta");
    expect(areaDeMotivo("hojas_ruta_ok")).toBe("Hojas de ruta");
    expect(areaDeMotivo("calc_muestra_referencia_asistencia")).toBe("Cálculo de muestra");
    expect(areaDeMotivo("estudio")).toBe("Bases y archivos de Carga");
    expect(areaDeMotivo(".pulso_repair_algo")).toBe("Otro cambio");
  });

  it("R12-11: el chip dice el motivo en lenguaje llano, con la circunstancia que anotó el backend", () => {
    const m = (motivo: string) => ({ motivo, veces: 1, ultima: null });
    expect(textoChipSinGuardar([])).toBe("Cambios sin guardar");
    expect(textoChipSinGuardar([m("choice_code_mapping (migrado al abrir un .pulso antiguo)")]))
      .toBe("Cambios sin guardar: Códigos de respuesta, migrado al abrir un .pulso antiguo");
    // Dos claves del mismo módulo se dicen una vez; pasadas tres áreas, «y N más».
    expect(textoChipSinGuardar([m("graficos_plan"), m("plan_rows"), m("hojas_ruta_ok"), m("codif_x"), m("monitoreo_y")]))
      .toBe("Cambios sin guardar: Gráficos; Hojas de ruta; Codificación; y 1 más");
  });
});
