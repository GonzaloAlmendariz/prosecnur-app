/**
 * El sustento declara lo que le falta y de dónde sale cada capítulo.
 */
import { describe, expect, it } from "vitest";
import { resumenSustento, seccionesSustento } from "../sustentoSecciones";

const ctx = (over: Record<string, unknown> = {}) => ({
  estudio: { componentes: [] },
  workspace: null,
  aulasState: null,
  ...over,
}) as Parameters<typeof seccionesSustento>[0];

describe("seccionesSustento", () => {
  it("son once capítulos y conservan el orden del documento", () => {
    const s = seccionesSustento(ctx());
    expect(s).toHaveLength(11);
    expect(s.map((x) => x.numero)).toEqual([1,2,3,4,5,6,7,8,9,10,11]);
    expect(s[3].titulo).toContain("τ");
  });

  it("un proyecto vacío no puede escribir ninguno, y lo dice", () => {
    const r = resumenSustento(seccionesSustento(ctx()));
    expect(r.disponibles).toBe(0);
    // Todas las que faltan traen su motivo: un «no disponible» sin razón no
    // le sirve a nadie.
    expect(seccionesSustento(ctx()).every((x) => x.disponible || x.falta.length > 10)).toBe(true);
  });

  it("el capítulo de campo es EXTERNO y nunca se marca disponible", () => {
    // Vive en Monitoreo. Omitirlo en silencio o rellenarlo con generalidades
    // son los dos modos de mentir que este campo existe para evitar.
    const conTodo = seccionesSustento(ctx({
      estudio: { componentes: [{ resultado: { aulas_por_estrato: [{ estrato: "X", tau: 0.5 }] } }] },
      aulasState: {
        frame: {}, method_comparison: {}, replacement_simulation: {},
        selection: { selection_run_id: "r1", sexo_por_facultad: {} },
      },
    }));
    const campo = conTodo.find((x) => x.id === "campo-monitoreo");
    expect(campo?.origen).toBe("externo");
    expect(campo?.disponible).toBe(false);
    expect(campo?.falta).toContain("Monitoreo");
    // Y el resumen lo separa de las que sí se resuelven trabajando acá.
    const r = resumenSustento(conTodo);
    expect(r.externas).toHaveLength(1);
    expect(r.pendientes).toHaveLength(0);
    expect(r.disponibles).toBe(10);
  });

  it("cada capítulo declara su fuente literal", () => {
    // Para que quien lo mantenga no tenga que adivinar de dónde salía.
    expect(seccionesSustento(ctx()).every((x) => x.fuente.length > 15)).toBe(true);
    expect(seccionesSustento(ctx()).find((x) => x.id === "tau")?.fuente).toContain("rendimiento_mix");
  });

  it("τ exige tasas de verdad, no una fila cualquiera", () => {
    const sinTau = seccionesSustento(ctx({
      estudio: { componentes: [{ resultado: { aulas_por_estrato: [{ estrato: "X" }] } }] },
    }));
    expect(sinTau.find((x) => x.id === "tau")?.disponible).toBe(false);
    const conTau = seccionesSustento(ctx({
      estudio: { componentes: [{ resultado: { aulas_por_estrato: [{ estrato: "X", tau: 0.55 }] } }] },
    }));
    expect(conTau.find((x) => x.id === "tau")?.disponible).toBe(true);
  });
});
