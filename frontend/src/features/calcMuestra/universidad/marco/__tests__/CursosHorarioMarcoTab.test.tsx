import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { CursosHorarioMarcoTab } from "../CursosHorarioMarcoTab";

const workspace = {
  version: 2,
  frame_mode: "opinion_universitaria",
  aulas_config: {},
} as unknown as CalcMuestraWorkspace;

const criterios_catalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [
    {
      id: "session_type",
      scope: "aula",
      label: "Tipo de sesión",
      kind: "flat",
      mappedColumn: "Tipo de curso",
      categories: [
        { key: "teorico", label: "Teórico", aulas: 80, por_facultad: [{ facultad: "PSICOLOGÍA", ch: 80 }] },
        { key: "laboratorio", label: "Laboratorio", aulas: 16, por_facultad: [{ facultad: "PSICOLOGÍA", ch: 16 }] },
      ],
    },
    {
      id: "enrolled_total",
      scope: "aula",
      label: "Matrículas inscritas por curso-horario",
      kind: "numeric",
      mappedColumn: "Matriculados",
    },
    {
      id: "faculty",
      scope: "alumno",
      label: "Facultad",
      kind: "flat",
      estratifica: true,
      categories: [{ key: "psicologia", label: "PSICOLOGÍA", aulas: 96 }],
    },
  ],
};

const exploracion = {
  schema: "calc_muestra_aulas_exploracion_v1",
  totales: { facultades: 1, ch_total: 120, ch_elegibles: 96, elegibles_total: 2900, n_local_externo: 0, n_multi_facultad: 4 },
  por_facultad: [
    {
      facultad: "PSICOLOGÍA",
      ch_total: 120,
      ch_elegibles: 96,
      elegibles_total: 2900,
      est_aula_mediana: 28,
      est_aula_media: 30.4,
      por_tipo_sesion: [{ tipo: "Teórico", ch: 80, ch_elegibles: 70, elegibles: 2300, mediana_elegibles: 32 }],
      por_nivel: [],
      n_multi_facultad: 4,
      n_local_externo: 0,
      n_sin_condicion: 0,
      top_cursos: [{ id: "CH-1", curso: "Psicología General", nivel: "3", tipo: "Teórico", elegibles: 80, faculty_match_share: 0.9, local_externo: false, multi_facultad: false }],
    },
  ],
};

const aulasState = {
  frame: {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-07-16T00:00:00Z",
    input_mode: "base_madre",
    config: {},
    frame_hash: "hash",
    aula_frame: [
      {
        classroom_id: "CH-1",
        course_name: "Psicología General",
        faculty: "PSICOLOGÍA",
        eligible_n: 80,
        included: true,
      },
      ...Array.from({ length: 95 }, (_, index) => ({
        classroom_id: `CH-${index + 2}`,
        faculty: "PSICOLOGÍA",
        eligible_n: 30,
        included: true,
      })),
    ],
    audit: [{ metric: "classroom_included_n", value: 96 }],
    warnings: [],
    criterios_catalogo,
    exploracion,
  },
} as unknown as CalcMuestraAulasState;

describe("CursosHorarioMarcoTab — vista integrada facultad-primaria", () => {
  it("renderiza la barra global, la base global y el bloque por facultad con su radiografía", () => {
    const html = renderToStaticMarkup(
      <CursosHorarioMarcoTab
        workspace={workspace}
        aulasState={aulasState}
        facultades={["PSICOLOGÍA"]}
        onWorkspace={() => {}}
        onReconstruir={() => {}}
        puedeReconstruir
      />,
    );
    // Contenedor de la vista facultad-primaria y superficie de QA lista.
    expect(html).toContain("cmv2-chfp");
    expect(html).toContain('data-audit-ready="true"');
    // Barra global de recálculo (único punto que reconstruye el marco).
    expect(html).toContain("Calcular población y cursos-horario elegibles");
    // ADR 0057, regla 1 · Ya no hay sección «Ajustes del marco · transversales».
    // Esos criterios no admiten override por facultad en el contrato vigente,
    // pero presentarlos aparte los leía como criterios generales y los sacaba
    // del embudo. Ahora se montan DENTRO del flujo de la facultad, en su
    // posición: matriculados abre, mínimo y composición cierran.
    expect(html).not.toContain("Ajustes del marco");
    expect(html).not.toContain("Transversales a todas las facultades");
    // Una variable numérica no representable en el bloque por facultad no se
    // pierde por `soloAjustes`: conserva aquí su control global editable.
    expect(html).toContain("Matrículas inscritas por curso-horario");
    // Bloque de la facultad con su radiografía visible (primer bloque abierto).
    expect(html).toContain("PSICOLOGÍA");
    /*
     * G39 · Aquí había un `toContain("aulas candidatas")`, la frase de la barra
     * única del recorrido, usada como marca de que el bloque de la facultad se
     * había montado. La barra se sustituyó por una por criterio y la frase
     * desapareció.
     *
     * No se sustituye por el texto nuevo: las barras sólo se dibujan cuando el
     * motor publica ese paso en la cascada, y el fixture de este caso no lo hace
     * —correctamente—. Afirmarlo aquí ataría el caso a una condición que no está
     * probando. Lo que sí quería comprobar —que el bloque de la facultad y su
     * radiografía se montaron— ya lo dicen las dos líneas de al lado.
     */
    // Decisión por facultad presente (mismo criterio que la base global).
    expect(html).toContain("Decisión para esta facultad");
  });

  it("sin catálogo muestra el estado vacío honesto (aún no hay criterios)", () => {
    const sinCatalogo = {
      frame: { ...aulasState.frame, criterios_catalogo: undefined },
    } as unknown as CalcMuestraAulasState;
    const html = renderToStaticMarkup(
      <CursosHorarioMarcoTab
        workspace={workspace}
        aulasState={sinCatalogo}
        facultades={["PSICOLOGÍA"]}
        onWorkspace={() => {}}
        onReconstruir={() => {}}
        puedeReconstruir
      />,
    );
    expect(html).toContain("Aún no hay catálogo de criterios de curso-horario");
    expect(html).toContain('data-audit-ready="false"');
  });
});
