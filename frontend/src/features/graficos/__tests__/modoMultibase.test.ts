import { describe, expect, test } from "vitest";
import { modoMultibaseDelPlan } from "../modoMultibase";

describe("modo multibase del plan de gráficos", () => {
  test("con una sola base no hay nada que declarar", () => {
    expect(modoMultibaseDelPlan("multibase", 1).visible).toBe(false);
    expect(modoMultibaseDelPlan(null, 0).visible).toBe(false);
  });

  test("bases combinadas: un plan que las mezcla", () => {
    const modo = modoMultibaseDelPlan("multibase", 4);
    expect(modo.clave).toBe("conjunto");
    expect(modo.etiqueta).toBe("Un informe conjunto · 4 bases");
    expect(modo.explicacion).toContain("cada gráfico declara de cuál");
  });

  test("hermanas independientes: un plan por base, nombrando la activa", () => {
    const modo = modoMultibaseDelPlan("independent_siblings", 4, "docentes");
    expect(modo.clave).toBe("por-base");
    expect(modo.etiqueta).toBe("Un informe por base · docentes");
    expect(modo.explicacion).toContain("su propio plan");
  });

  test("independientes sin base activa todavía", () => {
    expect(modoMultibaseDelPlan("independent_siblings", 2, "").etiqueta).toBe("Un informe por base");
  });

  test("un modo desconocido se lee como conjunto, que es el histórico", () => {
    expect(modoMultibaseDelPlan("otro_modo", 3).clave).toBe("conjunto");
  });
});
