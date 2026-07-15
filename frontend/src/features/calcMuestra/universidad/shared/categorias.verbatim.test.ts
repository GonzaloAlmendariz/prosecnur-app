import { describe, expect, it } from "vitest";
import {
  suggestUniversityCategoryLabel,
  universitySourceGroupForRole,
} from "./categorias";
import { UNIVERSITY_REQUIRED_VARIABLES } from "./constants";

// ADR 0035 fase 3, prioridad 1: las categorías se muestran con su NOMBRE CRUDO.
describe("suggestUniversityCategoryLabel — valores verbatim", () => {
  it("no reetiqueta la condición: REGULAR se muestra REGULAR (no 'Elegible')", () => {
    expect(suggestUniversityCategoryLabel("condition", "REGULAR")).toBe("REGULAR");
    expect(suggestUniversityCategoryLabel("condition", "REGULAR")).not.toBe("Elegible");
    expect(suggestUniversityCategoryLabel("condition", "RETIRADO")).toBe("RETIRADO");
    expect(suggestUniversityCategoryLabel("condition", "RETIRADO")).not.toBe("No elegible");
  });

  it("no traduce el sexo crudo a Hombre/Mujer", () => {
    expect(suggestUniversityCategoryLabel("sex", "1")).toBe("1");
    expect(suggestUniversityCategoryLabel("sex", "2")).toBe("2");
    expect(suggestUniversityCategoryLabel("sex", "M")).toBe("M");
  });

  it("no reetiqueta la modalidad", () => {
    expect(suggestUniversityCategoryLabel("modality", "presencial")).toBe("presencial");
    expect(suggestUniversityCategoryLabel("modality", "VIRTUAL")).toBe("VIRTUAL");
  });

  it("solo aplica trim de espacios; conserva mayúsculas y acentos", () => {
    expect(suggestUniversityCategoryLabel("faculty", "  CIENCIAS SOCIALES  ")).toBe("CIENCIAS SOCIALES");
    expect(suggestUniversityCategoryLabel("faculty", "EDUCACIÓN")).toBe("EDUCACIÓN");
  });

  it("valor vacío cae a 'Sin dato' (nicety de display, no un valor real)", () => {
    expect(suggestUniversityCategoryLabel("sex", "")).toBe("Sin dato");
    expect(suggestUniversityCategoryLabel("sex", "   ")).toBe("Sin dato");
  });
});

// ADR 0035 fase 3, prioridad 3: condicion_curso mapeable en la hoja del catálogo.
describe("rol condicion_curso", () => {
  const condicionCurso = UNIVERSITY_REQUIRED_VARIABLES.find((base) => base.role === "condicion_curso");

  it("existe como variable mapeable, opcional, en la hoja del catálogo", () => {
    expect(condicionCurso).toBeDefined();
    expect(condicionCurso?.required).toBe(false);
    expect(condicionCurso?.source_role).toBe("catalogo_curso_horario");
  });

  it("es distinta de la condición del estudiante (condition sigue en base_madre)", () => {
    const condition = UNIVERSITY_REQUIRED_VARIABLES.find((base) => base.role === "condition");
    expect(condition?.source_role).toBe("base_madre");
    expect(condicionCurso?.role).not.toBe(condition?.role);
  });
});

// ADR 0035 fase 3, prioridad 2: las tarjetas de rol se agrupan por hoja.
describe("agrupación de tarjetas por hoja (DefVariablesTab)", () => {
  const grupoDe = (role: string) => {
    const base = UNIVERSITY_REQUIRED_VARIABLES.find((item) => item.role === role);
    return universitySourceGroupForRole(base?.source_role);
  };

  it("los roles base_madre caen en el grupo del estudiante", () => {
    for (const role of ["student_id", "faculty", "sex", "level", "age", "course_id", "condition"]) {
      expect(grupoDe(role)).toBe("student");
    }
  });

  it("los roles del catálogo caen en el grupo del curso-horario, incluido condicion_curso", () => {
    for (const role of ["course_name", "course_level", "teacher", "teacher_type", "schedule", "modality", "session_type", "enrolled_total", "condicion_curso"]) {
      expect(grupoDe(role)).toBe("classroom");
    }
  });

  it("cada variable requerida cae en exactamente uno de los dos grupos (cero overlap)", () => {
    for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
      const grupo = universitySourceGroupForRole(base.source_role);
      expect(grupo === "student" || grupo === "classroom").toBe(true);
    }
  });
});
