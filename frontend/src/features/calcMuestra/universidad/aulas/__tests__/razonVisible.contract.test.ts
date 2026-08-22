/**
 * Una corrida guardada no trae jerga a la pantalla.
 *
 * El `.pulso` conserva el texto con el que se generó la corrida —correcto para
 * un artefacto auditable—, pero eso hacía que un proyecto guardado mostrara la
 * explicación vieja junto a la tarjeta ya glosada. Medido en HSVG2026: el panel
 * decía «reduce mejor el SOLAPE» a 300 px de la tarjeta que dice «se queda con
 * la selección donde menos estudiantes se repiten».
 */
import { describe, expect, it } from "vitest";
import { classroomMethodReason, classroomMethodReasonVisible } from "../classroomLabels";

describe("qué razón se muestra", () => {
  it("una razón del motor con jerga se sustituye por la canónica", () => {
    const guardada = "Compara muestras candidatas y elige la que reduce mejor el solape, registrando probabilidades por simulación.";
    const visible = classroomMethodReasonVisible("pool_controlado", guardada);
    expect(visible).not.toContain("solape");
    expect(visible).toBe(classroomMethodReason("pool_controlado"));
  });

  it("una razón específica de la corrida SÍ se respeta si está limpia", () => {
    // El motor conoce cosas de su corrida que el front no: no se descarta sin
    // motivo, sólo cuando trae términos que la UI no admite en ningún sitio.
    const especifica = "Se usó este método porque el marco no traía la lista de alumnos por curso-horario.";
    expect(classroomMethodReasonVisible("cube_balanceado", especifica)).toBe(especifica);
  });

  it("sin razón del motor cae a la canónica", () => {
    for (const vacio of [undefined, null, "", "   "]) {
      expect(classroomMethodReasonVisible("sistematico_pps", vacio)).toBe(classroomMethodReason("sistematico_pps"));
    }
  });

  it("cubre los términos que la UI ya prohíbe en su propio copy", () => {
    for (const jerga of ["dentro de cada estrato", "auditoría post hoc", "el cube balancea", "PPS clásico", "local pivotal"]) {
      const visible = classroomMethodReasonVisible("cube_balanceado", `Texto del motor con ${jerga}.`);
      expect(visible, `dejó pasar «${jerga}»`).toBe(classroomMethodReason("cube_balanceado"));
    }
  });

  it("la canónica de cada método sigue estando en español llano", () => {
    for (const id of ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"]) {
      const r = classroomMethodReason(id);
      expect(r.length).toBeGreaterThan(30);
      expect(r).not.toMatch(/\bsolape\b|\bestratos?\b|post[ -]hoc|\bcube\b|\bpivotal\b/i);
    }
  });
});
