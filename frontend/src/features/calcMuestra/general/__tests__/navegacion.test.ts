/**
 * La sección «Selección» de Muestra general (ADR 0090) es una dirección del
 * contrato v3: vive en el modo `marco-disponible`, entre Método y Resultados,
 * y la página la monta con el mismo id en su rail.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PROSECNUR_MODULES } from "../../../../lib/modules";
import { parsearDireccion, serializarDireccion } from "../../../../lib/navegacion/direccion";
import { resolverSeccion, seccionesDelModo } from "../../../../lib/navegacion/useDireccion";

const CALC = PROSECNUR_MODULES.find((m) => m.slug === "calc-muestra")!;

describe("Muestra general › Selección", () => {
  it("se declara entre Método y Resultados del modo marco-disponible", () => {
    expect(seccionesDelModo(CALC, "marco-disponible").map((s) => s.id)).toEqual([
      "marco",
      "metodo",
      "seleccion",
      "resultados",
    ]);
  });

  it("su dirección sobrevive el round-trip", () => {
    const href = "/calc-muestra?modo=marco-disponible&seccion=seleccion";
    const direccion = parsearDireccion("/calc-muestra", "?modo=marco-disponible&seccion=seleccion");
    expect(direccion?.modo).toBe("marco-disponible");
    expect(direccion?.seccion).toBe("seleccion");
    expect(serializarDireccion(direccion!)).toBe(href);
    const seccion = seccionesDelModo(CALC, "marco-disponible").find((s) => s.id === "seleccion");
    expect(seccion?.to).toBe(href);
  });

  it("no se filtra a los modos que no sortean de un marco", () => {
    expect(resolverSeccion("seleccion", seccionesDelModo(CALC, "territorial-handoff"))).toBe("hojas-ruta");
  });

  it("la página la monta en el rail y en la mesa con el mismo id", () => {
    const fuente = fs.readFileSync(path.join(__dirname, "..", "..", "CalcMuestraPage.tsx"), "utf8");
    const rail = fuente.slice(fuente.indexOf("function railSectionsForDesk"), fuente.indexOf("function tecnicaLabel"));
    const general = rail.slice(rail.indexOf('desk === "marco_disponible"'), rail.indexOf('desk === "acreditacion"'));
    expect(general.match(/id: "(\w+)"/g)).toEqual(['id: "marco"', 'id: "metodo"', 'id: "seleccion"', 'id: "resultados"']);
    expect(fuente).toContain("<MesaGeneral");
    const mesa = fs.readFileSync(path.join(__dirname, "..", "MesaGeneral.tsx"), "utf8");
    expect(mesa).toContain('selectedSection === "seleccion" && <SeleccionGeneral');
    const seleccion = fs.readFileSync(path.join(__dirname, "..", "SeleccionGeneral.tsx"), "utf8");
    expect(seleccion).toContain('"cmv2-section-general-seleccion"');
  });
});

describe("Acreditación › Selección (E5)", () => {
  it("se declara entre Contexto y Resultados del modo acreditacion", () => {
    expect(seccionesDelModo(CALC, "acreditacion").map((s) => s.id)).toEqual([
      "actores",
      "contexto",
      "seleccion",
      "resultados",
    ]);
  });

  it("su dirección, con el actor en foco, sobrevive el round-trip", () => {
    const href = "/calc-muestra?modo=acreditacion&seccion=seleccion&foco=cmp-est";
    const direccion = parsearDireccion("/calc-muestra", "?modo=acreditacion&seccion=seleccion&foco=cmp-est");
    expect(direccion).toMatchObject({ modo: "acreditacion", seccion: "seleccion", foco: "cmp-est" });
    expect(serializarDireccion(direccion!)).toBe(href);
    const seccion = seccionesDelModo(CALC, "acreditacion").find((s) => s.id === "seleccion");
    expect(seccion?.to).toBe("/calc-muestra?modo=acreditacion&seccion=seleccion");
  });

  it("la página la monta en el rail y en la mesa con el mismo id, sin crecer", () => {
    const fuente = fs.readFileSync(path.join(__dirname, "..", "..", "CalcMuestraPage.tsx"), "utf8");
    const rail = fuente.slice(fuente.indexOf("function railSectionsForDesk"), fuente.indexOf("function tecnicaLabel"));
    const acreditacion = rail.slice(rail.indexOf('desk === "acreditacion"'), rail.indexOf('desk === "territorial_handoff"'));
    expect(acreditacion.match(/id: "(\w+)"/g)).toEqual(['id: "actores"', 'id: "contexto"', 'id: "seleccion"', 'id: "resultados"']);
    expect(acreditacion).toContain('targetId: "cmv2-section-acreditacion-seleccion"');
    expect(fuente).toContain("<MesaAcreditacion");
    const mesa = fs.readFileSync(path.join(__dirname, "..", "MesaAcreditacion.tsx"), "utf8");
    expect(mesa).toContain('selectedSection === "seleccion" && <SeleccionActores componentes={estudio.componentes} />');
    const seccion = fs.readFileSync(path.join(__dirname, "..", "SeleccionActores.tsx"), "utf8");
    expect(seccion).toContain('id="cmv2-section-acreditacion-seleccion"');
  });
});
