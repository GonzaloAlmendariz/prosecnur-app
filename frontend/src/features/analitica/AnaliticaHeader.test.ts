import { describe, expect, test } from "vitest";
import { analiticaFuenteGuidance } from "./AnaliticaHeader";

describe("AnaliticaHeader source guidance", () => {
  test("describes Original and Codificada without recommending either source", () => {
    const messages = [
      analiticaFuenteGuidance({
        prepBusy: false,
        prepError: "",
        codificadaDisponible: false,
        usandoAdaptados: false,
      }),
      analiticaFuenteGuidance({
        prepBusy: false,
        prepError: "",
        codificadaDisponible: true,
        usandoAdaptados: false,
      }),
      analiticaFuenteGuidance({
        prepBusy: false,
        prepError: "",
        codificadaDisponible: true,
        usandoAdaptados: true,
      }),
    ];

    expect(messages[0]).toContain("base cargada");
    expect(messages[1]).toContain("sin recodificaciones");
    expect(messages[2]).toContain("recodificaciones");
    expect(messages.join(" ")).not.toMatch(/XLSForm|Fase 1|Fase 3|Data:/i);
    expect(messages.join(" ")).not.toMatch(/recomendad|suele ser|opci[oó]n recomendada/i);
  });
});
