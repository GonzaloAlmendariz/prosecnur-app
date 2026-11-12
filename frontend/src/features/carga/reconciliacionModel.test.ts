import { describe, expect, test } from "vitest";
import type { ReconciliacionExtra, ReconciliacionInfo } from "../../api/client";
import {
  dialogTitle,
  fillLabel,
  initialIncluidas,
  selectionEquals,
  summaryLabel,
  avisoDatoPersonal,
  toggleIncluida,
  vieneMarcadaPorDefecto,
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

  test("sin decisión previa marca las que tienen dato en más de la mitad de los casos", () => {
    // Ítem 21 del checklist de Validación (2026-11-12): fecha, horas, ubigeo y
    // teléfono llegaban con 94 a 99.9 % de datos y quedaban sin marcar.
    const result = initialIncluidas(
      info([
        extra({ name: "seleccionado", fill_pct: 100 }),
        extra({ name: "hora_inicio", fill_pct: 99.9 }),
        extra({ name: "telefono", fill_pct: 94 }),
        extra({ name: "mitad_y_algo", fill_pct: 50.1 }),
        extra({ name: "mitad", fill_pct: 50 }),
        extra({ name: "p_vieja", fill_pct: 35 }),
        extra({ name: "vacia", fill_pct: 0, n_fill: 0, kind: "vacia" }),
      ]),
    );
    expect(result).toEqual(["seleccionado", "hora_inicio", "telefono", "mitad_y_algo"]);
  });
});

describe("vieneMarcadaPorDefecto", () => {
  test("marca con más de la mitad de casos con dato y nunca una vacía", () => {
    expect(vieneMarcadaPorDefecto(extra({ fill_pct: 98 }))).toBe(true);
    expect(vieneMarcadaPorDefecto(extra({ fill_pct: 50 }))).toBe(false);
    expect(vieneMarcadaPorDefecto(extra({ kind: "vacia", fill_pct: 0, n_fill: 0 }))).toBe(false);
  });
  test("un dato potencialmente personal viene sin marcar aunque esté completo", () => {
    const telefono = extra({ name: "telefono", fill_pct: 97, personal: { sospecha: true, causa: "Parece teléfono: 9 dígitos en el 99 % de los casos con dato" } });
    expect(vieneMarcadaPorDefecto(telefono)).toBe(false);
    expect(initialIncluidas(info([telefono, extra({ name: "fecha", fill_pct: 99.6 })]))).toEqual(["fecha"]);
    expect(avisoDatoPersonal(telefono)).toEqual({
      rotulo: "Dato potencialmente personal identificado",
      causa: "Parece teléfono: 9 dígitos en el 99 % de los casos con dato",
    });
    expect(avisoDatoPersonal(extra({ name: "fecha" }))).toBeNull();
  });
});

describe("fillLabel", () => {
  test("vacía se rotula sin datos", () => {
    expect(fillLabel(extra({ kind: "vacia", fill_pct: 0 }))).toBe("Sin datos");
  });
  test("con datos redondea el porcentaje", () => {
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 100 }))).toBe("100 % con datos");
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 58.3 }))).toBe("58 % con datos");
  });
  test("una columna incompleta no se rotula como completa", () => {
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 99.9 }))).toBe("99 % con datos");
  });
  test("relleno menor a 1% se distingue de vacío", () => {
    expect(fillLabel(extra({ kind: "con_datos", fill_pct: 0.4 }))).toBe("Menos de 1 % con datos");
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
      "1 variable extra, 1 incluida",
    );
    expect(
      summaryLabel(
        info([extra({ name: "a", incluida: true }), extra({ name: "b", incluida: false })]),
      ),
    ).toBe("2 variables extra, 1 incluida");
  });
});

describe("dialogTitle", () => {
  test("singular / plural", () => {
    expect(dialogTitle(1)).toBe("Encontramos 1 variable que no está en tu formulario");
    expect(dialogTitle(3)).toBe("Encontramos 3 variables que no están en tu formulario");
  });
});
