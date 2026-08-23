import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraEstudio,
  CalcMuestraResultado,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { ResumenDiseno } from "../ResumenDiseno";
import type { MotorEfectivo } from "../usePerfilEfectivo";

const normalizeDistribution = vi.hoisted(() => vi.fn());
const motorStoreState = vi.hoisted(() => ({ scenario: "e1" as "e1" | "e2" }));

vi.mock("../../../../api/calcMuestraDistribucionI19", () => ({
  normalizeCalcMuestraDistribucionI19: normalizeDistribution,
}));
vi.mock("../../store", () => ({
  useMotorStore: (selector: (state: unknown) => unknown) => selector({
    resetCanon: () => {},
    decisiones: {
      escenario: motorStoreState.scenario,
      opcionalesActivos: [],
    },
  }),
}));

const source = readFileSync(new URL("../ResumenDiseno.tsx", import.meta.url), "utf8");
const CURRENT_FRAME_HASH = "frame-i19-current";

function rawResult(nObjetivo: number, nOperativo: number): CalcMuestraResultado {
  return {
    n_objetivo: nObjetivo,
    n_operativo: nOperativo,
    distribucion_universitaria: { raw: true },
  } as unknown as CalcMuestraResultado;
}

const p1Result = rawResult(37, 44);
const p2Result = rawResult(57, 66);
const p1 = {
  id: "component-p1",
  actor_id: "estudiantes_universidad",
  tecnica: "prob_conglomerado_multietapico",
  resultado: p1Result,
} as CalcMuestraComponente;
const p2 = {
  id: "component-p2",
  actor_id: "estudiantes_facultad",
  tecnica: "prob_estratificado_independiente",
  resultado: p2Result,
} as CalcMuestraComponente;
const estudio = { componentes: [p1, p2] } as CalcMuestraEstudio;
const workspace = {
  aulas_config: { criterios_seleccion: { byVariable: {} } },
  motor_recorrido: { decisiones: { escenario: "e1" } },
} as unknown as CalcMuestraWorkspace;
const aulasState = {
  frame: {
    frame_hash: CURRENT_FRAME_HASH,
    criterios_seleccion: { byVariable: {} },
  },
} as unknown as CalcMuestraAulasState;
const motor = {
  perfil: { nombre: "Universidad I19", esEjemplo: false },
  usaProyecto: true,
  marcaFuente: "Proyecto activo",
  tocado: false,
} as MotorEfectivo;

function renderSummary() {
  return renderToStaticMarkup(
    <ResumenDiseno motor={motor} estudio={estudio} workspace={workspace} aulasState={aulasState} />,
  );
}

function metric(html: string, label: string): string {
  const labelIndex = html.indexOf(`<small>${label}</small>`);
  const start = html.lastIndexOf('<div class="rec-resumen-item"', labelIndex);
  const end = html.indexOf("</div>", labelIndex);
  return start >= 0 && end >= 0 ? html.slice(start, end + 6) : "";
}

beforeEach(() => {
  normalizeDistribution.mockReset();
  motorStoreState.scenario = "e1";
});

describe("ResumenDiseno bajo contrato I19", () => {
  it("muestra el resultado normalizado ready del escenario compartido P2", () => {
    motorStoreState.scenario = "e2";
    normalizeDistribution.mockReturnValue({
      kind: "ready",
      data: { totals: { sample_n: 57 } },
    });

    const html = renderSummary();

    expect(normalizeDistribution).toHaveBeenCalledWith(p2Result, {
      component_id: "component-p2",
      actor_id: "estudiantes_facultad",
      scenario: "p2_facultades",
      technique: "prob_estratificado_independiente",
      current_frame_hash: CURRENT_FRAME_HASH,
    });
    expect(metric(html, "Muestra objetivo")).toContain("57");
    expect(metric(html, "Sobremuestra operativa")).toContain("66");
    expect(html).toContain('data-result-state="ready"');
  });

  it.each(["stale", "invalid"] as const)("oculta cifras crudas cuando I19 devuelve %s", (kind) => {
    normalizeDistribution.mockReturnValue(kind === "stale"
      ? {
          kind,
          data: { totals: { sample_n: 37 } },
          current_frame_hash: CURRENT_FRAME_HASH,
          reasons: ["frame anterior"],
        }
      : { kind, reasons: ["bundle inválido"] });

    const html = renderSummary();

    expect(metric(html, "Muestra objetivo")).toContain("—");
    expect(metric(html, "Sobremuestra operativa")).toContain("—");
    expect(metric(html, "Muestra objetivo")).not.toContain("37");
    expect(metric(html, "Sobremuestra operativa")).not.toContain("44");
    expect(html).toContain(`data-result-state="${kind}"`);
  });

  it("no interpola cifras metodológicas ni conserva CountUp en la superficie", () => {
    expect(source).toContain("normalizeCalcMuestraDistribucionI19");
    expect(source).not.toContain("CountUp");
  });
});

describe("el KPI de aulas dice de qué aulas habla", () => {
  it("se rotula como las que pide el cálculo, no «Aulas titulares» a secas", () => {
    // Medido en HSVG2026 el 2026-08-23: el resumen decía «AULAS TITULARES 190»
    // y el mapa del recorrido, en la MISMA pantalla, «CURSOS-HORARIO M1 193 ·
    // cursos-horario titulares sorteados».
    //
    // Los dos números son correctos y distintos a propósito: 190 es lo que el
    // reparto por facultad exige (`aulas_base`) y 193 lo que el sorteo produjo,
    // con los adicionales de las facultades que no llegaban a su cuota. La
    // diferencia ES información. Con el mismo rótulo se lee como una
    // contradicción y no como un dato.
    const fuente = readFileSync(
      new URL("../ResumenDiseno.tsx", import.meta.url),
      "utf8",
    );
    expect(fuente).toContain('label: "Aulas que pide el cálculo"');
    expect(fuente).not.toContain('label: "Aulas titulares"');
  });
});
