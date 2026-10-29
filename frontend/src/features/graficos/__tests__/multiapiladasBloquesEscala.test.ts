import { describe, expect, test } from "vitest";
import { validateArgs } from "../MultiApiladasBuilder";

// D4 (unión de láminas, 2026-10-29): en «Bloques» cada bloque tiene su escala; comparar las preguntas de todos los bloques
// entre sí daba «no comparten una escala compatible… usa Combinar bloques» justo en el modo que existe para mezclarlas.
const v = (name: string, labels: string[]) =>
  ({ name, label: name, list_name: `l_${labels.length}`, choices: labels.map((label, i) => ({ name: String(i + 1), label })) }) as never;
const VARS = [v("p20_1", ["En desacuerdo", "De acuerdo", "Totalmente de acuerdo"]), v("p20_2", ["En desacuerdo", "De acuerdo", "Totalmente de acuerdo"]), v("p19", ["Sí", "No"])];

describe("escala en «Bloques»", () => {
  test("un bloque de acuerdo y otro de Sí/No no dan error de escala", () => {
    const args = { modo: "multilista", bloques: [{ modo: "var", vars: ["p20_1", "p20_2"] }, { modo: "var", vars: ["p19"] }] };
    const msgs = validateArgs(args, VARS, false).map((i) => i.message);
    expect(msgs.some((m) => m.includes("no comparten una escala"))).toBe(false);
  });
  test("fuera de «Bloques» la mezcla sí se avisa, y el aviso nombra la pestaña como se llama", () => {
    const msgs = validateArgs({ modo: "var", vars: ["p20_1", "p19"] }, VARS, false).map((i) => i.message);
    const m = msgs.find((x) => x.includes("no comparten una escala"));
    expect(m).toBeDefined();
    expect(m).toContain("pestaña Bloques");
  });
});
