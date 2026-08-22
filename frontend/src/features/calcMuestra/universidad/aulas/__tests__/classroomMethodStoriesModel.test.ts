import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasMethodComparison } from "../../../../../api/client";
import {
  CLASSROOM_METHOD_STORIES,
  resolveClassroomMethodDecision,
} from "../classroomMethodStoriesModel";

const comparison = {
  recommendation: {
    method_id: "cube_balanceado",
    method_label: "Balanceado (cube)",
    operational_reason: "Mejor balance con el marco actual.",
  },
} as CalcMuestraAulasMethodComparison;

describe("selección legible de método", () => {
  it("solo llama recomendado al resultado de una comparación vigente", () => {
    expect(resolveClassroomMethodDecision({
      comparisonReady: true,
      comparison,
      configuredMethodId: "sistematico_pps",
      configuredMethodLabel: "Sistemático PPS",
    })).toMatchObject({ kind: "recommended", methodId: "cube_balanceado" });

    const stale = resolveClassroomMethodDecision({
      comparisonReady: false,
      comparison,
      configuredMethodId: "sistematico_pps",
      configuredMethodLabel: "Sistemático PPS",
    });
    expect(stale).toMatchObject({ kind: "configured", methodId: "sistematico_pps" });
    expect(stale.reason).toContain("configuración guardada");
  });

  it("conserva las cuatro historias visuales mandatadas", () => {
    expect(CLASSROOM_METHOD_STORIES.map((story) => story.id)).toEqual([
      "sistematico_pps",
      "cube_balanceado",
      "local_pivotal_balanceado",
      "pool_controlado",
    ]);
    // Lo que se exige es que la historia nombre SU mecanismo —el salto fijo—,
    // no una redacción concreta. Estaba clavado a «paso k», que es la sigla que
    // hacía ilegible la frase; la glosa que la reemplaza describe el mismo
    // mecanismo sin jerga, así que el aserto acepta las dos.
    expect(CLASSROOM_METHOD_STORIES.map((story) => story.story).join(" ")).toMatch(/paso k|uno de cada tantos/i);
    expect(CLASSROOM_METHOD_STORIES.map((story) => story.story).join(" ")).toMatch(/facultad.*sexo.*tamaño/i);
    expect(CLASSROOM_METHOD_STORIES.map((story) => story.story).join(" ")).toMatch(/vecinos parecidos/i);
    expect(CLASSROOM_METHOD_STORIES.map((story) => story.story).join(" ")).toMatch(/500 muestras candidatas/i);
  });
});
