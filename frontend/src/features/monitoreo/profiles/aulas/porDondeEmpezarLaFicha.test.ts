import { describe, expect, it } from "vitest";

import { porDondeEmpezarLaFicha } from "./porDondeEmpezarLaFicha";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (p: Record<string, unknown>) => p as unknown as MonitoreoAulasPlanRow;

describe("por dónde empezar cuando no hay código tecleado", () => {
  it("ofrece los partes que el motor marcó como no cuadrados", () => {
    const a = porDondeEmpezarLaFicha([], [
      { operational_code: "CH 3", cuadra: false },
      { operational_code: "CH 7", cuadra: true },
      { operational_code: "CH 9", cuadra: false },
    ]);
    expect(a.find((x) => x.clave === "no-cuadran")?.codigos).toEqual(["CH 3", "CH 9"]);
  });

  it("un parte SIN identidad que comprobar no es un descuadre", () => {
    // `cuadra: null` lo pone el motor cuando no hay asistentes ni efectivas.
    // Contarlo mandaría a revisar lo que no tiene nada que revisar.
    const a = porDondeEmpezarLaFicha([], [{ operational_code: "CH 5", cuadra: null }]);
    expect(a.find((x) => x.clave === "no-cuadran")).toBeUndefined();
  });

  it("ofrece los refuerzos pedidos, incluidos los que volvieron del libro sin sello", () => {
    const a = porDondeEmpezarLaFicha([
      fila({ operational_code: "EXTRA 10", sample_status: "refuerzo_por_contactar", activation_origin: "" }),
      fila({ operational_code: "CH 1", sample_status: "agendada", activation_origin: "" }),
    ], []);
    expect(a.find((x) => x.clave === "refuerzos")?.codigos).toEqual(["EXTRA 10"]);
  });

  it("no repite un código que aparece dos veces", () => {
    const a = porDondeEmpezarLaFicha([], [
      { operational_code: "CH 3", cuadra: false },
      { operational_code: "CH 3", cuadra: false },
    ]);
    expect(a[0]?.codigos).toEqual(["CH 3"]);
  });

  it("sin nada que ofrecer no inventa un atajo vacío", () => {
    expect(porDondeEmpezarLaFicha([], [])).toEqual([]);
    expect(porDondeEmpezarLaFicha(null, null)).toEqual([]);
  });

  it("NO recorta las listas: lo que hay, se da entero", () => {
    // Sistema Pabellón: listas completas sin techos, jamás «…y N más».
    const partes = Array.from({ length: 40 }, (_, i) => ({ operational_code: `CH ${i}`, cuadra: false }));
    expect(porDondeEmpezarLaFicha([], partes)[0]?.codigos).toHaveLength(40);
  });
});
