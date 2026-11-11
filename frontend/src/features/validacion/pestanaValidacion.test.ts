import { describe, expect, it } from "vitest";

import { PROCESAMIENTO_PESTANAS } from "../../lib/navegacion/catalogos/procesamiento";
import {
  ALIAS_PESTANAS_VALIDACION,
  clavePedidaValidacion,
  esAliasDelDetalleDeRegla,
  resolverPestanaValidacion,
  searchConPestanaCanonica,
} from "./pestanaValidacion";

// ADR 0142, rebanada V2 de P6: las claves viejas de Validación se leen como
// alias y no se escriben. Cada caso de abajo es un enlace guardado antes del
// 2026-11-11 que tiene que seguir abriendo la pestaña donde quedó su contenido.

describe("alias de las pestañas de Validación", () => {
  it("las cuatro claves nuevas se resuelven a sí mismas", () => {
    for (const tab of PROCESAMIENTO_PESTANAS.validacion) {
      expect(clavePedidaValidacion(tab.key)).toBe(tab.key);
    }
  });

  it("cada alias apunta a una pestaña que existe y no a otro alias", () => {
    const claves = PROCESAMIENTO_PESTANAS.validacion.map((tab) => tab.key as string);
    for (const [vieja, nueva] of Object.entries(ALIAS_PESTANAS_VALIDACION)) {
      expect(claves).toContain(nueva);
      expect(claves).not.toContain(vieja);
    }
  });

  it("Reglas del formulario y Criterios de revisión abren Reglas", () => {
    expect(clavePedidaValidacion("instrumento")).toBe("reglas");
    expect(clavePedidaValidacion("reglas_custom")).toBe("reglas");
    expect(clavePedidaValidacion("reglas-custom")).toBe("reglas");
  });

  it("Cierre de base abre Hallazgos, donde quedó la cola", () => {
    expect(clavePedidaValidacion("limpieza")).toBe("hallazgos");
  });

  // Plan de fidelidad, rebanada V0: el detalle de una regla del formulario
  // pasa a ser la ficha de Reglas. Antes (rebanada V2 de P6) abría Hallazgos.
  it("el enlace viejo al detalle de una regla abre Reglas, no Hallazgos", () => {
    expect(resolverPestanaValidacion("instrumento")).toBe("reglas");
    expect(esAliasDelDetalleDeRegla("instrumento", "regla")).toBe(true);
    // Otro panel, otra clave o la clave nueva no son ese enlace viejo.
    expect(esAliasDelDetalleDeRegla("instrumento", "otro")).toBe(false);
    expect(esAliasDelDetalleDeRegla("reglas_custom", "regla")).toBe(false);
    expect(esAliasDelDetalleDeRegla("reglas", "regla")).toBe(false);
    expect(esAliasDelDetalleDeRegla("hallazgos", "regla")).toBe(false);
    expect(esAliasDelDetalleDeRegla("instrumento", null)).toBe(false);
  });

  it("lo que no nombra ninguna pestaña cae en Explorar", () => {
    expect(clavePedidaValidacion("no-existe")).toBeNull();
    expect(clavePedidaValidacion("   ")).toBeNull();
    expect(resolverPestanaValidacion("no-existe")).toBe("explorar");
    expect(resolverPestanaValidacion(null)).toBe("explorar");
  });
});

describe("escribir la pestaña con su clave canónica", () => {
  it("el enlace viejo al detalle de una regla se escribe como Reglas con su foco y sin el panel del editor", () => {
    const viejo = "?pestana=instrumento&panel=regla&foco=R_1";
    const canonico = new URLSearchParams(searchConPestanaCanonica(viejo));
    expect(canonico.get("pestana")).toBe("reglas");
    expect(canonico.get("foco")).toBe("R_1");
    // `panel=regla` es ahora el editor de reglas propias: el enlace viejo no lo abre.
    expect(canonico.get("panel")).toBeNull();
  });

  it("en la clave nueva, panel=regla es del editor y se conserva", () => {
    expect(searchConPestanaCanonica("?pestana=reglas&panel=regla&foco=nueva")).toBe("?pestana=reglas&panel=regla&foco=nueva");
  });

  it("reescribe los alias y deja intactas las claves nuevas y lo demás", () => {
    expect(new URLSearchParams(searchConPestanaCanonica("?pestana=limpieza")).get("pestana")).toBe("hallazgos");
    expect(new URLSearchParams(searchConPestanaCanonica("?pestana=reglas_custom")).get("pestana")).toBe("reglas");
    expect(searchConPestanaCanonica("?pestana=hallazgos&panel=regla&foco=R_1")).toBe("?pestana=hallazgos&panel=regla&foco=R_1");
    expect(searchConPestanaCanonica("?seccion=validacion")).toBe("?seccion=validacion");
    expect(searchConPestanaCanonica("?pestana=no-existe")).toBe("?pestana=no-existe");
  });
});
