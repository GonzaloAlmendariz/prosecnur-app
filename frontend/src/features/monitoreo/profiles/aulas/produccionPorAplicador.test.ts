import { describe, expect, it } from "vitest";

import { produccionPorAplicador } from "./produccionPorAplicador";

const parte = (applied_by: string, effective_surveys: number, extra: Record<string, unknown> = {}) =>
  ({ applied_by, effective_surveys, ...extra });

describe("produccionPorAplicador", () => {
  it("no declara distinguible una diferencia que cabe en el ruido", () => {
    // Aquí se juzga el trabajo de personas. Dos equipos de tres aulas con
    // medias 10 y 14: la diferencia existe, pero con esa dispersión y ese
    // número de aulas no se puede atribuir a cómo trabajan.
    const r = produccionPorAplicador([
      parte("A", 6), parte("A", 10), parte("A", 14),
      parte("B", 10), parte("B", 14), parte("B", 18),
    ])!;
    expect(r.equipos.map((e) => e.aplicador)).toEqual(["B", "A"]);
    expect(r.distinguibles).toBe(0);
    expect(r.equipos.every((e) => !e.seDistingue)).toBe(true);
  });

  it("cuando la diferencia SÍ es grande, lo dice", () => {
    // El control del caso anterior: si nunca marcara distinguible, el aserto de
    // arriba pasaría por vacío. Un equipo muy por debajo con dispersión baja sí
    // se separa.
    const r = produccionPorAplicador([
      parte("A", 20), parte("A", 20), parte("A", 21), parte("A", 20),
      parte("B", 20), parte("B", 21), parte("B", 20), parte("B", 20),
      parte("C", 2), parte("C", 3), parte("C", 2), parte("C", 3),
    ])!;
    expect(r.equipos.find((e) => e.aplicador === "C")!.seDistingue).toBe(true);
    expect(r.distinguibles).toBeGreaterThan(0);
  });

  it("rechazos y duplicados van por cada cien encuestas, no en bruto", () => {
    // En bruto, quien hace más aulas parece el más problemático: A consigue el
    // doble que B y tiene el doble de rechazos, pero trabaja igual.
    const r = produccionPorAplicador([
      parte("A", 20, { refusals: 2 }), parte("A", 20, { refusals: 2 }),
      parte("B", 20, { refusals: 2 }),
    ])!;
    const a = r.equipos.find((e) => e.aplicador === "A")!;
    const b = r.equipos.find((e) => e.aplicador === "B")!;
    expect(a.rechazosPorCien).toBeCloseTo(10, 5);
    expect(b.rechazosPorCien).toBeCloseTo(10, 5);
  });

  it("un parte sin aplicador o sin efectivas no entra", () => {
    const r = produccionPorAplicador([
      parte("A", 10), parte("", 10), { applied_by: "B" },
    ])!;
    expect(r.equipos).toHaveLength(1);
    expect(r.aulas).toBe(1);
  });

  it("sin partes con dato no hay nada que publicar", () => {
    expect(produccionPorAplicador([])).toBeNull();
    expect(produccionPorAplicador([{ applied_by: "A" }])).toBeNull();
  });
});
