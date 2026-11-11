import { describe, expect, it } from "vitest";

import { PROCESAMIENTO_PESTANAS } from "../../lib/navegacion/catalogos/procesamiento";
import {
  ALIAS_PESTANAS_VALIDACION,
  clavePedidaValidacion,
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

  it("el panel de una regla con la clave de Instrumento abre Hallazgos", () => {
    expect(clavePedidaValidacion("instrumento", "regla")).toBe("hallazgos");
    // Otro panel no activa la regla especial.
    expect(clavePedidaValidacion("instrumento", "otro")).toBe("reglas");
    // La regla especial es solo de Instrumento.
    expect(clavePedidaValidacion("reglas_custom", "regla")).toBe("reglas");
    expect(clavePedidaValidacion("reglas", "regla")).toBe("reglas");
  });

  it("lo que no nombra ninguna pestaña cae en Explorar", () => {
    expect(clavePedidaValidacion("no-existe")).toBeNull();
    expect(clavePedidaValidacion("   ")).toBeNull();
    expect(resolverPestanaValidacion("no-existe")).toBe("explorar");
    expect(resolverPestanaValidacion(null)).toBe("explorar");
  });
});

describe("escribir la pestaña con su clave canónica", () => {
  it("cerrar el panel de una regla abierta por la clave vieja no salta a Reglas", () => {
    const abierto = "?pestana=instrumento&panel=regla&foco=R_1";
    const canonico = searchConPestanaCanonica(abierto);
    expect(new URLSearchParams(canonico).get("pestana")).toBe("hallazgos");
    expect(new URLSearchParams(canonico).get("foco")).toBe("R_1");
  });

  it("reescribe los alias y deja intactas las claves nuevas y lo demás", () => {
    expect(new URLSearchParams(searchConPestanaCanonica("?pestana=limpieza")).get("pestana")).toBe("hallazgos");
    expect(new URLSearchParams(searchConPestanaCanonica("?pestana=reglas_custom")).get("pestana")).toBe("reglas");
    expect(searchConPestanaCanonica("?pestana=hallazgos&panel=regla&foco=R_1")).toBe("?pestana=hallazgos&panel=regla&foco=R_1");
    expect(searchConPestanaCanonica("?seccion=validacion")).toBe("?seccion=validacion");
    expect(searchConPestanaCanonica("?pestana=no-existe")).toBe("?pestana=no-existe");
  });
});
