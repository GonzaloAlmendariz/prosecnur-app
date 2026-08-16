import { describe, expect, it } from "vitest";

import { describirCobertura, padresConDummies } from "./coberturaVariable";
import type { DataReviewVariable } from "../../api/client";

// Los tres casos límite salen de payloads reales de `data-review`, no de
// imaginación: se midieron sobre los proyectos de referencia y hoy los tres
// escribían el mismo «0 con dato» en la tarjeta.

function variable(extra: Partial<DataReviewVariable>): DataReviewVariable {
  return {
    name: "x",
    tipo_xlsform: "text",
    seccion: "General",
    included: true,
    label_actual: "x",
    label_original: "x",
    n_non_missing: 0,
    n_missing: 0,
    opciones: [],
    dummy_parent: null,
    dummy_parent_label: null,
    dummy_option_code: null,
    dummy_option_label: null,
    ...extra,
  } as DataReviewVariable;
}

describe("describirCobertura", () => {
  it("una variable normal lleva su denominador", () => {
    // Hoy decía «1241 con dato»: sin el total no se sabe si es casi todo o la
    // mitad.
    const c = describirCobertura({ n_non_missing: 1241, n_missing: 42 });
    expect(c.estado).toBe("normal");
    expect(c.texto).toBe("1241 de 1283 con dato");
    expect(c.aviso).toBeNull();
  });

  it("distingue la vacía de la ausente, que hoy se leían igual", () => {
    // `whynotconsent` (acnur_acg): la columna llegó y sus 1283 filas están
    // vacías.
    const vacia = describirCobertura({ n_non_missing: 0, n_missing: 1283 });
    expect(vacia.estado).toBe("vacia");
    expect(vacia.texto).toBe("0 de 1283 con dato");
    expect(vacia.aviso?.etiqueta).toBe("sin ningún dato");
    expect(vacia.aviso?.detalle).toContain("1283");

    // `SPACE_nolabel` (acnur_pdm): declarada en el formulario, ausente en los
    // datos. El motor la devuelve como 0/0.
    const ausente = describirCobertura({ n_non_missing: 0, n_missing: 0 });
    expect(ausente.estado).toBe("ausente");
    expect(ausente.aviso?.etiqueta).toBe("no está en la base");

    // El control: los dos avisos tienen que decir cosas distintas, o el
    // arreglo no sirve de nada.
    expect(vacia.aviso?.detalle).not.toBe(ausente.aviso?.detalle);
  });

  it("un select_multiple repartido en dummies no es un problema", () => {
    // `D1_information` (acnur_acg) llega como 0/0 igual que la ausente, pero
    // su contenido vive en D1_information.1 … .96. Avisar aquí sería un falso
    // positivo, y de los caros: hay 6 en los proyectos de referencia.
    const c = describirCobertura({ n_non_missing: 0, n_missing: 0 }, true);
    expect(c.estado).toBe("expandida");
    expect(c.aviso).toBeNull();
    expect(c.texto).toContain("opciones");
  });

  it("no inventa avisos donde el motor no vio nada raro", () => {
    // El control de todo lo anterior: si `tieneDummies` colara en el camino
    // normal, cualquier variable con datos se anunciaría como repartida.
    expect(describirCobertura({ n_non_missing: 10, n_missing: 0 }, true).estado).toBe("normal");
    expect(describirCobertura({ n_non_missing: 10, n_missing: 0 }, true).aviso).toBeNull();
  });

  it("un conteo corrupto no rompe la tarjeta", () => {
    // El payload viaja por `serializer_unboxed_json`, donde un entero puede
    // llegar como `NA`. Que degrade a «ausente» es aceptable; que la tarjeta
    // muestre «NaN de NaN» no.
    const c = describirCobertura({ n_non_missing: -3, n_missing: -1 } as never);
    expect(c.texto).not.toContain("NaN");
    expect(c.texto).not.toContain("-");
  });
});

describe("padresConDummies", () => {
  it("reúne los padres declarados por las columnas dummy", () => {
    const padres = padresConDummies([
      variable({ name: "D1_information.1", dummy_parent: "D1_information" }),
      variable({ name: "D1_information.2", dummy_parent: "D1_information" }),
      variable({ name: "D1_information_recod.1", dummy_parent: "D1_information_recod" }),
      variable({ name: "edad" }),
    ]);
    expect([...padres].sort()).toEqual(["D1_information", "D1_information_recod"]);
  });

  it("ignora el padre en blanco", () => {
    // El motor manda `""` cuando no hay dummy_meta; un padre vacío en el Set
    // haría que la variable sin nombre se leyera como repartida.
    expect(padresConDummies([variable({ dummy_parent: "  " })]).size).toBe(0);
  });
});
