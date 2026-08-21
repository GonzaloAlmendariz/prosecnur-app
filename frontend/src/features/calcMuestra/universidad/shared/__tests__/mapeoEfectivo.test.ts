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
  "CLAVECURSO", "NOMBRECURSO", "HORARIO", "NOMBRESPECI",
  "CLAVECURSO_HORARIO", "CONDI",
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

describe("columna confirmada que ya no existe en el archivo", () => {
  /**
   * Medido en el proyecto real HSVG2026: su mapeo confirmado apunta a columnas
   * de una base anterior («Código PUCP», «Facultad»…) mientras los archivos
   * cargados son los crudos del DTI (ALUMNO, NOMBREFAC…). La pantalla mostraba
   * «6 de 6 requeridas confirmadas» en verde y el marco guardado era de otra
   * construcción; al reconstruir, el motor moría con «No se encontro columna de
   * estudiante» — verificado que la versión ANTERIOR fallaba igual, así que no
   * es una regresión sino un estado que nadie declaraba.
   */
  it("cae a la columna sugerida cuando la confirmada no está entre las columnas de la fuente", () => {
    const payload = universityEffectiveMappingPayload(
      workspaceConColumnas([{ role: "faculty", column: "Facultad" }]),
      null,
    );

    expect(payload.faculty).toEqual(["NOMBREFAC"]);
  });

  it("no manda una columna inexistente cuando tampoco hay sugerencia posible", () => {
    // El identificador de estudiante no se infiere solo (ALUMNO no se parece a
    // «id»): si lo confirmado ya no existe, el payload lo omite y el motor lee
    // la base con su propia lógica en vez de morir buscando una columna que no
    // está.
    const payload = universityEffectiveMappingPayload(
      workspaceConColumnas([{ role: "student_id", column: "Código PUCP" }]),
      null,
    );

    expect(payload.student_id).toBeUndefined();
  });

  it("respeta la confirmada cuando no se conocen las columnas de la fuente", () => {
    const ws = {
      source_mode: "base_madre",
      source_bindings: [{ id: "src-base-madre", role: "base_madre", label: "Base", file_id: "f1" }],
      variable_mappings: [
        { role: "student_id", label: "id", required: true, source_role: "base_madre", column: "Código PUCP", status: "confirmada" },
      ],
    } as unknown as CalcMuestraWorkspace;

    expect(universityEffectiveMappingPayload(ws, null).student_id).toEqual(["Código PUCP"]);
  });
});
