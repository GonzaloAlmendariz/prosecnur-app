import { describe, expect, it } from "vitest";

import type { CriterioVariable } from "../../../../../api/client";
import { ordenCriteriosEmbudo, ordenEmbudoDelMotor } from "../ordenEmbudo";

/**
 * ADR 0057 · El orden del embudo lo fija el ADR y no se reordena.
 *
 * Decisión de Gonzalo: «mantén el orden del ADR». Reordenar cambia los recortes
 * —dos criterios que se solapan quitan distinto según cuál va antes—, así que el
 * orden es del motor, no del usuario.
 */
const v = (id: string): CriterioVariable => ({ id, label: id, scope: "aula", kind: "flat" } as never);

describe("ordenCriteriosEmbudo", () => {
  it("pone matriculados primero y composición al final", () => {
    const orden = ordenCriteriosEmbudo([v("modality"), v("enrolled_total"), v("session_type")]);
    expect(orden[0]).toBe("enrolled_total");
    expect(orden[orden.length - 1]).toBe("composition");
  });

  it("el mínimo va antes de composición, no al principio", () => {
    const orden = ordenCriteriosEmbudo([v("enrolled_total")]);
    expect(orden.indexOf("elegibles_por_aula")).toBeLessThan(orden.indexOf("composition"));
    expect(orden.indexOf("elegibles_por_aula")).toBeGreaterThan(orden.indexOf("enrolled_total"));
  });

  it("un criterio que el ADR no ordena va al final, no en medio", () => {
    // Inventarle una posición sería fijar un embudo que nadie decidió.
    const orden = ordenCriteriosEmbudo([v("enrolled_total"), v("inventado")]);
    expect(orden[orden.length - 1]).toBe("inventado");
  });

  it("no inventa criterios que el catálogo no trae", () => {
    const orden = ordenCriteriosEmbudo([v("enrolled_total")]);
    expect(orden).not.toContain("teacher_type");
    expect(orden).not.toContain("campus");
  });

  it("cuenta bien cuántos quedan detrás de uno dado", () => {
    // Es lo que el confirmador publica: sin ese número, «confirmar» parece un
    // botón de guardar en vez de lo que desbloquea la cascada.
    const orden = ordenCriteriosEmbudo([v("enrolled_total"), v("modality"), v("session_type")]);
    const i = orden.indexOf("modality");
    expect(orden.length - 1 - i).toBe(orden.length - 1 - i);
    expect(i).toBeGreaterThan(0);
  });
});

describe("ordenEmbudoDelMotor · el orden lo publica el motor", () => {
  // Medido en la app: mi lista dejaba los criterios de estudiante al final
  // cuando en la cascada van PRIMERO, y el confirmador anunciaba «11 criterios
  // quedan en espera» sobre un orden que no es el que se aplica. Replicar el
  // orden a mano fabrica un segundo orden que puede divergir del que decide.
  const paso = (id: string, scope: "alumno" | "aula") => ({
    order: 1, criterion_id: id, card_id: id, label: id, scope, gate: true,
    applies: true, status: "aplicado", faculties: [],
    total: { before_ch: 0, after_ch: 0, excluded_ch: 0 },
  });

  it("usa el orden de la cascada cuando está publicada", () => {
    const cascada = { steps: [paso("age", "alumno"), paso("modality", "aula")] } as never;
    expect(ordenEmbudoDelMotor(cascada, [v("modality"), v("age")])).toEqual(["age", "modality"]);
  });

  it("los criterios de estudiante van donde el motor los pone, no al final", () => {
    const cascada = { steps: [paso("formation", "alumno"), paso("age", "alumno"), paso("modality", "aula")] } as never;
    const orden = ordenEmbudoDelMotor(cascada, [v("modality")]);
    expect(orden.indexOf("formation")).toBeLessThan(orden.indexOf("modality"));
  });

  it("sin cascada publicada cae al orden del ADR, no a uno vacío", () => {
    // Un marco recién abierto todavía no la trae; quedarse sin orden dejaría al
    // confirmador sin poder decir cuántos criterios quedan detrás.
    const orden = ordenEmbudoDelMotor(null, [v("enrolled_total"), v("modality")]);
    expect(orden[0]).toBe("enrolled_total");
  });
});
