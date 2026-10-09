import { describe, expect, it } from "vitest";
import { aulasHayPlan, aulasPlanImported } from "./AulasOperationsPanel";
import type { MonitoreoAulasConfig } from "../../../../api/monitoreo";

/**
 * Dos preguntas que parecen la misma y no lo son, y de las que depende qué
 * botones se ofrecen.
 *
 * `aulasPlanImported` exige `selection_run_id`, o sea un plan venido del cálculo
 * de muestra. `aulasHayPlan` no: **un plan que llegó por el propio libro Excel no
 * tiene sorteo**, y exigírselo dejaba el ciclo cerrado sobre sí mismo —importas
 * 196 cursos-horario y no puedes regenerar el libro—. Los dos comentarios lo
 * cuentan y ninguno tenía prueba: salió del barrido de exportados sin cubrir.
 *
 * El otro filo es `plan_rows` frente a `plan.length`. El plan dejó de viajar en
 * la config —333 KB de 934 para contestar «cuántas unidades hay»— y ahora manda
 * el conteo del backend, con el array de respaldo. Que convivan dos fuentes del
 * mismo número es justo el patrón que en este repo ya costó un defecto.
 */
const cfg = (c: Record<string, unknown>) => c as unknown as MonitoreoAulasConfig;

describe("«hay plan» y «el plan vino del sorteo» son preguntas distintas", () => {
  it("un plan traído por el libro Excel no está «importado» pero SÍ es plan", () => {
    // Sin `selection_run_id`: es el caso que cerraba el ciclo sobre sí mismo.
    const c = cfg({ enabled: true, plan_rows: 196 });
    expect(aulasPlanImported(c)).toBe(false);
    expect(aulasHayPlan(c)).toBe(true);
  });

  it("con sorteo, las dos dicen que sí", () => {
    const c = cfg({ enabled: true, plan_rows: 174, selection_run_id: "sel_aula_c12730" });
    expect(aulasPlanImported(c)).toBe(true);
    expect(aulasHayPlan(c)).toBe(true);
  });

  it("deshabilitado no hay plan, aunque vengan filas y sorteo", () => {
    const c = cfg({ enabled: false, plan_rows: 174, selection_run_id: "sel_aula_c12730" });
    expect(aulasPlanImported(c)).toBe(false);
    expect(aulasHayPlan(c)).toBe(false);
  });

  it("sin `plan_rows` cuenta el array de respaldo", () => {
    // Lo devuelven `import-from-calc-muestra` y `config`, que sí traen el plan.
    expect(aulasHayPlan(cfg({ enabled: true, plan: [{}, {}, {}] }))).toBe(true);
  });

  it("un `plan_rows` en CERO manda sobre un array viejo, y eso es lo correcto", () => {
    // `??` sólo cae al respaldo si el conteo es null/undefined: un 0 explícito
    // del backend es una respuesta, no una ausencia. Si ganara el array, la app
    // ofrecería generar un libro sobre un plan que ya no está.
    expect(aulasHayPlan(cfg({ enabled: true, plan_rows: 0, plan: [{}, {}] }))).toBe(false);
  });

  it("sin config no revientan: contestan que no", () => {
    for (const vacio of [null, undefined]) {
      expect(aulasPlanImported(vacio)).toBe(false);
      expect(aulasHayPlan(vacio)).toBe(false);
    }
  });
});
