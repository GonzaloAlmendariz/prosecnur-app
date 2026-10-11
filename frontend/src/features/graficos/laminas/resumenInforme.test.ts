import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../usePlanValidator";
import type { EstructuraInforme } from "./modeloEstructura";
import { PanelAvisos } from "./PanelAvisos";
import { agruparAvisos, rotuloLaminasYPartes, totalAvisos, type GrupoAvisos } from "./resumenInforme";

describe("rotuloLaminasYPartes", () => {
  it("sin conocer todas las láminas sólo cuenta láminas", () => {
    expect(rotuloLaminasYPartes(["a", "b"], { a: { estado: "nativa", partes: 2, avisos: 0 } })).toBe("2 láminas");
  });
  it("con todas vistas suma las partes «(cont.)»", () => {
    expect(rotuloLaminasYPartes(["a", "b"], {
      a: { estado: "nativa", partes: 2, avisos: 0 },
      b: { estado: "nativa", partes: 1, avisos: 0 },
    })).toBe("2 láminas · 3 partes");
  });
  it("sin partes extra no repite la cifra", () => {
    expect(rotuloLaminasYPartes(["a"], { a: { estado: "nativa", partes: 1, avisos: 0 } })).toBe("1 lámina");
  });
});

describe("agruparAvisos", () => {
  const issues: ValidationIssue[] = [
    { severity: "error", code: "slot-empty", message: "Falta el gráfico", slideId: "a" },
    { severity: "warning", code: "var-sin-base", message: "Sin base", slideId: "b" },
  ];
  it("separa lo que bloquea, lo que conviene revisar y lo que dijo el motor, en el orden del plan", () => {
    const g = agruparAvisos(issues, {
      b: { estado: "nativa", partes: 1, avisos: 1, avisosTexto: ["Se omitió una columna"] },
      a: { estado: "nativa", partes: 1, avisos: 0, avisosTexto: [] },
    }, ["a", "b"]);
    expect(g.bloquean.map((i) => i.slideId)).toEqual(["a"]);
    expect(g.revisar.map((i) => i.slideId)).toEqual(["b"]);
    expect(g.motor).toEqual([{ slideId: "b", avisos: ["Se omitió una columna"] }]);
    expect(totalAvisos(g)).toBe(3);
  });
});

// F6 (ADR 0096 decisión 8): los avisos de la matriz (siembra sin matriz, bases excluidas, desfase de la declaración)
// viven en «Avisos del informe» de Láminas y cuentan en «N avisos». Mata: calcularlos y no mostrarlos, o mostrarlos sin
// sumarlos al contador de la barra.
describe("avisos de equivalencias en el informe", () => {
  const SIN_MATRIZ = "El informe compartido se sembró sin láminas comparativas: no hay matriz de equivalencias declarada.";
  const grupos = {
    bloquean: [], revisar: [], motor: [], plan: [],
    equivalencias: [SIN_MATRIZ, "Administrativos quedó fuera: su release no está aprobada."],
  } as GrupoAvisos;

  it("totalAvisos suma los avisos de equivalencias", () => {
    expect(totalAvisos(grupos)).toBe(2);
  });

  it("agruparAvisos conserva el grupo de equivalencias vacío por defecto", () => {
    const g = agruparAvisos([], {}, []);
    expect((g as GrupoAvisos & { equivalencias?: string[] }).equivalencias).toEqual([]);
  });

  it("PanelAvisos muestra los avisos de equivalencias en su propio grupo", () => {
    const panel = { abierto: true, abrir: () => undefined, cerrar: () => undefined, alternar: () => undefined,
      props: { "data-pulso-panel": "avisos" } };
    const html = renderToStaticMarkup(createElement(PanelAvisos, {
      panel, grupos, estructura: { laminas: [] } as unknown as EstructuraInforme, onIr: () => undefined,
    }));
    expect(html).toContain(SIN_MATRIZ);
    expect(html).toContain("Administrativos quedó fuera");
  });
});
