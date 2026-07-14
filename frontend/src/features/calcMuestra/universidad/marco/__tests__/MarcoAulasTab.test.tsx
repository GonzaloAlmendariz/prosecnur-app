import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { MarcoAulasTab } from "../MarcoAulasTab";

const workspace = {
  version: 2,
  frame_mode: "sin_definir",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "estudiante",
  unidad_muestreo: "curso-horario",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
  aulas_config: { min_elegibles_aula: 10 },
} as unknown as CalcMuestraWorkspace;

describe("MarcoAulasTab — embudo variable por proyecto", () => {
  it("renderiza un embudo válido de dos pasos", () => {
    const aulasState = {
      frame: {
        schema: "calc_muestra_aulas_frame_v1",
        generated_at: "2026-07-13T00:00:00Z",
        input_mode: "base_madre",
        config: {},
        frame_hash: "embudo-dos-pasos",
        aula_frame: [
          { classroom_id: "V01", included: true, eligible_n: 12, modality: "Virtual" },
        ],
        audit: [],
        warnings: [],
        perfil: {
          schema: "calc_muestra_aulas_perfil_v1",
          universo: 12,
          poblacion_n: 12,
          aulas_totales: 2,
          marco_aulas: 1,
          sexo_labels: [],
          embudo_alumno: [],
          embudo_aula: [
            { id: "total", label: "Cursos-horario detectados", conteo: 2, excluidos: 0 },
            { id: "resultado", label: "Virtuales con 10 o más elegibles", conteo: 1, excluidos: 1 },
          ],
          facultades: [],
          cobertura: { elegibles: 12, alcanzables: 12, pct: 1 },
        },
      },
    } as unknown as CalcMuestraAulasState;

    const html = renderToStaticMarkup(
      <MarcoAulasTab workspace={workspace} aulasState={aulasState} onWorkspace={() => {}} />,
    );

    expect(html).toContain("Cursos-horario detectados");
    expect(html).toContain("Virtuales con 10 o más elegibles");
    expect(html).toContain("−1 cursos-horario");
    expect(html).toContain('data-orientacion="horizontal"');
  });

  it("usa una retícula adaptativa cuando seis criterios dinámicos necesitan más espacio", () => {
    const labels = [
      "Cursos-horario únicos detectados en la base institucional",
      "Modalidad · Virtual sincrónica y semipresencial",
      "Tipo de sesión · Taller y laboratorio aplicado",
      "Tipo de docente · Docente contratado y docente ordinario",
      "Nivel del curso · Facultad 1: niveles 5–10",
      "Con 10 o más alumnos elegibles por curso-horario",
    ];
    const aulasState = {
      frame: {
        schema: "calc_muestra_aulas_frame_v1",
        generated_at: "2026-07-13T00:00:00Z",
        input_mode: "base_madre",
        config: {},
        frame_hash: "embudo-seis-pasos",
        aula_frame: [
          { classroom_id: "V01", included: true, eligible_n: 12, modality: "Virtual" },
        ],
        audit: [],
        warnings: [],
        perfil: {
          schema: "calc_muestra_aulas_perfil_v1",
          universo: 12,
          poblacion_n: 12,
          aulas_totales: 6,
          marco_aulas: 1,
          sexo_labels: [],
          embudo_alumno: [],
          embudo_aula: labels.map((label, index) => ({
            id: index === 0 ? "total" : `paso-${index}`,
            label,
            conteo: 6 - index,
            excluidos: index === 0 ? 0 : 1,
          })),
          facultades: [],
          cobertura: { elegibles: 12, alcanzables: 12, pct: 1 },
        },
      },
    } as unknown as CalcMuestraAulasState;

    const html = renderToStaticMarkup(
      <MarcoAulasTab workspace={workspace} aulasState={aulasState} onWorkspace={() => {}} />,
    );

    expect(html).toContain('data-orientacion="adaptive"');
    expect(html).toContain('data-etapas="6"');
    for (const label of labels) expect(html).toContain(label);
  });
});
