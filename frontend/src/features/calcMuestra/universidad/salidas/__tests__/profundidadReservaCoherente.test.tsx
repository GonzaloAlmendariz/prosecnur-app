/**
 * Las tres superficies que pintan la profundidad de reserva usan el MISMO
 * objetivo declarado.
 *
 * La misma cifra —`depth_ratio`, reservas por titular en una celda— se pintaba
 * en Reemplazos, en Salidas > Monitoreo y en Salidas > Cierre, cada una con sus
 * propios números escritos a mano. Cierre era la más laxa: cualquier valor
 * desde 1 salía verde, sin estado intermedio, así que un plan que en Reemplazos
 * se veía neutro en Cierre se declaraba correcto.
 *
 * Y ninguna leía `reserve_depth_target`, que el motor sí respeta.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SalidasMonitoreoTab } from "../SalidasMonitoreoTab";
import type { ClassroomLabModel } from "../../aulas/aulasParts";

function modelo(target: number): ClassroomLabModel {
  return {
    selection: {}, selectionReady: true, selectionRows: [],
    replacementSimulation: {}, replacementReady: true,
    m1Rows: [], reserveRows: [], extraReserveRows: [],
    waveRows: [], replacementRows: [], impactRows: [], handoffRows: [],
    reserveDepthRows: [
      { stratum: "DERECHO / F / G2", titulares: 1, reservas: 3, depth_ratio: 3 },
    ],
    config: { objective: { reserve_depth_target: target } },
  } as unknown as ClassroomLabModel;
}

function pintar(target: number): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SalidasMonitoreoTab model={modelo(target)} />
    </MemoryRouter>,
  );
}

describe("profundidad de reserva en Salidas > Monitoreo", () => {
  it("con objetivo de fábrica, 3 reservas por titular es holgura", () => {
    expect(pintar(1)).toContain('data-tono="ok"');
  });

  it("con un objetivo de 4, las mismas 3 reservas son alerta", () => {
    // El motor ya avisaba «Profundidad de reservas menor al objetivo»; la celda
    // seguía pintándose verde porque 3 >= 2.
    const html = pintar(4);
    expect(html).toContain('data-tono="alerta"');
    expect(html).not.toContain('data-tono="ok"');
  });

  it("entre el objetivo y su doble no se afirma ni bien ni mal", () => {
    // 3 con objetivo 2: alcanza pero sin colchón. Pintarlo verde diría que
    // sobra margen, y rojo que falta; el estado intermedio es el honesto.
    const html = pintar(2);
    expect(html).not.toContain('data-tono="ok"');
    expect(html).not.toContain('data-tono="alerta"');
  });
});
