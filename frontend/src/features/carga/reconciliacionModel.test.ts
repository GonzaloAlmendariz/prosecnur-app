import { describe, expect, test } from "vitest";
import type { ReconciliacionExtra, ReconciliacionInfo } from "../../api/client";
import {
  dialogTitle,
  fillLabel,
  initialIncluidas,
  selectionEquals,
  summaryLabel,
  toggleIncluida,
} from "./reconciliacionModel";

function extra(overrides: Partial<ReconciliacionExtra> = {}): ReconciliacionExtra {
  return {
    name: "var_x",
    fill_pct: 100,
    n_fill: 10,
    kind: "con_datos",
    incluida: false,
    ...overrides,
  };
}

function info(extras: ReconciliacionExtra[]): ReconciliacionInfo {
  return {
    ok: true,
    extra: extras,
    n_extra: extras.length,
    n_incluidas: extras.filter((e) => e.incluida).length,
  };
}

describe("initialIncluidas", () => {
  test("toma solo las marcadas por el backend", () => {
    const result = initialIncluidas(
      info([
        extra({ name: "a", incluida: true }),
        extra({ name: "b", incluida: false }),
        extra({ name: "c", incluida: true }),
      ]),
    );
    expect(result).toEqual(["a", "c"]);
  });
});

describe("fillLabel", () => {
  test("vacía se rotula sin datos", () => {
    expect(fillLabel(extra({ kind: "vacia", fill_pct: 0 }))).toBe("Sin datos");
  });
  test("con datos redondea el porcentaje", () => {
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 100 }))).toBe("100% con datos");
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 58.3 }))).toBe("58% con datos");
  });
  test("relleno menor a 1% se distingue de vacío", () => {
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 0.4 }))).toBe("Menos de 1% con datos");
  });
});

describe("toggleIncluida", () => {
  const extras = [extra({ name: "a" }), extra({ name: "b" }), extra({ name: "c" })];
  test("agrega respetando el orden de aparición", () => {
    expect(toggleIncluida(extras, ["c"], "a")).toEqual(["a", "c"]);
  });
  test("quita si ya estaba", () => {
    expect(toggleIncluida(extras, ["a", "b"], "a")).toEqual(["b"]);
  });
  test("no muta el arreglo original", () => {
    const incluidas = ["a"];
    toggleIncluida(extras, incluidas, "b");
    expect(incluidas).toEqual(["a"]);
  });
});

describe("selectionEquals", () => {
  test("ignora el orden", () => {
    expect(selectionEquals(["a", "b"], ["b", "a"])).toBe(true);
  });
  test("detecta diferencias", () => {
    expect(selectionEquals(["a"], ["a", "b"])).toBe(false);
    expect(selectionEquals(["a"], ["b"])).toBe(false);
  });
});

describe("summaryLabel", () => {
  test("singular / plural", () => {
    expect(summaryLabel(info([extra({ name: "a", incluida: true })]))).toBe(
      "1 variable extra · 1 incluida",
    );
    expect(
      summaryLabel(
        info([extra({ name: "a", incluida: true }), extra({ name: "b", incluida: false })]),
      ),
    ).toBe("2 variables extra · 1 incluida");
  });
});

describe("dialogTitle", () => {
  test("singular / plural", () => {
    expect(dialogTitle(1)).toBe("Encontramos 1 variable que no está en tu formulario");
    expect(dialogTitle(3)).toBe("Encontramos 3 variables que no están en tu formulario");
  });
});
