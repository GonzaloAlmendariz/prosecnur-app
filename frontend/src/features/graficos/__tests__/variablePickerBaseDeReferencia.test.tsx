// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { contextoConBaseDeLamina, estadoBaseDeRef, type ContextoBaseRef } from "../baseDeReferencia";
import { relacionDeFuentes } from "../relacionBases";
import type { VarWithSource } from "../useVariables";

// CCSS Perfil 2026 (2026-11-05): el selector pintaba «falta la base» en 141 de 143 referencias sin prefijo que el motor
// resuelve con la base activa del informe (`.graficos_calificar_refs_plan`, `.resolve_source_name`).

const v = (name: string, label: string, source: string): VarWithSource => ({ name, label, tipo: "select_one", seccion: "", list_name: "l", source });

const variables: VarWithSource[] = [
  v("B3_recod", "Agrupación", "default"),
  v("A3", "Sexo", "default"),
  v("A3", "Sexo", "datos_crianza"),
  v("C1_hijo", "Edad del hijo", "datos_crianza"),
];
const relacion = relacionDeFuentes([
  { name: "default", source_role: "principal" },
  { name: "datos_crianza", source_role: "repeat", repeat_grain: { kind: "instancia", parent_base: "default" } },
]);
const ctx: ContextoBaseRef = { multi: true, variables, baseActiva: "default", relacionBases: relacion, scope: "active" };

describe("de qué base lee el motor una ref sin prefijo", () => {
  test("está en la base activa: sin alarma", () => {
    expect(estadoBaseDeRef("B3_recod", ctx)).toEqual({ tipo: "base-activa", base: "default" });
    expect(estadoBaseDeRef("A3", ctx)).toEqual({ tipo: "base-activa", base: "default" });
  });

  test("no está en la activa pero sí en otra: dice en cuál", () => {
    expect(estadoBaseDeRef("C1_hijo", ctx)).toEqual({ tipo: "en-otra-base", base: "datos_crianza", otras: ["datos_crianza"] });
  });

  test("no está en ninguna base", () => {
    expect(estadoBaseDeRef("Z9", ctx)).toEqual({ tipo: "en-ninguna" });
  });

  test("con una sola base, con prefijo o vacía no hay nada que decir", () => {
    expect(estadoBaseDeRef("A3", { ...ctx, multi: false })).toEqual({ tipo: "sin-aviso" });
    expect(estadoBaseDeRef("datos_crianza$A3", ctx)).toEqual({ tipo: "sin-aviso" });
    expect(estadoBaseDeRef("", ctx)).toEqual({ tipo: "sin-aviso" });
  });

  test("la base activa manda sobre la convención `default`, y sin ella se usa la convención", () => {
    expect(estadoBaseDeRef("C1_hijo", { ...ctx, baseActiva: "datos_crianza" })).toEqual({ tipo: "base-activa", base: "datos_crianza" });
    expect(estadoBaseDeRef("B3_recod", { ...ctx, baseActiva: null })).toEqual({ tipo: "base-activa", base: "default" });
  });

  test("en el informe compartido la ref suelta sí pide base", () => {
    expect(estadoBaseDeRef("A3", { ...ctx, scope: "consolidated" })).toEqual({ tipo: "falta-base" });
    const hermanos = relacionDeFuentes([{ name: "docentes" }, { name: "estudiantes" }]);
    expect(estadoBaseDeRef("A3", { ...ctx, baseActiva: null, relacionBases: hermanos })).toEqual({ tipo: "falta-base" });
  });
});

const sources = [
  { name: "default", variables: variables.filter((x) => x.source === "default") },
  { name: "datos_crianza", variables: variables.filter((x) => x.source === "datos_crianza") },
];
vi.mock("../useVariables", async (orig) => ({
  ...(await orig<typeof import("../useVariables")>()),
  useVariables: () => ({ sources, multi: true, variables, relacionBases: relacion, baseActiva: "default", scope: "active", loading: false, error: "" }),
}));

async function pintar(value: string): Promise<string> {
  const { default: VariablePicker } = await import("../VariablePicker");
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(VariablePicker, { value, onChange: () => undefined })));
}

describe("la pastilla del selector", () => {
  test('en la base activa: pastilla neutra "Base default", sin alarma', async () => {
    const html = await pintar("B3_recod");
    expect(html).toContain('data-base-ref="activa"');
    expect(html).toContain("Base default");
    expect(html).toContain("Agrupación");
    expect(html).not.toMatch(/is-sin-base|is-otra-base|is-ninguna|Falta la base/);
  });

  test("en otra base: aviso ámbar que dice en cuál y ofrece fijarla", async () => {
    const html = await pintar("C1_hijo");
    expect(html).toContain('data-base-ref="otra"');
    expect(html).toContain("Edad del hijo");
    expect(html).toContain("No está en la base &quot;default&quot;. Está en la base &quot;datos_crianza&quot;.");
    expect(html).toContain("Fijar en datos_crianza");
  });

  test('en ninguna base: rojo "No está en ninguna base"', async () => {
    const html = await pintar("Z9");
    expect(html).toContain('data-base-ref="ninguna"');
    expect(html).toContain("No está en ninguna base");
    expect(html).not.toContain("Fijar en");
  });

  test("con prefijo no pinta pastilla de alerta", async () => {
    const html = await pintar("datos_crianza$A3");
    expect(html).not.toContain("data-base-ref");
  });
});

describe("fijar en la otra base", () => {
  test("escribe el prefijo de la base donde está la pregunta", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { default: VariablePicker } = await import("../VariablePicker");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onChange = vi.fn();
    act(() => root.render(createElement(MemoryRouter, null, createElement(VariablePicker, { value: "C1_hijo", onChange }))));
    const boton = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Fijar en datos_crianza"));
    expect(boton).toBeTruthy();
    act(() => boton?.click());
    expect(onChange).toHaveBeenCalledWith("datos_crianza$C1_hijo");
    act(() => root.unmount());
    host.remove();
  });
});

describe("ronda 19 (F3): la ref suelta de la cobertura se lee en la primera base de la lámina", () => {
  test("el contexto toma la base de la lámina, también en el informe compartido", () => {
    expect(estadoBaseDeRef("A3", contextoConBaseDeLamina(ctx, "datos_crianza"))).toEqual({ tipo: "base-activa", base: "datos_crianza" });
    expect(estadoBaseDeRef("A3", contextoConBaseDeLamina({ ...ctx, scope: "consolidated" }, "datos_crianza")))
      .toEqual({ tipo: "base-activa", base: "datos_crianza" });
    // Sin base de la lámina (o una que no existe), la base activa.
    expect(estadoBaseDeRef("A3", contextoConBaseDeLamina(ctx, null))).toEqual({ tipo: "base-activa", base: "default" });
    expect(estadoBaseDeRef("A3", contextoConBaseDeLamina(ctx, "nadie"))).toEqual({ tipo: "base-activa", base: "default" });
  });

  test("el chip muestra la pregunta de la base de la lámina, no la de la activa", async () => {
    const { default: VariablePicker } = await import("../VariablePicker");
    const html = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(VariablePicker, { value: "A3", onChange: () => undefined, baseDeRefSuelta: "datos_crianza" })));
    expect(html).toContain("Base datos_crianza");
    expect(html).not.toContain("Base default");
  });
});
