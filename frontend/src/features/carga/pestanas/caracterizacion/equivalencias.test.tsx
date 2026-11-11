// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "equivalencias". Ver arnes.tsx.
 *
 * Equivalencias solo existe con bases de formularios distintos. Pedida en un
 * estudio que no la tiene, la página avisa por qué, corrige la dirección a
 * Bases y no pide nada a `/api/carga/equivalencias*`.
 */
import { describe, expect } from "vitest";
import {
  UNA_BASE_COMPLETA,
  VARIAS_INTEGRADAS,
  avisos,
  direccionActual,
  escenario,
  escenariosDeMatriz,
  fijar,
  montar,
  pedidosHechos,
  prepararGrupo,
} from "./arnes";

prepararGrupo("equivalencias");

escenariosDeMatriz("equivalencias");

describe("CargaPage, Equivalencias pedida en un estudio sin equivalencias", () => {
  for (const [nombre, opciones] of [
    ["una-base_equivalencias_no-disponible", { estado: UNA_BASE_COMPLETA }],
    ["varias_integradas_equivalencias_no-disponible", VARIAS_INTEGRADAS],
  ] as const) {
    escenario(nombre, `${nombre}: aviso y Bases`, async () => {
      await montar({ ...opciones, pestana: "equivalencias" });
      expect(document.querySelector("#carga-workspace-tab-bases")?.getAttribute("aria-selected")).toBe("true");
      expect(document.querySelector("#carga-workspace-tab-equivalencias")).toBeNull();
      expect(direccionActual()).toBe("/carga");
      expect(avisos()).toEqual([
        '"Equivalencias" no está en este estudio. Se ofrece cuando el estudio tiene dos o más bases con formularios distintos.',
      ]);
      expect(pedidosHechos().filter((p) => p.includes("/api/carga/equivalencias"))).toEqual([]);
      fijar(nombre);
    });
  }
});
