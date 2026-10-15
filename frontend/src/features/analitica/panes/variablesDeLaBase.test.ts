// F7: «Usar una columna» no afirma un vacío mientras las columnas cargan y las
// vuelve a pedir al cambiar de base.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { VariableInstrumento } from "../../../api/client";
import { PesoPorColumna, avisoColumnasDePeso } from "./PesoPorColumna";
import { EVENTO_BASE_ACTIVA, crearLectorDeVariables, type LecturaVariables } from "./variablesDeLaBase";

const v = (name: string, extra: Partial<VariableInstrumento>): VariableInstrumento => ({
  name, label: name, tipo: "decimal", list_name: "", ...extra,
});

function diferido<T>() {
  let resolver!: (x: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("avisoColumnasDePeso", () => {
  test("mientras carga dice que carga, nunca que no hay columnas", () => {
    expect(avisoColumnasDePeso({ tipo: "cargando" }, "")).toEqual({
      tipo: "cargando", texto: "Cargando las columnas de la base…",
    });
  });

  test("un error dice que no se pudieron leer", () => {
    expect(avisoColumnasDePeso({ tipo: "error", mensaje: "timeout" }, "")?.texto)
      .toMatch(/^No se pudieron leer las columnas de la base/);
  });

  test("«no tiene columnas numéricas» sólo tras una respuesta real sin candidatas", () => {
    expect(avisoColumnasDePeso({ tipo: "lista", variables: [v("sexo", { categorica: true, numerica: true })] }, "")?.tipo)
      .toBe("sin-numericas");
    expect(avisoColumnasDePeso({ tipo: "lista", variables: [v("factor", { numerica: true })] }, "")).toBeNull();
  });
});

describe("PesoPorColumna en pantalla", () => {
  const render = (lectura: LecturaVariables, pesoColumna = "") => renderToStaticMarkup(createElement(PesoPorColumna, {
    modo: "columna", pesoColumna, lectura, baseActiva: "b2026", onModo: () => undefined, onColumna: () => undefined,
  }));

  test("cargando: el aviso de carga y ningún vacío afirmado", () => {
    const html = render({ tipo: "cargando" });
    expect(html).toContain("Cargando las columnas de la base…");
    expect(html).not.toContain("no tiene columnas numéricas");
    expect(html).not.toContain("<select");
  });

  test("con la lista, el selector con las candidatas", () => {
    const html = render({ tipo: "lista", variables: [v("factor_ponderacion", { numerica: true })] });
    expect(html).toContain("<select");
    expect(html).toContain("factor_ponderacion");
  });

  test("cargando con una columna declarada no la da por ausente", () => {
    const html = render({ tipo: "cargando" }, "factor_ponderacion");
    expect(html).toContain("Columna declarada: factor_ponderacion.");
    expect(html).not.toContain("no está en esta base");
  });
});

describe("crearLectorDeVariables", () => {
  test("publica cargando y luego la lista", async () => {
    const d = diferido<VariableInstrumento[]>();
    const vistas: LecturaVariables[] = [];
    const lector = crearLectorDeVariables(() => d.promesa, (l) => vistas.push(l));
    lector.pedir("b2026");
    expect(vistas).toEqual([{ tipo: "cargando" }]);
    d.resolver([v("factor", { numerica: true })]);
    await tick();
    expect(vistas.at(-1)).toMatchObject({ tipo: "lista" });
  });

  test("al cambiar de base vuelve a pedir y descarta la respuesta de la base anterior", async () => {
    const pedidos = [diferido<VariableInstrumento[]>(), diferido<VariableInstrumento[]>()];
    let i = 0;
    const vistas: LecturaVariables[] = [];
    const lector = crearLectorDeVariables(() => pedidos[i++].promesa, (l) => vistas.push(l));
    lector.pedir("b2026");
    lector.pedir("b2025");
    expect(i).toBe(2);
    pedidos[1].resolver([v("de_2025", { numerica: true })]);
    await tick();
    pedidos[0].resolver([v("de_2026", { numerica: true })]);
    await tick();
    const ultima = vistas.at(-1);
    expect(ultima?.tipo === "lista" && ultima.variables.map((x) => x.name)).toEqual(["de_2025"]);
  });

  test("la misma base en vuelo no se pide dos veces; terminada, sí", async () => {
    const d = diferido<VariableInstrumento[]>();
    let n = 0;
    const lector = crearLectorDeVariables(() => { n += 1; return d.promesa; }, () => undefined);
    lector.pedir("b2026");
    lector.pedir("b2026");
    expect(n).toBe(1);
    d.resolver([]);
    await tick();
    lector.pedir("b2026");
    expect(n).toBe(2);
  });

  test("un error publica error, no una lista vacía", async () => {
    const d = diferido<VariableInstrumento[]>();
    const vistas: LecturaVariables[] = [];
    crearLectorDeVariables(() => d.promesa, (l) => vistas.push(l)).pedir(null);
    d.rechazar(new Error("timeout"));
    await tick();
    expect(vistas.at(-1)).toEqual({ tipo: "error", mensaje: "timeout" });
  });

  test("Ponderación escucha el cambio de base activa que emite el selector", () => {
    const fuente = (nombre: string) => fs.readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), "utf8");
    expect(EVENTO_BASE_ACTIVA).toBe("pulso:active-base-changed");
    expect(fuente("./variablesDeLaBase.ts")).toContain("window.addEventListener(EVENTO_BASE_ACTIVA");
    expect(fuente("./PonderacionPane.tsx")).toContain("useVariablesDeLaBase(baseActiva)");
    expect(fuente("../../../app/Layout.tsx")).toContain('new CustomEvent("pulso:active-base-changed"');
  });
});
