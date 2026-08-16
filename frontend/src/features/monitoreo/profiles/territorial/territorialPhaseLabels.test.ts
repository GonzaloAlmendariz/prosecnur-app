import { describe, expect, it } from "vitest";

import {
  territorialPhaseBadgeLabel,
  territorialPhaseStatusLabel,
} from "./TerritorialSourceConsole";

// El módulo puro ya prueba el cálculo; esto prueba la costura, que es donde
// estaba el riesgo real: la consola devolvía `item.message` —el que arma el
// motor, que cuenta `local_rows`— antes de mirar nada más. Si esa precedencia
// vuelve, la frase con los dos conteos deja de verse y ningún test del módulo
// se entera.

function item(over: Record<string, unknown> = {}) {
  return {
    phase: "field",
    label: "Campo",
    status: "source_synced_with_rows",
    message: "Campo tiene 1,697 respuestas locales sincronizadas.",
    local_rows: 1697,
    report_rows: 1693,
    ...over,
  } as never;
}

describe("etiquetas de fase de la consola territorial", () => {
  it("la diferencia gana sobre el mensaje del motor", () => {
    const texto = territorialPhaseStatusLabel(item(), "field");
    expect(texto).toContain("el reporte usa 1,693");
    expect(texto).not.toBe("Campo tiene 1,697 respuestas locales sincronizadas.");
  });

  it("el badge dice las dos cifras", () => {
    expect(territorialPhaseBadgeLabel(item())).toBe("1,693 de 1,697");
  });

  it("sin diferencia se respeta el mensaje del motor tal cual", () => {
    // El control: el caso normal no cambia. Reescribir siempre la frase
    // desactivaría los otros seis estados que el motor sabe narrar mejor.
    const sinDif = item({ report_rows: 1697 });
    expect(territorialPhaseStatusLabel(sinDif, "field")).toBe(
      "Campo tiene 1,697 respuestas locales sincronizadas.",
    );
    expect(territorialPhaseBadgeLabel(sinDif)).toBe("1,697 locales");
  });

  it("los estados que no son de conteo siguen intactos", () => {
    const err = item({ status: "sync_error", message: "", report_rows: null });
    expect(territorialPhaseBadgeLabel(err)).not.toContain("de");
    expect(territorialPhaseStatusLabel(err, "field")).toContain("error");
  });
});
