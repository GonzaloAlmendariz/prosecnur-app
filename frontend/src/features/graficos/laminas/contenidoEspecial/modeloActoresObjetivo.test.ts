import { describe, expect, test } from "vitest";
import { actoresDeMeta, actoresQueSalen, dimensionesDeMeta, metaDeActores } from "./modeloActoresObjetivo";

// G6 (2026-10-13): los actores consultados del objetivo viajan en `meta.actores` y, desde que el analista elige su ícono,
// en `meta.actores_iconos`, alineado («» = automático).
describe("actores del objetivo", () => {
  test("un plan guardado antes (sin íconos) se lee con todos los íconos automáticos", () => {
    expect(actoresDeMeta({ actores: ["Estudiantes", "Docentes"] })).toEqual([
      { nombre: "Estudiantes", icono: "" }, { nombre: "Docentes", icono: "" },
    ]);
  });

  test("cada actor conserva su ícono en la ida y vuelta", () => {
    const meta = metaDeActores([{ nombre: "Estudiantes", icono: "book-open" }, { nombre: "Docentes", icono: "" }]);
    expect(meta).toEqual({ actores: ["Estudiantes", "Docentes"], actores_iconos: ["book-open", ""] });
    expect(actoresDeMeta(meta)).toEqual([{ nombre: "Estudiantes", icono: "book-open" }, { nombre: "Docentes", icono: "" }]);
  });

  test("sin ningún ícono elegido no escribe `actores_iconos`: el plan queda como antes", () => {
    expect(metaDeActores([{ nombre: "A", icono: "" }])).toEqual({ actores: ["A"], actores_iconos: undefined });
  });

  test("un actor recién agregado, todavía sin nombre, no cuenta como actor de la lámina", () => {
    expect(actoresQueSalen(metaDeActores([{ nombre: "Estudiantes", icono: "" }, { nombre: "", icono: "" }]).actores)).toBe(1);
  });

  test("las dimensiones se leen tal como se editan", () => {
    expect(dimensionesDeMeta({ dimensiones: ["Los propósitos", ""] })).toEqual(["Los propósitos", ""]);
    expect(dimensionesDeMeta({})).toEqual([]);
  });
});
