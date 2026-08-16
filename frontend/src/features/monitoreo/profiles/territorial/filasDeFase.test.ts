import { describe, expect, it } from "vitest";

import { describirFilasDeFase } from "./filasDeFase";

// Los números salen de acnur_acg, medidos sobre el payload real de
// `/api/monitoreo/state`: Campo tiene 1 697 locales y 1 693 en el reporte, y
// las cuatro que faltan son del 4 de junio, anteriores al inicio declarado de
// Campo (2026-06-12 10:00Z).

function item(over: Record<string, unknown> = {}) {
  return { phase: "field", label: "Campo", status: "source_synced_with_rows", local_rows: 1697, report_rows: 1693, ...over } as never;
}

describe("describirFilasDeFase", () => {
  it("dice los dos conteos y cuántas quedaron fuera", () => {
    const f = describirFilasDeFase(item(), "Campo")!;
    expect(f.texto).toBe(
      "Campo tiene 1,697 respuestas locales y el reporte usa 1,693: 4 respuestas quedaron fuera del corte de la fase.",
    );
    expect(f.badge).toBe("1,693 de 1,697");
    expect(f.fuera).toBe(4);
  });

  it("calla cuando los dos conteos coinciden", () => {
    // El control: es el caso normal. Un «1 697 de 1 697» en cada fase sería
    // ruido permanente en la consola.
    expect(describirFilasDeFase(item({ report_rows: 1697 }), "Campo")).toBeNull();
  });

  it("calla cuando el motor no manda `report_rows`", () => {
    // Un .pulso abierto contra una versión anterior. Sin el dato no se puede
    // afirmar que haya diferencia, y suponer que es cero sería inventar.
    expect(describirFilasDeFase(item({ report_rows: undefined }), "Campo")).toBeNull();
    expect(describirFilasDeFase(item({ report_rows: null }), "Campo")).toBeNull();
  });

  it("no narra un payload incoherente", () => {
    // Más filas en el reporte que en el snapshot no se explica por el corte de
    // la fase. Decir «-4 quedaron fuera» sería peor que callar.
    expect(describirFilasDeFase(item({ report_rows: 1700 }), "Campo")).toBeNull();
    expect(describirFilasDeFase(item({ local_rows: "NA" }), "Campo")).toBeNull();
  });

  it("concuerda el singular", () => {
    const f = describirFilasDeFase(item({ local_rows: 100, report_rows: 99 }), "Piloto")!;
    expect(f.texto).toContain("1 respuesta quedó fuera del corte de la fase");
    expect(f.texto).not.toContain("1 respuestas");
  });

  it("usa la etiqueta de la fase que recibe", () => {
    expect(describirFilasDeFase(item({ phase: "pilot" }), "Piloto")!.texto.startsWith("Piloto")).toBe(true);
  });
});
