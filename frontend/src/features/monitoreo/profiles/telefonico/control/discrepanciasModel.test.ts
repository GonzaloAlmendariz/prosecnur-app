import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoProfile } from "../../../../../api/client";
import {
  SIN_RESPONSABLE,
  casosDeDiscrepancia,
  csvParaElEquipo,
  porResponsable,
  resumenDeDiscrepancias,
  textoParaElEquipo,
} from "./discrepanciasModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const CORTE = reportes({
  discrepancias_telefonicas: [
    { Sentido: "kobo_sin_hoja", CodPulso: "PDM1001", proGres: "XYZ-26-900001", Responsable: "Op-01", "La hoja dice": "No contesta", "Fecha hoja": "01/07/2026", "Fecha Kobo": "2026-07-02" },
    { Sentido: "kobo_sin_hoja", CodPulso: "PDM1002", proGres: "", Responsable: "Op-01", "La hoja dice": "No barrido", "Fecha hoja": "", "Fecha Kobo": "2026-07-02" },
    { Sentido: "kobo_sin_hoja", CodPulso: "PDM1003", proGres: "", Responsable: "Sin responsable", "La hoja dice": "No barrido", "Fecha hoja": "", "Fecha Kobo": "2026-07-03" },
    { Sentido: "hoja_sin_kobo", CodPulso: "PDM1114", proGres: "", Responsable: "Op-02", "La hoja dice": "Efectivo", "Fecha hoja": "02/07/2026", "Fecha Kobo": "" },
  ],
  control_tiempo_kobo: [
    { CodPulso: "PDM1001", "Response ID": "u1", "Responsable plataforma": "Operador 1", "Fecha Kobo": "2026-07-02" },
    { CodPulso: "PDM1002", "Response ID": "u2", "Responsable plataforma": "Op-01", "Fecha Kobo": "2026-07-02" },
    { CodPulso: "PDM1003", "Response ID": "u3", "Responsable plataforma": "Op-03", "Fecha Kobo": "2026-07-03" },
  ],
});

const decision = (response_id: string, action: string, declared_code: string) => ({
  response_id, action, declared_code, match_type: "telefonico_discrepancia", note: "nota", decided_at: "2026-10-23T10:00:00Z",
});

describe("Control › Discrepancias", () => {
  it("en los dos sentidos, con responsable, proGres, envío y P1 «cuenta mientras tanto»", () => {
    const casos = casosDeDiscrepancia(CORTE, null);
    expect(casos).toHaveLength(4);
    const primero = casos.find((caso) => caso.codigo === "PDM1001");
    expect(primero).toMatchObject({ sentido: "kobo_sin_hoja", progres: "XYZ-26-900001", responseId: "u1", decision: "pendiente" });
    expect(casos.find((caso) => caso.codigo === "PDM1003")?.responsable).toBe(SIN_RESPONSABLE);
    expect(casos.find((caso) => caso.codigo === "PDM1114")?.sentido).toBe("hoja_sin_kobo");
    expect(resumenDeDiscrepancias(casos)).toEqual({ koboSinHoja: 3, hojaSinKobo: 1, pendientes: 3, decididos: 0 });
  });

  it("P4: el enumerador distinto se marca salvo que la equivalencia esté confirmada", () => {
    expect(casosDeDiscrepancia(CORTE, null).find((caso) => caso.codigo === "PDM1001")?.enumeradorDistinto).toBe(true);
    const perfil = { enumerator_equivalences: [{ kobo: "Operador 1", hoja: "Op-01" }] } as unknown as MonitoreoProfile;
    expect(casosDeDiscrepancia(CORTE, perfil).find((caso) => caso.codigo === "PDM1001")?.enumeradorDistinto).toBe(false);
    // Mismo nombre con otra puntuación no es otra persona.
    expect(casosDeDiscrepancia(CORTE, null).find((caso) => caso.codigo === "PDM1002")?.enumeradorDistinto).toBe(false);
  });

  it("la decisión publicada por el motor manda; sin esa columna, se lee la del perfil por envío", () => {
    const publicada = reportes({
      discrepancias_telefonicas: [
        { Sentido: "kobo_sin_hoja", CodPulso: "PDM1001", proGres: "", Responsable: "Op-01", "La hoja dice": "No contesta",
          "Enumerador Kobo": "Op-01", "Response ID": "u1", "Mismo responsable": "Sí", "Decisión": "no_cuenta",
          Nota: "Dice que no respondió", "Decidido el": "2026-10-23T10:00:00Z", Destino: "decision" },
        { Sentido: "hoja_sin_kobo", CodPulso: "PDM1114", proGres: "", Responsable: "Op-02", "La hoja dice": "Efectivo",
          "Enumerador Kobo": "", "Response ID": "", "Mismo responsable": "", "Decisión": "", Destino: "avisos" },
      ],
    });
    const casos = casosDeDiscrepancia(publicada, null);
    expect(casos[0]).toMatchObject({ responseId: "u1", enumerador: "Op-01", enumeradorDistinto: false, decision: "no_cuenta", nota: "Dice que no respondió" });
    expect(casos[1]).toMatchObject({ sentido: "hoja_sin_kobo", decision: "pendiente" });
    // Una «No cuenta» sigue en la lista y cuenta como decidida.
    expect(resumenDeDiscrepancias(casos)).toEqual({ koboSinHoja: 1, hojaSinKobo: 1, pendientes: 0, decididos: 1 });

    const perfil = { reconciliation_decisions: { manual_case_reconciliations: {
      u2: decision("u2", "include_with_caveat", "PDM1002"),
    } } } as unknown as MonitoreoProfile;
    expect(casosDeDiscrepancia(CORTE, perfil).find((caso) => caso.codigo === "PDM1002")?.decision).toBe("cuenta");
  });

  it("para avisar al equipo: por responsable, «Sin asignar» al final, en texto y en CSV", () => {
    const grupos = porResponsable(casosDeDiscrepancia(CORTE, null));
    expect(grupos.map((grupo) => [grupo.responsable, grupo.casos.length])).toEqual([["Op-01", 2], ["Op-02", 1], [SIN_RESPONSABLE, 1]]);
    const texto = textoParaElEquipo(grupos);
    expect(texto).toContain("Op-01 (2)\n- PDM1001 · proGres XYZ-26-900001: Kobo tiene la efectiva y la hoja no la marca «Efectivo» (dice «No contesta»)");
    expect(texto).toContain("Op-02 (1)\n- PDM1114: La hoja dice «Efectivo» y Kobo no tiene envío");
    const csv = csvParaElEquipo(grupos.flatMap((grupo) => grupo.casos)).split("\n");
    expect(csv[0]).toBe("Responsable,CodPulso,proGres,Qué pasa,La hoja dice,Fecha hoja,Envío en Kobo,Enumerador Kobo,Decisión");
    expect(csv[1]).toContain("Cuenta mientras tanto");
    expect(csv.find((linea) => linea.includes("PDM1114"))).toContain("Va a Avisos");
  });
});
