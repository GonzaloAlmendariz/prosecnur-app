import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { ReciboDeActualizar } from "./ReciboDeActualizar";
import { cifrasDe, construirRecibo } from "./useReciboDeActualizar";

// P1: Actualizar explica su proceso y deja recibo de lo que cambió.

const antes = { avance_cuota: { total: { respuestas_validas: 3300 } }, refuerzos: { diseno: { sin_resolver: 9 } }, partes_campo: new Array(188).fill({}) } as unknown as MonitoreoAulasDashboard;
const despues = { avance_cuota: { total: { respuestas_validas: 3327 } }, refuerzos: { diseno: { sin_resolver: 8 } }, partes_campo: new Array(190).fill({}) } as unknown as MonitoreoAulasDashboard;

describe("ReciboDeActualizar", () => {
  it("lee las tres cifras del corte", () => {
    expect(cifrasDe(despues)).toEqual({ efectivas: 3327, porResolver: 8, partes: 190 });
  });

  it("dice los pasos, lo que cambió y lo que no tocó", () => {
    const r = construirRecibo(cifrasDe(antes), cifrasDe(despues), 14.8, 1, "");
    const html = renderToStaticMarkup(<ReciboDeActualizar recibo={r} onCerrar={() => {}} />);
    expect(html).toContain("Actualizado en 14.8 s");
    expect(html).toContain("(+27)");
    expect(html).toContain("(−1)");
    expect(html).toContain("No publica las hojas de la app");
  });

  it("si la plataforma no respondió, el primer paso lo dice", () => {
    const r = construirRecibo(cifrasDe(antes), cifrasDe(antes), 2, 1, "timeout");
    expect(r.pasos[0]).toMatchObject({ tono: "aviso" });
    expect(r.pasos[0].detalle).toContain("timeout");
  });
});
