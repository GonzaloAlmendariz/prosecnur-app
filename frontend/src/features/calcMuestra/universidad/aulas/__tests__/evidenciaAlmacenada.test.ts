import { describe, expect, it } from "vitest";
import { tieneComparacionAlmacenada, tieneSeleccionAlmacenada } from "../evidenciaAlmacenada";
import {
  CLASSROOM_COMPARISON_SELECTOR_SCHEMA,
  classroomComparisonConfigDiff,
  classroomComparisonSelectorSnapshot,
} from "../classroomHandoff";

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

// El chequeo de frescura comparaba contra un numero que nadie eligio: con
// `config.n_aulas` ausente, el snapshot escribia `safeNumber(config.n_aulas, 30)`
// = 30. Sobre HSVG2026 el aviso decia «n_aulas (corrida 30 · vigente 165)» y ese
// 30 era el default de esa linea, no un valor guardado por nadie. Un aviso que
// nombra una cifra fabricada manda a buscar donde no hay nada.
//
// La familia entera —workspace y corrida desfasados— tiene direccion decidida en
// el ADR 0080, sin implementar. Esto NO la repara: sólo deja de inventar el
// numero con el que se compara.
describe("el objetivo ausente no se fabrica", () => {
  it("sin n_aulas el snapshot no declara treinta", () => {
    const snap = classroomComparisonSelectorSnapshot({} as never);
    expect(snap.n_aulas).toBeNull();
  });

  it("con n_aulas declarado lo respeta", () => {
    expect(classroomComparisonSelectorSnapshot({ n_aulas: 174 } as never).n_aulas).toBe(174);
  });

  it("el diff nombra la ausencia en vez de una cifra inventada", () => {
    const corrida = { schema: CLASSROOM_COMPARISON_SELECTOR_SCHEMA, n_aulas: 30 } as never;
    const d = classroomComparisonConfigDiff({ selector: corrida } as never, {} as never);
    const linea = d.find((x) => x.startsWith("n_aulas"));
    expect(linea).toContain("corrida 30");
    expect(linea).toContain("sin declarar");
  });
});
