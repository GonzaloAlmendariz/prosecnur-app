import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * El apilado de estados va DEBAJO del ritmo diario, no a su lado.
 *
 * Antes ese hueco lo ocupaba `AcreditacionPhoneDailyStatusBars`, una rejilla de
 * mini-barras por estado metida en la misma fila que el gráfico de Plotly: no
 * era un apilado —no se podía leer la composición de un día— y compartir fila
 * estrechaba a los dos.
 */
const page = readFileSync(
  resolve(__dirname, "..", "AcreditacionMonitoreoPage.tsx"),
  "utf8",
);

describe("Ritmo diario: el apilado de estados cuelga debajo del gráfico", () => {
  it("monta el gráfico apilado, no la rejilla de mini-barras", () => {
    expect(page).toContain("<GraficoDeEstadosPorDia");
    // La rejilla ya no se usa dentro del ritmo diario.
    expect(page).not.toContain("<AcreditacionPhoneDailyStatusBars");
  });

  it("queda fuera del contenedor en paralelo, que ahora es de una sola columna", () => {
    const paralelo = page.match(/<div className="mon-phone-trend-parallel[^]*?<\/div>\n      <\/div>/)?.[0] ?? "";
    expect(paralelo).not.toBe("");
    expect(paralelo).not.toContain("GraficoDeEstadosPorDia");
    expect(page).toContain('className="mon-phone-trend-parallel is-single"');
  });

  it("recibe los colores que el usuario declaró en el definidor de estados", () => {
    // Si el gráfico usara su propia paleta, discreparía de la tabla de Estados.
    expect(page).toContain("acreditacionDeclaracionesDesdeReglas(stateRules)");
    expect(page).toMatch(/<GraficoDeEstadosPorDia\s+series=\{statusSeries\}\s+declaraciones=\{declaraciones\}/);
  });

  it("las reglas llegan desde el modelo operativo, que es donde se persisten", () => {
    expect(page).toContain("options.state?.config?.operational_model?.state_rules ?? []");
  });
});

describe("El motor publica la serie que alimenta el apilado", () => {
  const engine = readFileSync(
    resolve(__dirname, "../../../../../../..", "api/R/monitoreo_telefonico.R"),
    "utf8",
  );

  it("estatus_dia deja de estar detrás del guard de telefónico puro", () => {
    // Estaba dentro de `if (isTRUE(standalone_phone))`, así que una acreditación
    // con barrido no recibía la serie aunque el motor ya la calculaba.
    const guardado = engine.match(
      /if \(isTRUE\(standalone_phone\)\) \{\s*blocks <- c\(blocks, list\(\.monitoreo_report_block\("estatus_dia"/,
    );
    expect(guardado).toBeNull();
    expect(engine).toContain('.monitoreo_report_block("estatus_dia", "Estados telefónicos por día", status_day)');
  });
});
