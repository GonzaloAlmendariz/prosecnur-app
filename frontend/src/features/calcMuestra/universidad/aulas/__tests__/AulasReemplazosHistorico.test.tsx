/**
 * «¿Alcanzan las reservas?» se responde comparando, no con una regla de dedo.
 *
 * La cabecera de reemplazos mostraba «Reservas por titular: 11,0» y un semáforo
 * con umbrales de la casa (menos de 1 alerta, 2 o más holgado) sin ningún punto
 * de comparación medido. El estudio previo tiene el único que existe: cuántas
 * aulas hubo que agendar por cada una que se llegó a aplicar. En HSVBG 2025
 * fueron 1.012 agendadas para 194 aplicadas, o sea 5,2.
 *
 * El histórico se CITA, no se convierte en umbral: es lo que costó un estudio,
 * no una norma. Quien decide compara.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CalcMuestraReferenciaAsistencia } from "../../../../../api/client";
import { AulasReemplazosTab } from "../AulasReemplazosTab";
import type { ClassroomLabModel } from "../aulasParts";

const model = {
  selection: {}, selectionReady: true, selectionRows: [],
  replacementSimulation: null, replacementReady: false,
  reserveDepthRows: [
    { stratum: "DERECHO / F / G2", titulares: 2, reservas: 22, depth_ratio: 11 },
    { stratum: "PSICOLOGÍA / F / G2", titulares: 1, reservas: 11, depth_ratio: 11 },
  ],
  waveRows: [], replacementRows: [], impactRows: [], handoffRows: [],
  m1Rows: [], reserveRows: [], extraReserveRows: [],
  config: {},
} as unknown as ClassroomLabModel;

function referencia(agendados: number, aplicados: number): CalcMuestraReferenciaAsistencia {
  return {
    estudio: { id: "src", label: "HSVBG2025_referencia_para_motor.xlsx", periodo: "", fuente: "referencia" },
    cobertura: { agendados, aplicados, observados: aplicados },
    dimensiones: [], advertencias: [],
  } as unknown as CalcMuestraReferenciaAsistencia;
}

function conObjetivo(target: number): ClassroomLabModel {
  return { ...model, config: { objective: { reserve_depth_target: target } } } as unknown as ClassroomLabModel;
}

function pintarModelo(m: ClassroomLabModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AulasReemplazosTab model={m} busy={null} onSimulateReplacements={() => {}} referencia={null} />
    </MemoryRouter>,
  );
}

function pintar(ref: CalcMuestraReferenciaAsistencia | null): string {
  // La pestaña cuelga enlaces de navegación, así que necesita un router.
  return renderToStaticMarkup(
    <MemoryRouter>
      <AulasReemplazosTab model={model} busy={null} onSimulateReplacements={() => {}} referencia={ref} />
    </MemoryRouter>,
  );
}

describe("cadena de reemplazos contra el estudio previo", () => {
  it("cita cuántas se agendaron por aula aplicada, y de qué estudio", () => {
    const html = pintar(referencia(1012, 194));
    expect(html).toContain("33 reservas para 3 titulares");
    expect(html).toContain("se agendaron 5.2 por cada aula aplicada");
    // Nombrar la fuente es lo que impide leer el 5,2 como una norma.
    expect(html).toContain("HSVBG2025_referencia_para_motor.xlsx");
  });

  it("sin estudio previo la cifra queda sola, sin inventar comparación", () => {
    const html = pintar(null);
    expect(html).toContain("33 reservas para 3 titulares");
    expect(html).not.toContain("por cada aula aplicada");
  });

  it("con una referencia que se contradice no se cita nada", () => {
    // Más aplicadas que agendadas daría un rendimiento menor que 1, que se
    // leería como que en 2025 sobraban aulas.
    expect(pintar(referencia(100, 194))).not.toContain("por cada aula aplicada");
  });
});

describe("semáforo de profundidad contra el objetivo declarado", () => {
  it("con 11 reservas por titular y objetivo de fábrica dice holgado", () => {
    const html = pintarModelo(conObjetivo(1));
    expect(html).toContain("todas las celdas con colchón holgado");
    // El objetivo de fábrica no se nombra: sería ruido en el caso normal.
    expect(html).not.toContain("objetivo declarado");
  });

  it("con un objetivo más exigente el mismo plan deja de ser holgado", () => {
    // 11 reservas por titular con objetivo 20: el motor ya avisaba
    // "Profundidad de reservas menor al objetivo" y la pantalla decia holgado.
    const html = pintarModelo(conObjetivo(20));
    expect(html).toContain("hay celdas por debajo del objetivo");
    expect(html).not.toContain("colchón holgado");
    // Y nombra contra qué se está midiendo, que es lo que hace legible el tono.
    expect(html).toContain("objetivo declarado");
  });
});
