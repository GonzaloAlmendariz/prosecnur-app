import { describe, expect, it } from "vitest";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";
import {
  universityColumnOptionsBySource,
  universityRoleColumnOptions,
  universitySourceGroupForRole,
} from "./categorias";
import { UNIVERSITY_REQUIRED_VARIABLES } from "./constants";

// Columnas crudas de cada hoja, con una homónima ("Condición") en ambas.
const STUDENT_COLS = ["Código PUCP", "Facultad", "Sexo", "Edad", "Formación", "Condición"];
const CLASSROOM_COLS = ["Tipo de docente", "Docente", "Sesiones y aula", "Horario", "Condición"];

function bindingWithSheet(
  role: string,
  sheetName: string,
  columns: string[],
  detectedRole: string,
): CalcMuestraWorkspaceSourceBinding {
  return {
    id: `src-${role}`,
    role,
    label: role,
    status: "cargada",
    file_id: `file-${role}`,
    sheet_name: sheetName,
    detected_role: detectedRole,
    sheet_diagnostics: [
      { name: sheetName, role: detectedRole, columns_sample: columns },
    ],
  };
}

function dosBasesWorkspace(): CalcMuestraWorkspace {
  return {
    source_bindings: [
      bindingWithSheet("estudiantes", "MATRICULADO", STUDENT_COLS, "estudiantes"),
      bindingWithSheet("catalogo_curso_horario", "CURSO Y HORARIO", CLASSROOM_COLS, "catalogo_curso_horario"),
    ],
    variable_mappings: [],
  } as unknown as CalcMuestraWorkspace;
}

const sourceRoleFor = (role: string) =>
  UNIVERSITY_REQUIRED_VARIABLES.find((base) => base.role === role)?.source_role;

describe("universitySourceGroupForRole", () => {
  it("catalogo_curso_horario es lado aula; base_madre/estudiantes es lado estudiante", () => {
    expect(universitySourceGroupForRole("catalogo_curso_horario")).toBe("classroom");
    expect(universitySourceGroupForRole("base_madre")).toBe("student");
    expect(universitySourceGroupForRole(undefined)).toBe("student");
  });

  it("los roles canónicos del motor caen en la hoja correcta", () => {
    expect(universitySourceGroupForRole(sourceRoleFor("teacher_type"))).toBe("classroom");
    expect(universitySourceGroupForRole(sourceRoleFor("teacher"))).toBe("classroom");
    expect(universitySourceGroupForRole(sourceRoleFor("faculty"))).toBe("student");
    expect(universitySourceGroupForRole(sourceRoleFor("age"))).toBe("student");
  });
});

describe("universityColumnOptionsBySource (dos hojas)", () => {
  it("separa columnas por hoja sin mezclar", () => {
    const bySource = universityColumnOptionsBySource(dosBasesWorkspace(), null);
    expect(bySource.classroom).toContain("Tipo de docente");
    expect(bySource.classroom).toContain("Docente");
    expect(bySource.classroom).not.toContain("Código PUCP");
    expect(bySource.classroom).not.toContain("Edad");
    expect(bySource.student).toContain("Facultad");
    expect(bySource.student).toContain("Edad");
    expect(bySource.student).not.toContain("Tipo de docente");
    expect(bySource.student).not.toContain("Docente");
    // La homónima aparece en ambas.
    expect(bySource.student).toContain("Condición");
    expect(bySource.classroom).toContain("Condición");
  });
});

describe("universityRoleColumnOptions — scoping por rol", () => {
  const bySource = universityColumnOptionsBySource(dosBasesWorkspace(), null);

  it("un rol de aula (teacher_type) ofrece SOLO columnas de CURSO Y HORARIO", () => {
    const cols = universityRoleColumnOptions(bySource, sourceRoleFor("teacher_type"));
    expect(cols).toContain("Tipo de docente");
    expect(cols).toContain("Docente");
    expect(cols).not.toContain("Código PUCP");
    expect(cols).not.toContain("Edad");
    expect(cols).not.toContain("Formación");
  });

  it("un rol de estudiante (faculty) ofrece SOLO columnas de MATRICULADO", () => {
    const cols = universityRoleColumnOptions(bySource, sourceRoleFor("faculty"));
    expect(cols).toContain("Facultad");
    expect(cols).toContain("Sexo");
    expect(cols).not.toContain("Docente");
    expect(cols).not.toContain("Tipo de docente");
    expect(cols).not.toContain("Sesiones y aula");
  });

  it("incluye siempre la columna confirmada aunque no esté en la hoja", () => {
    const cols = universityRoleColumnOptions(bySource, sourceRoleFor("teacher_type"), "Categoría docente legacy");
    expect(cols).toContain("Categoría docente legacy");
    // sigue sin filtrarse la otra hoja
    expect(cols).not.toContain("Código PUCP");
  });

  it("sin bindings devuelve listas vacías (cae al empty state, nunca al fallback plano)", () => {
    const empty = universityColumnOptionsBySource({ variable_mappings: [] } as unknown as CalcMuestraWorkspace, null);
    expect(empty.student).toEqual([]);
    expect(empty.classroom).toEqual([]);
    expect(universityRoleColumnOptions(empty, sourceRoleFor("teacher_type"))).toEqual([]);
  });
});
