// «Sin corrida importada» valía igual para dos estados opuestos: un proyecto sin
// sorteo y un proyecto con 686 aulas sorteadas que nadie ha traído.
//
// Es el caso más común al abrir un proyecto recién sorteado, y el que hace
// preguntar «¿por qué Monitoreo no puede consumir el plan del cálculo?». Puede:
// hay que pulsar «Importar plan», y el hueco no decía que hubiera algo que
// importar ni cuánto.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasConfig, MonitoreoSource } from "../../../../api/monitoreo";
import { AulasOperationsPanel } from "./AulasOperationsPanel";

const render = (
  config: Partial<MonitoreoAulasConfig> | null,
  origen: Parameters<typeof AulasOperationsPanel>[0]["origen"],
) =>
  renderToStaticMarkup(
    <AulasOperationsPanel
      config={config as MonitoreoAulasConfig | null}
      sources={[] as MonitoreoSource[]}
      busy={false}
      origen={origen}
      onImportPlan={() => {}}
      onSyncField={() => {}}
      onGenerarLibro={() => {}}
      onImportarLibro={() => {}}
    />,
  );

describe("el hueco de Selección distingue por qué está vacío", () => {
  it("con sorteo y sin plan dice cuántas esperan", () => {
    const html = render(
      { enabled: true, plan_rows: 0 },
      { selection_run_id: "sel_aulas_20260821160928_bf10d14c", unidades_disponibles: 686 },
    );
    expect(html).toContain("686 cursos-horario sorteados sin traer");
    expect(html).not.toContain("todavía no sorteó");
  });

  it("sin sorteo lo dice, en vez de sonar igual", () => {
    const html = render({ enabled: true, plan_rows: 0 }, null);
    expect(html).toContain("todavía no sorteó aulas");
    expect(html).not.toContain("sin traer");
  });

  it("con plan ya importado no anuncia nada que traer", () => {
    // Ahí lo que importa es de qué corrida viene, no cuántas había.
    const html = render(
      { enabled: true, plan_rows: 686, selection_run_id: "sel_aulas_20260821160928_bf10d14c" },
      { selection_run_id: "sel_aulas_20260821160928_bf10d14c", unidades_disponibles: 686 },
    );
    expect(html).not.toContain("sin traer");
  });

  it("un plan llegado por libro conserva su explicación", () => {
    // No tiene corrida de cálculo y eso no es un defecto: llegó por el otro
    // camino. Ese texto ya existía y no debe pisarse.
    const html = render({ enabled: true, plan_rows: 196 }, null);
    expect(html).toContain("196 del libro");
  });
});
