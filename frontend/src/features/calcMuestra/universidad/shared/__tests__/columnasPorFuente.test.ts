/**
 * §ADR 0035 (Fase 1): el catálogo de columnas de cada rol es EXCLUSIVO por hoja.
 * Los roles de alumno leen la base madre / MATRICULADO; los de curso-horario, el
 * catálogo / CURSO Y HORARIO. Una columna homónima ("Condición") queda
 * desambiguada por hoja: aparece en ambas fuentes, pero cada rol solo ve la de
 * la suya. Nunca se filtran columnas de la otra hoja.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import {
  universityColumnOptionsBySource,
  universitySourceGroupForRole,
} from "../categorias";

const STUDENT_COLS = ["Código estudiante", "Facultad", "Sexo", "Condición"];
const CLASSROOM_COLS = ["NRC", "Docente", "Tipo de docente", "Condición"];

const dosBases = {
  source_bindings: [
    {
      id: "src-estudiantes",
      role: "estudiantes",
      label: "Base principal",
      sheet_name: "MATRICULADO",
      sheet_diagnostics: [
        { name: "MATRICULADO", role: "estudiantes", columns_sample: STUDENT_COLS },
      ],
    },
    {
      id: "src-cursos",
      role: "catalogo_curso_horario",
      label: "Catálogo",
      sheet_name: "CURSO Y HORARIO",
      sheet_diagnostics: [
        { name: "CURSO Y HORARIO", role: "catalogo_curso_horario", columns_sample: CLASSROOM_COLS },
      ],
    },
  ],
} as unknown as CalcMuestraWorkspace;

describe("universityColumnOptionsBySource — exclusividad por hoja", () => {
  it("un rol de alumno ve solo columnas de la base madre / MATRICULADO", () => {
    const { student } = universityColumnOptionsBySource(dosBases, null);
    expect(student).toContain("Código estudiante");
    expect(student).toContain("Facultad");
    // No debe filtrarse ninguna columna que solo exista en la hoja de curso-horario.
    expect(student).not.toContain("Tipo de docente");
    expect(student).not.toContain("Docente");
    expect(student).not.toContain("NRC");
  });

  it("un rol de curso-horario ve solo columnas del catálogo / CURSO Y HORARIO", () => {
    const { classroom } = universityColumnOptionsBySource(dosBases, null);
    expect(classroom).toContain("Tipo de docente");
    expect(classroom).toContain("NRC");
    // No debe filtrarse ninguna columna que solo exista en la hoja de alumno.
    expect(classroom).not.toContain("Código estudiante");
    expect(classroom).not.toContain("Facultad");
    expect(classroom).not.toContain("Sexo");
  });

  it("una columna homónima aparece en ambas fuentes (desambiguada por hoja)", () => {
    const { student, classroom } = universityColumnOptionsBySource(dosBases, null);
    expect(student).toContain("Condición");
    expect(classroom).toContain("Condición");
  });

  it("mapea el source_role de cada rol a su grupo/hoja", () => {
    expect(universitySourceGroupForRole("base_madre")).toBe("student");
    expect(universitySourceGroupForRole(undefined)).toBe("student");
    expect(universitySourceGroupForRole("catalogo_curso_horario")).toBe("classroom");
  });
});

describe("universityColumnOptionsBySource — una sola base", () => {
  // En modo base_madre todo vive en una hoja: ambas fuentes la comparten y no
  // hay dos hojas que separar.
  const baseUnica = {
    source_bindings: [
      {
        id: "src-base-madre",
        role: "base_madre",
        label: "Base principal",
        sheet_name: "BD",
        sheet_diagnostics: [
          { name: "BD", role: "base_madre", columns_sample: [...STUDENT_COLS, ...CLASSROOM_COLS] },
        ],
      },
    ],
  } as unknown as CalcMuestraWorkspace;

  it("alumno y curso-horario comparten las columnas de la única hoja", () => {
    const { student, classroom } = universityColumnOptionsBySource(baseUnica, null);
    for (const col of [...STUDENT_COLS, ...CLASSROOM_COLS]) {
      expect(student).toContain(col);
      expect(classroom).toContain(col);
    }
  });
});

describe("universityColumnOptionsBySource — estudiantes con rol detectado base_madre", () => {
  // dos_bases pero una sola hoja: el binding "estudiantes" tiene rol DETECTADO
  // base_madre (sirve a alumno Y curso-horario, sin catálogo aparte). Sus
  // columnas deben alimentar TAMBIÉN el grupo classroom, o los roles de aula
  // quedan sin opciones (§ADR 0035, Fix 3).
  const baseUnicaComoEstudiantes = {
    source_bindings: [
      {
        id: "src-estudiantes",
        role: "estudiantes",
        label: "Base principal",
        sheet_name: "BD",
        sheet_diagnostics: [
          { name: "BD", role: "base_madre", columns_sample: [...STUDENT_COLS, ...CLASSROOM_COLS] },
        ],
      },
    ],
  } as unknown as CalcMuestraWorkspace;

  it("las columnas de la hoja única alimentan alumno Y curso-horario", () => {
    const { student, classroom } = universityColumnOptionsBySource(baseUnicaComoEstudiantes, null);
    for (const col of [...STUDENT_COLS, ...CLASSROOM_COLS]) {
      expect(student).toContain(col);
      expect(classroom).toContain(col);
    }
  });

  it("no rompe el caso dos-hojas real: cada hoja sigue alimentando su grupo", () => {
    // dosBases: estudiantes=MATRICULADO (rol detectado "estudiantes") + catálogo
    // separado. Aquí classroom NO debe recibir columnas solo de la hoja de alumno.
    const { classroom } = universityColumnOptionsBySource(dosBases, null);
    expect(classroom).not.toContain("Código estudiante");
    expect(classroom).not.toContain("Facultad");
    expect(classroom).toContain("NRC");
  });
});

describe("universityColumnOptionsBySource — sin inspección, fallback al frame", () => {
  // Sin columnas inspeccionadas de la hoja, la fuente cae al frame PROCESADO.
  // Ahí NO deben aparecer columnas derivadas del motor (§ADR 0035): solo crudas.
  const sinInspeccion = { source_bindings: [] } as unknown as CalcMuestraWorkspace;
  const aulasState = {
    frame: {
      aula_frame: [
        {
          // Crudas reales de la hoja CURSO Y HORARIO:
          "Tipo de docente": "Ordinario",
          "Nivel del curso": "5",
          Docente: "N. Pérez",
          Modalidad: "Presencial",
          // Derivadas del motor (no vienen de la base):
          course_level_num: 5,
          exclude_reason: "",
          label: "MAT-101 · Lun 8-10",
          section: "A",
          prevalence_ratio: 0.9,
          cycle_homogeneity: 0.8,
          teacher_type: "contratado",
          sex_top_1: "Mujer",
          sex_top_1_n: 20,
          eligible_n: 25,
          included: true,
          stratum: "s1",
        },
      ],
      population: [],
    },
  } as unknown as CalcMuestraAulasState;

  it("el rol de aula recibe las columnas crudas, no las derivadas del motor", () => {
    const { classroom } = universityColumnOptionsBySource(sinInspeccion, aulasState);
    expect(classroom).toContain("Tipo de docente");
    expect(classroom).toContain("Nivel del curso");
    expect(classroom).toContain("Docente");
    expect(classroom).toContain("Modalidad");
    for (const derivada of [
      "course_level_num",
      "exclude_reason",
      "label",
      "section",
      "prevalence_ratio",
      "cycle_homogeneity",
      "teacher_type",
      "sex_top_1",
      "sex_top_1_n",
      "eligible_n",
      "included",
      "stratum",
    ]) {
      expect(classroom).not.toContain(derivada);
    }
  });
});
