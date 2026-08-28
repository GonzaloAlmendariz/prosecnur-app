/**
 * La tira decía «AULAS QUE PIDE EL CÁLCULO · 174» y ese 174 es la suma de tres
 * decisiones que se veían como una sola cifra. Gonzalo, 2026-08-27: «el 165
 * cambiar a 174 tomando en cuenta el porqué de las aulas extra, separando las
 * de certeza de las extra operativas».
 *
 * Las cifras son las de HSVG 2026 medidas ese día recorriendo la app.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { ResumenDiseno } from "../ResumenDiseno";
import type { MotorEfectivo } from "../usePerfilEfectivo";

const normalizeDistribution = vi.hoisted(() => vi.fn());

vi.mock("../../../../api/calcMuestraDistribucionI19", () => ({
  normalizeCalcMuestraDistribucionI19: normalizeDistribution,
}));
vi.mock("../../store", () => ({
  useMotorStore: (selector: (state: unknown) => unknown) => selector({
    resetCanon: () => {},
    decisiones: { escenario: "e1", opcionalesActivos: [] },
  }),
}));

const FRAME_HASH = "frame-desglose";

/** [facultad, fórmula, certificada, base] — las quince de HSVG 2026. */
const HSVG2026: ReadonlyArray<readonly [string, number, number, number]> = [
  ["DERECHO", 16, 18, 19],
  ["ESTUDIOS GENERALES LETRAS", 18, 20, 20],
  ["CIENCIAS CONTABLES", 2, 3, 3],
  ["GESTIÓN Y ALTA DIRECCIÓN", 6, 7, 7],
  ["LETRAS Y CIENCIAS HUMANAS", 3, 4, 4],
  ["PSICOLOGÍA", 5, 6, 6],
  ["ARQUITECTURA Y URBANISMO", 8, 0, 8],
  ["ARTE Y DISEÑO", 15, 0, 15],
  ["ARTES ESCÉNICAS", 8, 0, 8],
  ["CIENCIAS E INGENIERIA", 37, 0, 37],
  ["CIENCIAS SOCIALES", 12, 0, 12],
  ["CIENCIAS Y ARTES DE LA COMUN.", 7, 0, 7],
  ["EDUCACION", 3, 0, 3],
  ["ESTUDIOS GENERALES CIENCIAS", 22, 0, 22],
  ["GASTRONOMÍA, HOTELERÍA Y TURISMO", 3, 0, 3],
];

function repartoDe(filas: ReadonlyArray<readonly [string, number, number, number]>) {
  return filas.map(([estrato, formula, certificada, base]) => ({
    estrato, N: 1000, cuota: 100, avg_conglomerado: 20, tau: 0.5,
    aulas_formula: formula,
    aulas_base_certificada: certificada,
    aulas_base: base,
    aulas_base_origen: base === formula ? "formula" : certificada === base ? "certificacion" : "operativa",
    aulas_reemplazo: 1, aulas_extra_operativas: 1, aulas_total: base + 1,
  }));
}

function montar(filas = repartoDe(HSVG2026)) {
  const componente = {
    id: "cmp-uni",
    actor_id: "estudiantes_universidad",
    tecnica: "prob_conglomerado_multietapico",
    resultado: { aulas_por_estrato: filas },
  } as unknown as CalcMuestraComponente;
  const estudio = { componentes: [componente] } as CalcMuestraEstudio;
  const workspace = {
    aulas_config: { criterios_seleccion: { byVariable: {} } },
    motor_recorrido: { decisiones: { escenario: "e1" } },
  } as unknown as CalcMuestraWorkspace;
  const aulasState = {
    frame: { frame_hash: FRAME_HASH, criterios_seleccion: { byVariable: {} } },
  } as unknown as CalcMuestraAulasState;
  const motor = {
    perfil: { nombre: "HSVG 2026", esEjemplo: false },
    usaProyecto: true, marcaFuente: "Proyecto activo", tocado: false,
  } as MotorEfectivo;
  return renderToStaticMarkup(
    <ResumenDiseno motor={motor} estudio={estudio} workspace={workspace} aulasState={aulasState} />,
  );
}

/** El bloque del KPI de aulas, sin el resto de la franja. */
function kpiDeAulas(html: string): string {
  const i = html.indexOf("<small>Aulas que pide el cálculo</small>");
  const ini = html.lastIndexOf('<div class="rec-resumen-item"', i);
  const fin = html.indexOf("</div>", i);
  return ini >= 0 && fin >= 0 ? html.slice(ini, fin + 6) : "";
}

/**
 * El texto plano del desglose. Los espacios alrededor del signo los pone el
 * `gap` del CSS, no el marcado, así que el markup los trae pegados
 * («165 fórmula+8 certeza») y aquí se separan para poder afirmar sobre la
 * frase que el usuario lee.
 */
function textoDelDesglose(html: string): string {
  const bloque = kpiDeAulas(html);
  const m = bloque.match(/<span class="rec-resumen-desglose">([\s\S]*?)<\/span><span>/);
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/([+−])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(() => {
  normalizeDistribution.mockReset();
  normalizeDistribution.mockReturnValue({ kind: "ready", data: { totals: { sample_n: 2500 } } });
});

describe("la tira dice de qué está hecho el número de aulas", () => {
  it("muestra 174 y debajo 165 fórmula + 8 certeza + 1 operativa", () => {
    const html = montar();
    const kpi = kpiDeAulas(html);
    expect(kpi).toContain("174");
    expect(textoDelDesglose(html)).toBe("165 fórmula + 8 certeza + 1 operativa");
  });

  it("con todo por fórmula no repite el número de arriba", () => {
    // «165 fórmula» debajo de «165» no dice nada y ocupa una línea.
    const html = montar(repartoDe(HSVG2026.map(([e, f]) => [e, f, 0, f] as const)));
    expect(kpiDeAulas(html)).toContain("165");
    expect(textoDelDesglose(html)).toBe("");
  });

  it("lo que se apartó sin declarar se nombra en vez de repartirse", () => {
    // Las quince fijaciones del componente de Facultades vienen así: apartadas
    // de la fórmula, sin nivel certificado y con el origen en blanco.
    const html = montar(
      repartoDe(HSVG2026.map(([e, f, , b]) => [e, f, 0, b] as const))
        .map((fila) => ({ ...fila, aulas_base_origen: "" })),
    );
    const texto = textoDelDesglose(html);
    expect(texto).toBe("165 fórmula + 9 sin declarar");
    expect(texto).not.toContain("certeza");
    expect(texto).not.toContain("operativa");
  });

  it("una base por debajo de la fórmula se resta, no se suma", () => {
    const html = montar(repartoDe([["DERECHO", 16, 0, 14]]));
    expect(textoDelDesglose(html)).toBe("16 fórmula − 2 por debajo");
  });
});
