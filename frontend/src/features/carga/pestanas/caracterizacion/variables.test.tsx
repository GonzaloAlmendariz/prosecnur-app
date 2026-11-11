// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "variables". Ver arnes.tsx.
 *
 * Variables era el panel lateral "Variables de la base"
 * (`panel=variables-base&foco=<base>`); desde el ADR 0142 es una pestaña que
 * también existe con una sola base. El panel viejo se lee como la pestaña.
 */
import { describe, expect } from "vitest";
import {
  MADRE_E_HIJA,
  UNA_BASE_COMPLETA,
  VARIAS_SEPARADAS,
  direccionActual,
  escenario,
  escenariosDeMatriz,
  fijar,
  montar,
  pedidosHechos,
  prepararGrupo,
} from "./arnes";

prepararGrupo("variables");

escenariosDeMatriz("variables");

const CATALOGO = "/api/carga/equivalencias/variables";

describe("CargaPage, Variables", () => {
  escenario("una-base_variables_sin-catalogo", "una base: lee la base única y no pide el catálogo de equivalencias", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "variables" });
    expect(pedidosHechos()).toContain("GET /api/carga/base-variables?base=default");
    expect(pedidosHechos().filter((p) => p.includes(CATALOGO))).toEqual([]);
    expect(document.querySelector("#carga-workspace-tab-variables")?.getAttribute("aria-selected")).toBe("true");
    fijar("una-base_variables_sin-catalogo");
  });

  escenario("madre-e-hija_variables_panel-viejo", "el panel viejo con foco abre Variables en esa base, sin catálogo ni reescribir la dirección", async () => {
    const entrada = "/carga?pestana=fuentes&panel=variables-base&foco=miembros";
    await montar({ ...MADRE_E_HIJA, entrada });
    expect(document.querySelector("#carga-workspace-tab-variables")?.getAttribute("aria-selected")).toBe("true");
    expect(direccionActual()).toBe(entrada);
    expect(pedidosHechos()).toContain("GET /api/carga/base-variables?base=miembros");
    expect(pedidosHechos().filter((p) => p.includes(CATALOGO))).toEqual([]);
    fijar("madre-e-hija_variables_panel-viejo");
  });

  escenario("varias_separadas_variables_foco", "bases separadas: la base del foco y el selector de base", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=variables&foco=estudiantes" });
    expect(pedidosHechos()).toContain("GET /api/carga/base-variables?base=estudiantes");
    // Con equivalencias el catálogo de preguntas por base sí se pide.
    expect(pedidosHechos().some((p) => p.includes(CATALOGO))).toBe(true);
    fijar("varias_separadas_variables_foco");
  });
});
