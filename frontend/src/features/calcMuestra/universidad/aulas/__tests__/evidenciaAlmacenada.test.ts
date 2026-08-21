import { describe, expect, it } from "vitest";
import { tieneComparacionAlmacenada, tieneSeleccionAlmacenada } from "../evidenciaAlmacenada";

/**
 * Medido en el recorrido de un usuario nuevo: en un proyecto donde jamás se
 * corrió una comparación, la pestaña de titulares decía «La evidencia
 * almacenada no acredita la comparación vigente · Existe una corrida previa,
 * pero su comparación no coincide…» y mandaba a re-comparar algo inexistente.
 *
 * Causa: el estado trae las claves `selection` y `method_comparison` como
 * objetos VACÍOS —cero filas, sin identificador de corrida— y la señal se
 * calculaba con `Boolean(raw)`, que en JavaScript es verdadero para `{}`.
 */
describe("evidencia almacenada", () => {
  it("un objeto vacío no es una corrida previa", () => {
    expect(tieneComparacionAlmacenada({})).toBe(false);
    expect(tieneSeleccionAlmacenada({})).toBe(false);
  });

  it("nulo o ausente tampoco", () => {
    expect(tieneComparacionAlmacenada(null)).toBe(false);
    expect(tieneSeleccionAlmacenada(undefined)).toBe(false);
  });

  it("una comparación cuenta cuando trae métodos o recomendación", () => {
    expect(tieneComparacionAlmacenada({ methods: [{ method_id: "cube" }] })).toBe(true);
    expect(tieneComparacionAlmacenada({ recommendation: { method_id: "cube" } })).toBe(true);
    expect(tieneComparacionAlmacenada({ methods: [] })).toBe(false);
  });

  it("una selección cuenta cuando trae corrida o filas", () => {
    expect(tieneSeleccionAlmacenada({ selection_run_id: "sel_123" })).toBe(true);
    expect(tieneSeleccionAlmacenada({ selection: [{ classroom_id: "CH-1" }] })).toBe(true);
    expect(tieneSeleccionAlmacenada({ selection_run_id: "", selection: [] })).toBe(false);
  });
});
