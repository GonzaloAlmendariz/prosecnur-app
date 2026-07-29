import { describe, expect, it } from "vitest";

import { PROSECNUR_MODULES } from "../../lib/modules";
import { ancestrosDe, aplanarArbol, arbolDeLaApp, padreDe, resolverDestino } from "./arbolDeLaApp";

describe("arbolDeLaApp", () => {
  it("expone un nodo raíz por módulo", () => {
    expect(arbolDeLaApp().map((n) => n.clave)).toEqual(PROSECNUR_MODULES.map((m) => m.slug));
  });

  it("no pierde las secciones de los modos", () => {
    // La versión plana anterior ofrecía 25 destinos y dejaba fuera las 34
    // secciones de los 9 modos: todo Monitoreo territorial, telefónico,
    // acreditación y cursos-horario quedaba sin poder referenciarse.
    const declaradas = PROSECNUR_MODULES.flatMap((m) =>
      (m.modos ?? []).flatMap((modo) => modo.sections.map(() => 1)),
    ).length;
    const enArbol = aplanarArbol().filter((n) => n.clave.includes("::") && n.nivel === "seccion").length;
    expect(enArbol).toBe(declaradas);
    expect(enArbol).toBeGreaterThan(0);
  });

  it("no pierde las pestañas", () => {
    const declaradas = PROSECNUR_MODULES.flatMap((m) => [
      ...m.sections.flatMap((s) => s.tabs ?? []),
      ...(m.modos ?? []).flatMap((modo) => modo.sections.flatMap((s) => s.tabs ?? [])),
    ]).length;
    expect(aplanarArbol().filter((n) => n.nivel === "pestana").length).toBe(declaradas);
    expect(declaradas).toBeGreaterThan(0);
  });

  it("cada nodo lleva una clave única", () => {
    const claves = aplanarArbol().map((n) => n.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("toda hoja navegable tiene href", () => {
    const sinRuta = aplanarArbol().filter((n) => n.nivel !== "modo" && !n.href);
    expect(sinRuta.map((n) => n.clave)).toEqual([]);
  });

  it("una sección que se llama igual que su módulo no se duplica, pero sus pestañas suben", () => {
    // «Procesamiento · Carga» tiene pestañas y «Monitoreo · Monitoreo» no
    // aporta un destino distinto del módulo.
    const monitoreo = arbolDeLaApp().find((n) => n.clave === "monitoreo")!;
    expect(monitoreo.hijos.some((h) => h.label === monitoreo.label)).toBe(false);
  });

  it("resuelve un destino de cada nivel", () => {
    const porNivel = new Map(aplanarArbol().map((n) => [n.nivel, n.clave]));
    for (const [, clave] of porNivel) {
      expect(resolverDestino(clave)?.clave).toBe(clave);
    }
    expect(porNivel.size).toBe(4);
  });

  it("una clave inexistente devuelve null en vez de reventar", () => {
    expect(resolverDestino("modulo-que-no-existe/seccion")).toBeNull();
    expect(resolverDestino("")).toBeNull();
  });

  describe("padreDe", () => {
    it.each([
      ["procesamiento/validacion", "procesamiento"],
      ["procesamiento/carga/fuentes", "procesamiento/carga"],
      ["monitoreo::territorial/avance", "monitoreo::territorial"],
      ["monitoreo::territorial", "monitoreo"],
      ["monitoreo", null],
    ])("%s → %s", (clave, esperado) => {
      expect(padreDe(clave)).toBe(esperado);
    });
  });

  it("los ancestros van del módulo hacia abajo y no incluyen al destino", () => {
    const pestana = aplanarArbol().find((n) => n.nivel === "pestana")!;
    const linea = ancestrosDe(pestana.clave);
    expect(linea.length).toBeGreaterThan(0);
    expect(linea[0].nivel).toBe("modulo");
    expect(linea.map((n) => n.clave)).not.toContain(pestana.clave);
  });

  it("una sección de modo tiene al modo y al módulo por ancestros, en ese orden", () => {
    const seccion = aplanarArbol().find((n) => n.clave.includes("::") && n.nivel === "seccion")!;
    expect(ancestrosDe(seccion.clave).map((n) => n.nivel)).toEqual(["modulo", "modo"]);
  });

  it("la ruta legible desambigua dos secciones con el mismo nombre en modos distintos", () => {
    // «Avance» existe en varios modos de Monitoreo: sin la ruta, dos nodos del
    // lienzo se leerían idénticos apuntando a lugares distintos.
    const avances = aplanarArbol().filter((n) => n.nivel === "seccion" && n.label === "Avance");
    if (avances.length > 1) {
      expect(new Set(avances.map((n) => n.ruta)).size).toBe(avances.length);
    }
  });
});
