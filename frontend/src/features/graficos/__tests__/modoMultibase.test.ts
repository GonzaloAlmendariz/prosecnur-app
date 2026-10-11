import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  test("informe compartido: nombra el conjunto y nunca la base activa (A7-1 H2)", () => {
    const modo = modoMultibaseDelPlan("independent_siblings", 4, "docentes", "consolidated");
    expect(modo.clave).toBe("compartido");
    expect(modo.etiqueta).toBe("Informe compartido · 4 bases");
    expect(`${modo.etiqueta} ${modo.explicacion}`).not.toMatch(/base activa|docentes/);
  });

  test("con alcance activo, o sin el 4.º argumento, el chip es el de siempre", () => {
    expect(modoMultibaseDelPlan("independent_siblings", 4, "docentes", "active").etiqueta)
      .toBe("Un informe por base · docentes");
    expect(modoMultibaseDelPlan("independent_siblings", 4, "docentes").clave).toBe("por-base");
    expect(modoMultibaseDelPlan("multibase", 4, null, "consolidated").clave).toBe("conjunto");
    expect(modoMultibaseDelPlan("independent_siblings", 1, "docentes", "consolidated").visible).toBe(false);
  });

  test("la barra de Láminas le pasa el alcance del informe", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(dir, "..", "laminas", "BarraLaminas.tsx"), "utf8");
    expect(source).toContain("const reportScope = useGraficosReportScope(useLocation().search)");
    expect(source).toMatch(/modoMultibaseDelPlan\([^)]*state\?\.active_base, reportScope\)/);
  });
});
