import { describe, expect, it } from "vitest";

import type { MonitoreoAcreditacionReports, MonitoreoSource } from "../../../../../api/client";
import { buildAcreditacionPhoneSourceContract } from "../TelefonicoSourcesModel";
import { efectivasDeLaEncuesta, eslabonesDelContrato } from "./eslabonesDelContrato";

/**
 * Cierre de QA (2026-10-25, C5): en Insumos › Fuentes, Universo y Barrido
 * traían su cifra y Encuesta no, porque la metadata de Kobo no cuenta envíos.
 * El eslabón dice aportar «respuestas que cuentan como efectivas»: esa cifra
 * existe en el corte (`control_tiempo_kobo`, la de Control › Respuestas).
 */
const kobo = { id: "k1", kind: "kobo", role: "respuestas", enabled: true, label: "PDM" } as unknown as MonitoreoSource;

const reports = (filas: number) => ({
  sheets: [{ id: "monitoreo_telefonico", blocks: [{ id: "control_tiempo_kobo", rows: Array.from({ length: filas }, (_, i) => ({ CodPulso: `P${i}` })) }] }],
}) as unknown as MonitoreoAcreditacionReports;

describe("la Encuesta trae su cifra", () => {
  it("cuenta los envíos que pasan el filtro de efectiva", () => {
    expect(efectivasDeLaEncuesta(reports(424))).toBe(424);
    expect(efectivasDeLaEncuesta(null)).toBe(0);
  });

  it("el eslabón Encuesta usa esa cifra cuando la fuente no trae conteo", () => {
    const contrato = buildAcreditacionPhoneSourceContract([kobo]);
    const [, , encuesta] = eslabonesDelContrato(contrato, 0, undefined, 0, efectivasDeLaEncuesta(reports(424)));
    expect(encuesta.clave).toBe("plataforma");
    expect(encuesta.cifra).toBe("424");
  });

  it("sin bloque, la cifra queda vacía y la tarjeta lo declara (no inventa un cero)", () => {
    const contrato = buildAcreditacionPhoneSourceContract([kobo]);
    const [, , encuesta] = eslabonesDelContrato(contrato, 0, undefined, 0, 0);
    expect(encuesta.cifra).toBe("");
  });
});
