import { describe, expect, it } from "vitest";

import { MONITOREO_PESTANAS_INTERNAS_AULAS } from "../../../../lib/navegacion/catalogos/monitoreo";
import { direccionPedida, vistaDeDireccion } from "./navegacion/direccionAulas";

/**
 * **Refuerzos es una pestaña de Consultas, y va detrás de Extras.**
 *
 * Gonzalo, 2026-09-11: «los refuerzos deberían tener su propia pestaña en
 * Consultas luego de la pestaña Extras». El orden no es decorativo: Extras dice
 * qué inventario hay y Refuerzos qué se hace con él, así que leerlas al revés
 * deja la decisión antes que el dato del que sale.
 *
 * Desde el revamp del esqueleto común (2026-10-23, `docs/qa/revamp-monitoreo/
 * aulas.md` §1) la vista sigue declarada con su clave en el catálogo INTERNO y
 * se ve como sub-vista de Control › Brechas, que reúne los tres caminos.
 */
describe("la pestaña Refuerzos", () => {
  const consultas = MONITOREO_PESTANAS_INTERNAS_AULAS.consultas;

  it("su dirección vieja lleva a Control › Brechas › Refuerzos, que la monta", () => {
    const destino = direccionPedida({ seccion: "consultas", pestana: "refuerzos", panel: null });
    expect(destino).toEqual({ seccion: "control", pestana: "brechas", panel: "refuerzos" });
    expect(vistaDeDireccion(destino!)).toEqual({ seccion: "consultas", pestana: "refuerzos" });
  });

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
