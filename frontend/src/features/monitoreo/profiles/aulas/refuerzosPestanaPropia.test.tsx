import { describe, expect, it } from "vitest";

import { MONITOREO_PESTANAS } from "../../../../lib/navegacion/catalogos/monitoreo";

/**
 * **Refuerzos es una pestaña de Consultas, y va detrás de Extras.**
 *
 * Gonzalo, 2026-09-11: «los refuerzos deberían tener su propia pestaña en
 * Consultas luego de la pestaña Extras». El orden no es decorativo: Extras dice
 * qué inventario hay y Refuerzos qué se hace con él, así que leerlas al revés
 * deja la decisión antes que el dato del que sale.
 */
describe("la pestaña Refuerzos", () => {
  const consultas = MONITOREO_PESTANAS.aulas.consultas;

  it("existe en Consultas del modo cursos-horario", () => {
    expect(consultas.map((p) => p.key)).toContain("refuerzos");
  });

  it("va inmediatamente después de Extras", () => {
    const claves = consultas.map((p) => p.key);
    expect(claves.indexOf("refuerzos")).toBe(claves.indexOf("extras") + 1);
  });

  it("su rótulo y su detalle dicen las dos mitades del circuito", () => {
    const p = consultas.find((x) => x.key === "refuerzos");
    expect(p?.label).toBe("Refuerzos");
    // El detalle es lo que separa dos rótulos cortos que en castellano son
    // sinónimos; aquí tiene que decir techo y lo pedido.
    expect(p?.detail).toContain("techo");
    expect(p?.detail).toContain("pedido");
  });
});
