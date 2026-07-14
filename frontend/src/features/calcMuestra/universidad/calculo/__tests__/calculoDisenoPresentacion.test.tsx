import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { defaultComponente } from "../../../sharedCore";
import { CalculoDisenoTab } from "../CalculoDisenoTab";

vi.mock("../../../../../components/Popover", () => ({
  Popover: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

function render() {
  const total = defaultComponente({
    id: "total",
    parametros: { z: 1.96, p: 0.3, e: 0.025, deff: 2, tau: 0.53 },
    marco: { marco_validado: 22037 },
  });
  const faculty = defaultComponente({
    id: "faculty",
    tecnica: "prob_estratificado_independiente",
    parametros: { z: 2.17, p: 0.5, e: 0.05, deff: 1.5 },
    marco: {
      marco_validado: 22037,
      estratos: [
        { id: "ing", label: "Ingeniería", N: 5000, N_a: 2000, N_b: 3000, sub_a_label: "Mujeres", sub_b_label: "Hombres", promedio_conglomerado: 30, tau: 0.5 },
      ],
    },
  });
  return renderToStaticMarkup(
    <CalculoDisenoTab
      totalComp={total}
      facultyComp={faculty}
      marcoReady
      onSetComponentes={() => undefined}
      onCalcular={() => undefined}
      calculando={false}
    />,
  );
}

describe("presentación de Diseño", () => {
  it("muestra la fórmula y los parámetros con su significado", () => {
    const html = render();
    expect(html).toContain("La fórmula del diseño");
    expect(html).toContain("Confianza y precisión");
    expect(html).toContain("Proporción esperada");
    expect(html).toContain("Efecto de diseño");
    expect(html).toContain("Supuestos operativos");
  });

  it("no trae KPIs ejecutados, cifra de diseño, bolsa ni escenarios", () => {
    const html = render();
    expect(html).not.toContain("Cifra de diseño");
    expect(html).not.toContain("Reserva operativa");
    expect(html.toLowerCase()).not.toContain("escenarios");
    expect(html).not.toContain("n que despeja la fórmula");
  });

  it("permite definir parámetros por facultad (p por facultad)", () => {
    const html = render();
    expect(html).toContain("Parámetros por facultad");
    expect(html).toContain("Ingeniería");
    expect(html).toContain('aria-label="p esperada para Ingeniería"');
  });
});
