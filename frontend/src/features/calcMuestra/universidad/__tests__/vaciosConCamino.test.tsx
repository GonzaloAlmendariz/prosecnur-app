/**
 * Revamp 2026-09-27: cuatro pestañas de aulas mostraban su vacío como una línea
 * suelta (¿Alcanza?, Solidez), un chip (Histórico) o un aviso (Alumnos por CH)
 * sobre un panel de 600–700 px en blanco a 1710x1107. Ahora usan el EmptyState
 * de la casa con el botón al paso que falta, como Perfil.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasSolidezTab } from "../aulas/AulasSolidezTab";
import { DefHistoricoTab } from "../definicion/DefHistoricoTab";

const nav = () => undefined;

describe("vacíos con camino", () => {
  it("Histórico sin estudio anterior lleva a Fuentes", () => {
    const html = renderToStaticMarkup(<DefHistoricoTab aulasState={null} referencia={null} onNavigate={nav} />);
    expect(html).toContain("pulso-empty-state");
    expect(html).toContain("Todavía no hay un estudio anterior cargado");
    expect(html).toContain("Ir a Fuentes");
  });

  it("sin onNavigate el vacío se explica igual, sin botón", () => {
    const html = renderToStaticMarkup(<DefHistoricoTab aulasState={null} referencia={null} />);
    expect(html).toContain("pulso-empty-state");
    expect(html).not.toContain("Ir a Fuentes");
  });

  it("Solidez sin selección lleva a Cursos-horario titulares", () => {
    const model = {
      config: {}, selection: null, selectionRows: [], coverageRows: [], visibleProfiles: [], m1Rows: [],
      facultades: [], targetForDisplay: 0, framePopulationCount: 0, selectionReady: false,
    } as unknown as Parameters<typeof AulasSolidezTab>[0]["model"];
    const html = renderToStaticMarkup(
      <AulasSolidezTab
        workspace={{ aulas_config: {} } as unknown as Parameters<typeof AulasSolidezTab>[0]["workspace"]}
        model={model}
        onNavigate={nav}
      />,
    );
    expect(html).toContain("Todavía no hay una selección corrida");
    expect(html).toContain("Ir a Cursos-horario titulares");
  });
});
