import { describe, expect, it } from "vitest";

import { didSexSeriesLabel } from "../didacticaCharts";

/**
 * La leyenda de un gráfico no puede exigir conocer la codificación del dato.
 *
 * «Distribución por facultad y sexo» mostraba **«F»** y **«M»** en su leyenda:
 * los códigos con que viene la base. Un gráfico que hay que descifrar no se
 * entrega a un cliente.
 *
 * Se traduce sólo lo reconocible; **cualquier otro valor pasa tal cual**, porque
 * si el estudio subdivide por algo que no es sexo, inventarle un nombre sería
 * peor que mostrar su código.
 */
describe("didSexSeriesLabel", () => {
  it("traduce los códigos habituales de la base", () => {
    expect(didSexSeriesLabel("M")).toBe("Hombres");
    expect(didSexSeriesLabel("F")).toBe("Mujeres");
  });

  it("nombra la ausencia de dato en vez de dejar el código", () => {
    expect(didSexSeriesLabel("")).toBe("Sin dato");
  });

  it("no inventa nombres para lo que no reconoce", () => {
    // Un estudio puede subdividir por algo que no es sexo: ahí el código propio
    // del estudio es más honesto que una etiqueta adivinada.
    expect(didSexSeriesLabel("Turno tarde")).toBe("Turno tarde");
    expect(didSexSeriesLabel("Cohorte 2019")).toBe("Cohorte 2019");
  });
});
