import { describe, expect, it } from "vitest";
import {
  ensureUniversityVariableMappings,
  inferUniversityColumn,
  reconcileUniversityVariableMappingsForColumns,
} from "../categorias";

// Homónimo real del estudio HST: "Condición" existe en la hoja de MATRÍCULA
// (condición de matrícula) y "Tipo de docente" en la de CURSO-HORARIO. El bug:
// inferUniversityColumn secuestraba "Condición" hacia teacher_type porque el
// sinónimo "condiciondocente" CONTIENE "condicion" (substring inverso). Y el
// reconcile auto-inyectaba esa inferencia, pisando el mapeo manual del usuario.
const STUDENT_COLS = ["Código PUCP", "Facultad", "Sexo", "Edad", "Formación", "Condición"];
const CLASSROOM_COLS = ["Tipo de docente", "Docente", "Sesiones y aula", "Horario", "Condición"];

function columnFor(mappings: Array<{ role: string; column: string }>, role: string) {
  return mappings.find((m) => m.role === role)?.column ?? undefined;
}

describe("inferUniversityColumn — teacher_type ya no secuestra 'Condición'", () => {
  it("con columnas de matrícula (sin 'Tipo de docente') NO infiere 'Condición'", () => {
    expect(inferUniversityColumn("teacher_type", STUDENT_COLS)).toBe("");
  });

  it("con la columna real presente sí la mapea por match exacto", () => {
    expect(inferUniversityColumn("teacher_type", CLASSROOM_COLS)).toBe("Tipo de docente");
  });

  it("condition sí mapea 'Condición' (su rol legítimo)", () => {
    expect(inferUniversityColumn("condition", STUDENT_COLS)).toBe("Condición");
  });
});

describe("ensureUniversityVariableMappings — no auto-inyecta (mapeo manual 1-a-1)", () => {
  it("un rol sin mapear queda VACÍO aunque exista una columna candidata", () => {
    const out = ensureUniversityVariableMappings([], [...STUDENT_COLS, ...CLASSROOM_COLS]);
    // Ningún rol trae columna: nada se asumió por inferencia.
    expect(out.every((row) => row.column === "")).toBe(true);
  });

  it("conserva EXACTAMENTE la columna que el usuario eligió", () => {
    const current = [{ role: "teacher_type", column: "Tipo de docente" }] as never;
    const out = ensureUniversityVariableMappings(current, CLASSROOM_COLS);
    expect(columnFor(out, "teacher_type")).toBe("Tipo de docente");
  });
});

describe("reconcileUniversityVariableMappingsForColumns — solo poda, nunca auto-mapea", () => {
  it("preserva el mapeo manual y no inyecta inferencias en roles vacíos", () => {
    const current = [{ role: "teacher_type", column: "Tipo de docente" }] as never;
    const out = reconcileUniversityVariableMappingsForColumns(current, [...STUDENT_COLS, ...CLASSROOM_COLS]);
    expect(columnFor(out, "teacher_type")).toBe("Tipo de docente");
    // teacher_type NO se reasignó a "Condición"; y roles no elegidos siguen vacíos.
    expect(columnFor(out, "condition")).toBe("");
    expect(columnFor(out, "faculty")).toBe("");
  });

  it("limpia una columna elegida que ya no existe en la nueva base", () => {
    const current = [{ role: "faculty", column: "Unidad académica (base vieja)" }] as never;
    const out = reconcileUniversityVariableMappingsForColumns(current, STUDENT_COLS);
    expect(columnFor(out, "faculty")).toBe("");
  });

  it("sin columnas detectadas conserva lo que haya (base aún sin leer)", () => {
    const current = [{ role: "faculty", column: "Facultad" }] as never;
    const out = reconcileUniversityVariableMappingsForColumns(current, []);
    expect(columnFor(out, "faculty")).toBe("Facultad");
  });
});
