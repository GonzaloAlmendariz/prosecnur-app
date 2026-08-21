import { describe, expect, it } from "vitest";
import type { CalcMuestraWorkspace } from "../../../../../api/client";
import { universityEffectiveMappingPayload } from "../mapeoEfectivo";

/**
 * Medido en el recorrido del usuario nuevo con los archivos reales de HSVG2026:
 * la pantalla de Variables mostraba «Curso → CLAVECURSO», «Facultad → NOMBREFAC»…
 * pero al construir el marco el payload llevaba `mapping: {}`, porque solo
 * viajaba lo CONFIRMADO a mano. El motor infería por su cuenta y colapsaba la
 * identidad del aula a la franja horaria: 847 unidades en vez de 5.269.
 */
const COLUMNAS_BASE = [
  "ALUMNO", "APELLIDOYNOMBRE", "NOMBREFAC", "SEXO", "SEMESTRE", "EDAD",
  "CLAVECURSO", "NOMBRECURSO", "HORARIO",
];

function workspaceConColumnas(confirmadas: Array<{ role: string; column: string }> = []): CalcMuestraWorkspace {
  return {
    source_mode: "base_madre",
    source_bindings: [
      {
        id: "src-base-madre",
        role: "base_madre",
        label: "Base principal",
        file_id: "f1",
        sheet_name: "Data",
        sheet_diagnostics: [{ name: "Data", role: "base_madre", columns_sample: COLUMNAS_BASE }],
      },
    ],
    variable_mappings: confirmadas.map((c) => ({
      role: c.role,
      label: c.role,
      required: true,
      source_role: "base_madre",
      column: c.column,
      status: "confirmada",
    })),
  } as unknown as CalcMuestraWorkspace;
}

describe("universityEffectiveMappingPayload", () => {
  it("sin confirmar nada, viaja lo que la pantalla muestra (no un mapeo vacío)", () => {
    const payload = universityEffectiveMappingPayload(workspaceConColumnas(), null);

    expect(Object.keys(payload).length).toBeGreaterThan(0);
    expect(payload.faculty).toEqual(["NOMBREFAC"]);
    expect(payload.sex).toEqual(["SEXO"]);
  });

  it("lo confirmado por el usuario gana sobre la sugerencia", () => {
    const payload = universityEffectiveMappingPayload(
      workspaceConColumnas([{ role: "faculty", column: "NOMBRESPECI" }]),
      null,
    );

    expect(payload.faculty).toEqual(["NOMBRESPECI"]);
  });

  it("traduce los roles al vocabulario del motor", () => {
    const payload = universityEffectiveMappingPayload(
      workspaceConColumnas([
        { role: "course_schedule_id", column: "CLAVECURSO_HORARIO" },
        { role: "eligible", column: "CONDI" },
      ]),
      null,
    );

    expect(payload.classroom_id).toEqual(["CLAVECURSO_HORARIO"]);
    expect(payload.condition).toEqual(["CONDI"]);
    expect(payload.course_schedule_id).toBeUndefined();
  });
});
