import { describe, expect, test } from "vitest";
import { destinoDeAtajo, modulosDelDock } from "./atajosDeModulos";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";

describe("⌘1…8 abre el módulo N del dock (L30)", () => {
  const todos = PROSECNUR_PRIMARY_ACTIVE_MODULES.map((m) => m.slug);

  test("el orden es el del dock: los agregados, en el orden del manifiesto", () => {
    expect(todos.length).toBeGreaterThan(3);
    const agregados = [todos[2], todos[0]];
    expect(modulosDelDock(agregados).map((m) => m.slug)).toEqual([todos[0], todos[2]]);
    expect(destinoDeAtajo("1", agregados)?.slug).toBe(todos[0]);
    expect(destinoDeAtajo("2", agregados)?.slug).toBe(todos[2]);
  });

  test("sin módulo en esa posición, o con otra tecla, no hay destino", () => {
    expect(destinoDeAtajo("3", [todos[0]])).toBeNull();
    expect(destinoDeAtajo("9", todos)).toBeNull();
    expect(destinoDeAtajo("k", todos)).toBeNull();
  });
});
