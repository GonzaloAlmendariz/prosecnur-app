import { describe, expect, it } from "vitest";
import type { CalcMuestraWorkspaceVariableMapping } from "../../../../../api/client";
import {
  isUniversityRoleConfirmed,
  universityConfirmedColumn,
  universityNumericColumnSummary,
  universityRoleValueType,
  upsertUniversityVariableMapping,
} from "../variableRoles";

const base = (role: string, extra: Partial<CalcMuestraWorkspaceVariableMapping> = {}): CalcMuestraWorkspaceVariableMapping => ({
  role,
  label: role,
  required: true,
  ...extra,
});

describe("universityRoleValueType", () => {
  it("clasifica cantidades como numéricas", () => {
    expect(universityRoleValueType("age")).toBe("numerica");
    expect(universityRoleValueType("enrolled_total")).toBe("numerica");
  });

  it("clasifica códigos y nombres libres como identificadores", () => {
    expect(universityRoleValueType("student_id")).toBe("identificador");
    expect(universityRoleValueType("course_schedule_id")).toBe("identificador");
    expect(universityRoleValueType("course_name")).toBe("identificador");
  });

  it("todo lo demás es categórico", () => {
    expect(universityRoleValueType("faculty")).toBe("categorica");
    expect(universityRoleValueType("sex")).toBe("categorica");
    expect(universityRoleValueType("condition")).toBe("categorica");
  });
});

describe("confirmación durable vía presencia de columna", () => {
  const mappings: CalcMuestraWorkspaceVariableMapping[] = [
    base("faculty", { column: "Facultad" }),
    base("sex", { column: "" }),
  ];

  it("una columna persistida no vacía cuenta como confirmada", () => {
    expect(universityConfirmedColumn(mappings, "faculty")).toBe("Facultad");
    expect(isUniversityRoleConfirmed(mappings, "faculty")).toBe(true);
  });

  it("una entrada con columna vacía NO está confirmada", () => {
    expect(universityConfirmedColumn(mappings, "sex")).toBe("");
    expect(isUniversityRoleConfirmed(mappings, "sex")).toBe(false);
  });

  it("un rol ausente no está confirmado", () => {
    expect(isUniversityRoleConfirmed(mappings, "program")).toBe(false);
    expect(isUniversityRoleConfirmed(undefined, "faculty")).toBe(false);
  });
});

describe("upsertUniversityVariableMapping", () => {
  it("inserta una asignación confirmada sin tocar otros roles", () => {
    const current = [base("faculty", { column: "Facultad" })];
    const next = upsertUniversityVariableMapping(current, base("sex"), "Sexo");
    expect(next).toHaveLength(2);
    expect(next.find((row) => row.role === "faculty")?.column).toBe("Facultad");
    expect(next.find((row) => row.role === "sex")?.column).toBe("Sexo");
  });

  it("reemplaza la columna de un rol ya presente", () => {
    const current = [base("faculty", { column: "Facultad" })];
    const next = upsertUniversityVariableMapping(current, base("faculty"), "NombreFacultad");
    expect(next).toHaveLength(1);
    expect(next[0].column).toBe("NombreFacultad");
  });

  it("recorta espacios de la columna confirmada", () => {
    const next = upsertUniversityVariableMapping([], base("sex"), "  Sexo  ");
    expect(next[0].column).toBe("Sexo");
  });

  it("columna vacía elimina la entrada (rol vuelve a sin confirmar)", () => {
    const current = [base("faculty", { column: "Facultad" }), base("sex", { column: "Sexo" })];
    const next = upsertUniversityVariableMapping(current, base("sex"), "");
    expect(next).toHaveLength(1);
    expect(next.some((row) => row.role === "sex")).toBe(false);
  });
});

describe("universityNumericColumnSummary", () => {
  const rows = [
    { Edad: "18" },
    { Edad: 21 },
    { Edad: "" },
    { Edad: null },
    { Edad: "NA" },
    { Edad: 30 },
  ];

  it("resume conteo/min/máx/media ignorando NA/null/vacío", () => {
    const summary = universityNumericColumnSummary(rows, "edad");
    expect(summary).not.toBeNull();
    expect(summary?.count).toBe(3);
    expect(summary?.min).toBe(18);
    expect(summary?.max).toBe(30);
    expect(summary?.mean).toBeCloseTo(23, 5);
  });

  it("empareja por nombre normalizado (acentos/mayúsculas)", () => {
    const summary = universityNumericColumnSummary([{ "Edad del Alumno": 40 }], "edad del alumno");
    expect(summary?.count).toBe(1);
    expect(summary?.min).toBe(40);
  });

  it("devuelve null si la columna no existe o no hay valores finitos", () => {
    expect(universityNumericColumnSummary(rows, "no_existe")).toBeNull();
    expect(universityNumericColumnSummary([{ Edad: "NA" }, { Edad: "" }], "edad")).toBeNull();
    expect(universityNumericColumnSummary([], "edad")).toBeNull();
    expect(universityNumericColumnSummary(rows, "")).toBeNull();
  });
});
