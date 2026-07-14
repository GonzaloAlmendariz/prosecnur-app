import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasState } from "../../../../api/client";
import type { PerfilInstitucional } from "../../dominio";
import { TabCobertura } from "../pestanas/TabCobertura";

const perfil = {
  etiquetaUnidad: "facultad",
  marcoAulas: 2483,
} as PerfilInstitucional;

/** Frame mínimo con pool (universo), población (elegibles) y aula_frame
 *  (cursos-horario con flag `included`) por facultad. */
function frameState(): CalcMuestraAulasState {
  return {
    frame: {
      population_pool: [
        { student_id: "1", faculty: "Facultad A" },
        { student_id: "2", faculty: "Facultad A" },
        { student_id: "3", faculty: "Facultad A" },
        { student_id: "4", faculty: "Facultad B" },
      ],
      population: [
        { student_id: "1", faculty: "Facultad A" },
        { student_id: "2", faculty: "Facultad A" },
        { student_id: "4", faculty: "Facultad B" },
      ],
      aula_frame: [
        { classroom_id: "a1", faculty: "Facultad A", included: true },
        { classroom_id: "a2", faculty: "Facultad A", included: false },
        { classroom_id: "b1", faculty: "Facultad B", included: true },
      ],
    },
  } as unknown as CalcMuestraAulasState;
}

describe("presentación de Cobertura", () => {
  it("muestra dos gráficos: alumnos y cursos-horario por facultad", () => {
    const html = renderToStaticMarkup(<TabCobertura perfil={perfil} aulasState={frameState()} />);
    // Dos tarjetas de gráfico.
    expect(html.match(/cmv2-cob-card"/g)?.length).toBe(2);
    expect(html).toContain("Alumnos por facultad");
    expect(html).toContain("Cursos-horario por facultad");
    // Alumnos: Facultad A tiene 3 en el pool, 2 elegibles.
    expect(html).toContain("Facultad A");
    expect(html).toContain("Facultad B");
    // Segmentos incluidos/excluidos presentes.
    expect(html).toContain('data-kind="in"');
    expect(html).toContain('data-kind="out"');
  });

  it("sin marco construido explica qué falta en vez de dejar la vista vacía", () => {
    const html = renderToStaticMarkup(<TabCobertura perfil={perfil} aulasState={null} />);
    expect(html).toContain("Construye el marco");
    expect(html).not.toContain("cmv2-cob-card");
  });
});
