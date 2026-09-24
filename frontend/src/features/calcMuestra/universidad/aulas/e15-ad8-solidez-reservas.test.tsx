import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AulasReemplazosTab } from "./AulasReemplazosTab";
import type { ClassroomLabModel } from "./aulasParts";
import {
  ROTULO_REEMPLAZOS_EN_CADENA,
  ROTULO_RESERVAS_TOTALES,
  detalleReemplazosEnCadena,
  detalleReservasTotales,
} from "./rotulosReservas";

describe("AD8a · C3 en Solidez: la última tarjeta de un acto no deja hueco al pie", () => {
  it("el acto anula el margen inferior de su último hijo", () => {
    const css = readFileSync(join(__dirname, "aulas.css"), "utf8");
    expect(css).toMatch(/\.cmv2-solidez-acto > :last-child\s*\{\s*margin-bottom:\s*0;/);
  });
});

describe("AD8b · reemplazos en cadena y reservas totales se distinguen", () => {
  it("los rótulos no se leen como la misma cifra", () => {
    expect(ROTULO_REEMPLAZOS_EN_CADENA).not.toBe(ROTULO_RESERVAS_TOTALES);
    expect(detalleReemplazosEnCadena(481)).toContain("sin los 481 de bolsa extra");
    expect(detalleReservasTotales(1894, 481)).toBe("1,894 en cadena + 481 de bolsa extra");
    expect(detalleReservasTotales(1894, 0)).not.toContain("bolsa extra");
  });

  it("Selección y Cierre usan esos rótulos", () => {
    const seleccion = readFileSync(join(__dirname, "AulasSeleccionTab.tsx"), "utf8");
    const cierre = readFileSync(join(__dirname, "../salidas/SalidasCierreTab.tsx"), "utf8");
    expect(seleccion).toContain("label={ROTULO_REEMPLAZOS_EN_CADENA}");
    expect(seleccion).not.toMatch(/label="Reemplazos"/);
    expect(cierre).toContain("label: ROTULO_RESERVAS_TOTALES");
    expect(cierre).not.toMatch(/label: "Reservas"/);
  });
});

describe("AD8c · «Probar reemplazos» vive en su bloque, sin tarjeta propia", () => {
  const model = {
    selection: {}, selectionReady: true, selectionRows: [],
    replacementSimulation: { replacements: [] }, replacementReady: true,
    reserveDepthRows: [], waveRows: [], replacementRows: [], impactRows: [], handoffRows: [],
    m1Rows: [], reserveRows: [], extraReserveRows: [],
    config: {}, staleJobAviso: null,
  } as unknown as ClassroomLabModel;

  it("no pinta la barra de comandos y el botón cae en «Efecto esperado de los reemplazos»", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AulasReemplazosTab model={model} busy={null} onSimulateReplacements={() => {}} referencia={null} />
      </MemoryRouter>,
    );
    expect(html).not.toContain("cmv2-classroom-commandbar");
    const iBloque = html.indexOf("Efecto esperado de los reemplazos");
    const iBoton = html.indexOf("Probar reemplazos");
    expect(iBloque).toBeGreaterThanOrEqual(0);
    expect(iBoton).toBeGreaterThan(iBloque);
    expect(html.match(/Probar reemplazos/g)).toHaveLength(1);
  });
});
