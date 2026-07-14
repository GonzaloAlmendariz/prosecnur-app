import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CalcMuestraWorkspace } from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import { CalculoSupuestosTab } from "../CalculoSupuestosTab";

vi.mock("../../../../../components/Popover", () => ({
  Popover: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

const workspace: CalcMuestraWorkspace = {
  version: 2,
  frame_mode: "opinion_universitaria",
  marco_disponible: "Base institucional",
  fuente_marco: "Registros académicos",
  unidad_observacion: "Estudiante",
  unidad_muestreo: "Curso-horario",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
};

describe("presentación de Supuestos", () => {
  it("condensa los cuatro resultados pendientes en una sola franja", () => {
    const total = defaultComponente({ id: "total", parametros: { z: 1.96, p: 0.3 } });
    const facultades = defaultComponente({ id: "facultades", parametros: { z: 2.17, p: 0.5 } });
    const html = renderToStaticMarkup(
      <CalculoSupuestosTab
        totalComp={total}
        facultyComp={facultades}
        workspace={workspace}
        onComponente={() => undefined}
        onParametroCompartido={() => undefined}
        onCalcular={() => undefined}
        calculando={false}
      />,
    );

    expect(html).toContain("cmv2-calc-pending-strip");
    expect(html.match(/Resultados pendientes/g)).toHaveLength(1);
    expect(html).not.toContain("Supuestos del cálculo");
    expect(html).not.toContain("¿por qué importa?");
    expect(html).toContain('aria-label="Información sobre Confianza y precisión"');
  });

  it("identifica Universidad y Facultades y presenta decimales visibles con coma", () => {
    const total = defaultComponente({ id: "total", parametros: { z: 1.96, p: 0.3, deff: 1.2 } });
    const facultades = defaultComponente({ id: "facultades", parametros: { z: 2.17, p: 0.5, deff: 1.4 } });
    const html = renderToStaticMarkup(
      <CalculoSupuestosTab
        totalComp={total}
        facultyComp={facultades}
        workspace={workspace}
        onComponente={() => undefined}
        onParametroCompartido={() => undefined}
        onCalcular={() => undefined}
        calculando={false}
      />,
    );

    expect(html).toContain("Universidad");
    expect(html).toContain("Facultades");
    expect(html).toContain("z = 1,96");
    expect(html).toContain("z = 2,17");
    expect(html).toContain("p = 0,3");
    expect(html).toContain("p = 0,5");
  });
});
