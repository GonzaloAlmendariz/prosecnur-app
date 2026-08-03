import { describe, expect, it } from "vitest";

import {
  normalizeCalcMuestraMatrizEmbudo,
  type CalcMuestraMatrizEmbudo,
} from "./calcMuestraMatrizEmbudo";

function fixture(): Record<string, unknown> {
  return {
    schema: "calc_muestra_aulas_criterios_matriz_embudo_v1",
    owner: "calc_muestra_aulas_frame_v1.criterios_radiografia.matriz_embudo",
    source_schema: "calc_muestra_aulas_criterios_radiografia_v2",
    frame_hash: "frame-i18",
    momento: "marco_ejecutado",
    grain: "facultad_efectiva_x_criterio",
    unit: "curso_horario_unico",
    faculty_dimension: "curso_horario_efectiva",
    columns: [
      { criterion_id: "session_type", card_id: "session_type", label: "Tipo de sesión", status: "disponible", order: 0 },
      { criterion_id: "min_eligible", card_id: "minEligible", label: "Mínimo de elegibles", status: "disponible", order: 1 },
    ],
    rows: [
      row("fac-derecho", "Derecho", "faculty", 20, 12),
      row("__total__", "Total", "total", 40, 25),
    ],
  };
}

function row(
  facultyKey: string,
  facultyLabel: string,
  rowKind: "faculty" | "total",
  raw: number,
  eligible: number,
) {
  return {
    faculty_key: facultyKey,
    faculty_label: facultyLabel,
    row_kind: rowKind,
    n_ch_bruto: raw,
    n_ch_elegibles: eligible,
    cells: [
      cell("session_type", -3, -72),
      cell("min_eligible", -5, -118),
    ],
  };
}

function cell(criterionId: string, deltaCh: number, deltaEnrollments: number) {
  return {
    criterion_id: criterionId,
    reference: "marco_ejecutado",
    action: "quitar_restriccion",
    reconstruccion_valida: true,
    delta_ch: deltaCh,
    delta_matriculas: deltaEnrollments,
    delta_estudiantes_unicos: -60,
  };
}

describe("normalizeCalcMuestraMatrizEmbudo", () => {
  it("acepta el contrato exacto sin sumar impactos marginales", () => {
    const result = normalizeCalcMuestraMatrizEmbudo(fixture());
    expect(result?.frame_hash).toBe("frame-i18");
    expect(result?.rows).toHaveLength(2);
    expect(result?.rows[0].cells[0].delta.delta_ch).toBe(-3);
    expect(result?.rows[1].row_kind).toBe("total");
  });

  it.each([
    ["owner", "otro.owner"],
    ["source_schema", "calc_muestra_aulas_criterios_radiografia_v1"],
    ["grain", "criterio_x_facultad"],
    ["unit", "matricula"],
  ])("falla cerrado cuando %s deriva", (field, value) => {
    expect(normalizeCalcMuestraMatrizEmbudo({ ...fixture(), [field]: value })).toBeNull();
  });

  it("rechaza matrices con una celda ausente o más de una fila Total", () => {
    const missingCell = fixture();
    const rows = missingCell.rows as Array<Record<string, unknown>>;
    rows[0] = { ...rows[0], cells: (rows[0].cells as unknown[]).slice(0, 1) };
    expect(normalizeCalcMuestraMatrizEmbudo(missingCell)).toBeNull();

    const duplicatedTotal = fixture();
    (duplicatedTotal.rows as unknown[]).push(row("total-2", "Total 2", "total", 40, 25));
    expect(normalizeCalcMuestraMatrizEmbudo(duplicatedTotal)).toBeNull();
  });

  it("mantiene los null publicados cuando la reconstrucción marginal no es válida", () => {
    const raw = fixture();
    const rows = raw.rows as Array<Record<string, unknown>>;
    const cells = rows[0].cells as Array<Record<string, unknown>>;
    cells[0] = {
      ...cells[0],
      reconstruccion_valida: false,
      delta_ch: null,
      delta_matriculas: null,
      delta_estudiantes_unicos: null,
    };
    const result = normalizeCalcMuestraMatrizEmbudo(raw) as CalcMuestraMatrizEmbudo;
    expect(result.rows[0].cells[0].delta).toMatchObject({
      reconstruccion_valida: false,
      delta_ch: null,
      delta_matriculas: null,
      delta_estudiantes_unicos: null,
    });
  });

  it("exige enteros y coherencia completa entre validez y deltas", () => {
    const fractional = fixture();
    ((fractional.rows as Array<Record<string, unknown>>)[0].cells as Array<Record<string, unknown>>)[0]
      .delta_ch = -1.5;
    expect(normalizeCalcMuestraMatrizEmbudo(fractional)).toBeNull();

    const validWithoutDeltas = fixture();
    ((validWithoutDeltas.rows as Array<Record<string, unknown>>)[0].cells as Array<Record<string, unknown>>)[0]
      .delta_ch = null;
    expect(normalizeCalcMuestraMatrizEmbudo(validWithoutDeltas)).toBeNull();

    const invalidWithDeltas = fixture();
    ((invalidWithDeltas.rows as Array<Record<string, unknown>>)[0].cells as Array<Record<string, unknown>>)[0]
      .reconstruccion_valida = false;
    expect(normalizeCalcMuestraMatrizEmbudo(invalidWithDeltas)).toBeNull();
  });
});
