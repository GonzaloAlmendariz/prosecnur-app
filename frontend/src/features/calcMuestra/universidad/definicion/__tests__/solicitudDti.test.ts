import { describe, expect, it } from "vitest";
import { NOTAS_SOLICITUD_DTI, solicitudDtiPayload } from "../solicitudDti";

describe("solicitudDtiPayload — Excel de solicitud de base para DTI", () => {
  const payload = solicitudDtiPayload();

  it("emite una fila por ROL único (sin claves duplicadas — regresión condicion_curso)", () => {
    const roles = payload.variables.map((v) => v.rol);
    expect(new Set(roles).size).toBe(roles.length);
    expect(roles.filter((rol) => rol === "condicion_curso")).toHaveLength(1);
  });

  it("cada variable trae rol, label, hoja legible, requerida y descripción", () => {
    expect(payload.variables.length).toBeGreaterThan(10);
    for (const variable of payload.variables) {
      expect(variable.rol).toBeTruthy();
      expect(variable.label).toBeTruthy();
      expect(variable.hoja).toMatch(/Hoja de (matrícula|cursos y horarios)/);
      expect(typeof variable.requerida).toBe("boolean");
      expect(variable.descripcion).toBeTruthy();
    }
  });

  it("marca como requeridas las variables estructurales del marco", () => {
    const requeridas = payload.variables.filter((v) => v.requerida).map((v) => v.rol);
    for (const rol of ["student_id", "faculty", "sex", "course_id", "schedule", "condition"]) {
      expect(requeridas).toContain(rol);
    }
  });

  it("incluye los cuatro acuerdos de la reunión como notas fijas", () => {
    expect(payload.notas).toEqual(NOTAS_SOLICITUD_DTI);
    const texto = payload.notas.join(" | ");
    expect(texto).toMatch(/DESAGREGADO/);
    expect(texto).toMatch(/Condición del curso/);
    expect(texto).toMatch(/Nivel curricular Y nivel según créditos/);
    expect(texto).toMatch(/Código de estudiante/);
  });

  it("es puro: dos llamadas producen payloads equivalentes e independientes", () => {
    const otro = solicitudDtiPayload();
    expect(otro).toEqual(payload);
    expect(otro.variables).not.toBe(payload.variables);
    otro.notas.push("mutación local");
    expect(solicitudDtiPayload().notas).toEqual(NOTAS_SOLICITUD_DTI);
  });
});
