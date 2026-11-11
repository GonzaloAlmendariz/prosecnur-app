import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../../api/estudio";
import { resumenDeIntegracion } from "./integracionModel";

const base = (cambios: Partial<EstudioBase>): EstudioBase => ({
  nombre: "integrada",
  xlsform_file_id: "x1",
  xlsform_file_name: "integrada.xlsx",
  data_file_id: "d1",
  data_file_name: "integrada-respuestas.xlsx",
  data_ext: "xlsx",
  n_filas: 600,
  n_columnas: 80,
  added_at: "2026-01-01T00:00:00Z",
  ...cambios,
});

describe("resumenDeIntegracion", () => {
  it("una base sin integración no tiene resumen", () => {
    expect(resumenDeIntegracion(base({}))).toBeNull();
  });

  it("lee orígenes, archivos canónicos, fraseos y variantes como lo hacía IntegratedHistoryPanel", () => {
    const r = resumenDeIntegracion(base({
      multi_integrated: {
        version: 1,
        origin_key_name: "publico",
        guide: { filename: "guia.xlsx" },
        origins: [
          { key_value: "doc", label: "Docentes", source_kind: "surveymonkey", survey_id: "501" },
          { key_value: "est", label: "Estudiantes", source_kind: "manual", xlsform_file_name: "e.xlsx", data_file_name: "e-r.xlsx" },
        ],
        label_overrides_standard: { p1: "Edad" },
        label_overrides_by_key: { doc: { p2: "Cargo" } },
        variant_map: [{ from: "p3", to: "p3_doc", origin_key: "doc" }, { from: "p3", to: "p3_est", origin_key: "est" }],
      },
    }));
    expect(r?.llave).toBe("publico");
    expect(r?.fecha).toBeNull();
    expect(r?.archivos).toEqual([
      { rotulo: "Formulario guía", archivo: "guia.xlsx" },
      { rotulo: "Formulario integrado", archivo: "integrada.xlsx" },
      { rotulo: "Respuestas integradas", archivo: "integrada-respuestas.xlsx" },
    ]);
    expect(r?.origenes.map((o) => [o.llave, o.etiqueta, o.fuente])).toEqual([
      ["doc", "Docentes", "SurveyMonkey 501"],
      ["est", "Estudiantes", "e.xlsx + e-r.xlsx"],
    ]);
    expect(r?.fraseoComun).toHaveLength(1);
    expect(r?.fraseosPorOrigen.map((g) => g.entries.length)).toEqual([1]);
    expect(r?.variantes).toHaveLength(1);
    expect(r?.nVariantes).toBe(2);
  });
});
