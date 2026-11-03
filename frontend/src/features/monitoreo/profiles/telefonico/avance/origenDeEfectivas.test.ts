import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { origenDeEfectivas, sufijoDeOrigen } from "./origenDeEfectivas";
import { entradaDeCuotasFaltante } from "./entradaDeCuotas";
import { indicadoresDelModo, insigniasDelModo, resumenDelModo } from "../navegacion/barraTelefonica";

function reportes(filas: Array<Record<string, unknown>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: [{ id: "cuotas_variable", title: "Cuotas", columns: [], rows: filas }] }],
  } as unknown as MonitoreoAcreditacionReports;
}

const deLaHoja = [
  { Actor: "Total", Variable: "Actor", Valor: "Homologación", Universo: 156, Meta: 80, Efectivas: 58, Origen: "hoja" },
  { Actor: "Total", Variable: "Actor", Valor: "Vinculación", Universo: 27, Meta: 20, Efectivas: 14, Origen: "hoja" },
];

describe("el origen de las efectivas se escribe en Cuotas y en la barra, como en Ritmo (reparo 1)", () => {
  it("lee `Origen` de las filas de cuota", () => {
    expect(origenDeEfectivas(deLaHoja)).toBe("hoja");
    expect(origenDeEfectivas([{ Origen: "kobo" }])).toBe("kobo");
    expect(origenDeEfectivas([{ Origen: "kobo" }, { Origen: "hoja" }])).toBe("mixto");
    expect(origenDeEfectivas([{}])).toBe("kobo");
    expect(sufijoDeOrigen("kobo")).toBe("");
  });

  it("Avance › Cuotas recibe el origen y la barra lo dice en su lectura", () => {
    expect(entradaDeCuotasFaltante(reportes(deLaHoja), null, []).modelo.origen).toBe("hoja");
    const resumen = resumenDelModo({
      cuotas: [{ actor: "Homologación", meta: 80, missing: 22, effective: 58 }, { actor: "Vinculación", meta: 20, missing: 6, effective: 14 }],
      variables: deLaHoja.map((fila) => ({ variable: fila.Variable, meta: fila.Meta })),
      porRevisar: null,
      origen: "hoja",
    });
    expect(insigniasDelModo(resumen).avance).toMatchObject({ lectura: "72 efectivas de la hoja de una meta de 100" });
    expect(indicadoresDelModo(resumen)[1]).toMatchObject({ detalle: "72 efectivas de la hoja de una meta de 100" });
  });
});
