import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CalcMuestraAulasState,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { universitySidebarTabs } from "../../universidadTabs";
import { ExploradorAulasTab } from "../ExploradorAulasTab";

const workspace = {
  version: 2,
  frame_mode: "opinion_universitaria",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "estudiante",
  unidad_muestreo: "curso-horario",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
} as unknown as CalcMuestraWorkspace;

const estudio = { titulo: "", componentes: [] } as unknown as CalcMuestraEstudio;

const exploracion = {
  schema: "calc_muestra_aulas_exploracion_v1",
  totales: { facultades: 2, ch_total: 320, ch_elegibles: 250, elegibles_total: 5200, n_local_externo: 6, n_multi_facultad: 12 },
  por_facultad: [
    {
      facultad: "PSICOLOGÍA",
      ch_total: 120,
      ch_elegibles: 96,
      elegibles_total: 2900,
      est_aula_mediana: 28,
      est_aula_media: 30.4,
      por_tipo_sesion: [
        { tipo: "Teórico", ch: 80, ch_elegibles: 70, elegibles: 2300, mediana_elegibles: 32 },
        { tipo: "Práctica", ch: 40, ch_elegibles: 26, elegibles: 600, mediana_elegibles: null },
      ],
      por_nivel: [],
      n_multi_facultad: 4,
      n_local_externo: 0,
      n_sin_condicion: 6,
      top_cursos: [
        { id: "CH-1", curso: "Psicología General", nivel: "3", tipo: "Teórico", elegibles: 80, faculty_match_share: 0.9, local_externo: false, multi_facultad: false },
      ],
    },
    {
      facultad: "ARTE Y DISEÑO",
      ch_total: 60,
      ch_elegibles: 40,
      elegibles_total: 800,
      est_aula_mediana: 14,
      est_aula_media: 15.2,
      por_tipo_sesion: [{ tipo: "Taller", ch: 50, ch_elegibles: 36, elegibles: 700 }],
      por_nivel: [],
      n_multi_facultad: 0,
      n_local_externo: 3,
      n_sin_condicion: 0,
      top_cursos: [
        { id: "CH-Z1", curso: "Danza contemporánea", nivel: "2", tipo: "Taller", elegibles: 18, faculty_match_share: null, local_externo: true, multi_facultad: false },
      ],
    },
  ],
};

function stateWith(frameExtra: Record<string, unknown>, extra: Record<string, unknown> = {}): CalcMuestraAulasState {
  return {
    frame: {
      schema: "calc_muestra_aulas_frame_v1",
      generated_at: "2026-07-16T00:00:00Z",
      input_mode: "base_madre",
      config: {},
      frame_hash: "hash",
      aula_frame: [],
      audit: [],
      warnings: [],
      ...frameExtra,
    },
    ...extra,
  } as unknown as CalcMuestraAulasState;
}

describe("ExploradorAulasTab — estados", () => {
  it("sin exploracion muestra el estado vacío honesto (marcos viejos)", () => {
    const html = renderToStaticMarkup(
      <ExploradorAulasTab workspace={workspace} aulasState={stateWith({})} />,
    );
    expect(html).toContain("Reconstruye el marco para generar la radiografía");
    expect(html).toContain('data-audit-ready="false"');
  });

  it("con exploracion renderiza franja, cards y drill-down de la facultad top", () => {
    const html = renderToStaticMarkup(
      <ExploradorAulasTab workspace={workspace} aulasState={stateWith({ exploracion })} />,
    );
    expect(html).toContain('data-audit-ready="true"');
    // Franja de contexto con la misión
    expect(html).toContain("Radiografía del marco para elegir con conocimiento del terreno");
    expect(html).toContain("Locales externos");
    // Cards por facultad, con señales
    expect(html).toContain("PSICOLOGÍA");
    expect(html).toContain("ARTE Y DISEÑO");
    expect(html).toContain("4 multi-facultad");
    expect(html).toContain("3 local externo");
    expect(html).toContain("5.0% sin condición");
    // Tarjeta ancha: tabla por tipo de sesión con mediana por aula (32) y NA
    // honesto ("—" con tooltip) para el tipo sin dato
    expect(html).toContain("Mediana");
    expect(html).toContain("32");
    expect(html).toContain("un 0 mentiría que el aula típica está vacía");
    // Drill-down default: facultad con más elegibles (PSICOLOGÍA) y su top
    expect(html).toContain("Psicología General");
    expect(html).toContain("% misma facultad");
    expect(html).toContain("Elegibles efectivos");
    // Fórmula literal en el tooltip de la fila
    expect(html).toContain("80 elegibles × 90% misma facultad = 72 elegibles efectivos");
  });

  it("con titulares en la selección muestra el contraste por facultad", () => {
    const aulasState = stateWith(
      { exploracion },
      {
        selection: {
          schema: "calc_muestra_aulas_selection_v1",
          selection_run_id: "run",
          generated_at: "2026-07-16T00:00:00Z",
          frame_hash: "hash",
          seed: 1,
          selector: {},
          selection: [
            { faculty: "PSICOLOGÍA", sample_role: "titular" },
            { faculty: "PSICOLOGÍA", wave: "M1" },
            { faculty: "ARTE Y DISEÑO", wave: "M2", sample_role: "chain_reserve" },
          ],
          quotas: [],
          summary: [],
        },
      },
    );
    const html = renderToStaticMarkup(
      <ExploradorAulasTab workspace={workspace} aulasState={aulasState} />,
    );
    expect(html).toContain("Contraste con la selección");
    expect(html).toContain("2 titulares de 96 CH elegibles");
    // Sin titulares de Arte (solo reserva M2), esa facultad no aparece en el contraste
    expect(html).not.toContain("titulares de 40 CH elegibles");
  });
});

describe("marco-ch-radiografia — gating en el rail (igual a marco-aulas)", () => {
  it("sin marco descriptivo ni fuentes queda pending", () => {
    const tabs = universitySidebarTabs({ activeSection: "marco", estudio, workspace, aulasState: null }) ?? [];
    const tab = tabs.find((t) => t.id === "marco-ch-radiografia");
    expect(tab).toBeDefined();
    expect(tab?.status).toBe("pending");
    expect(tab?.targetId).toBe("cmv2-local-marco-ch-radiografia");
  });

  it("con marco descriptivo pasa a ready, igual que marco-aulas", () => {
    const aulasState = stateWith({ aula_frame: [{ classroom_id: "CH-1", eligible_n: 10 }] });
    const tabs = universitySidebarTabs({ activeSection: "marco", estudio, workspace, aulasState }) ?? [];
    const radiografia = tabs.find((t) => t.id === "marco-ch-radiografia");
    const aulas = tabs.find((t) => t.id === "marco-aulas");
    expect(radiografia?.status).toBe("ready");
    expect(radiografia?.status).toBe(aulas?.status);
  });
});
