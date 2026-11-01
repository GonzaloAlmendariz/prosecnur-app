import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { ActualizarAbierto, ActualizarCorriendo, detalleDelPaso } from "./ActualizarEnCurso";
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

describe("Actualizar abierto y corriendo (P1a, P1b)", () => {
  it("abierto dice los tres pasos, lo que no toca y las dos salidas", () => {
    const html = renderToStaticMarkup(<ActualizarAbierto fuentes={2} onActualizar={() => {}} onRecalcular={() => {}} onCerrar={() => {}} />);
    expect(html).toContain("Traer lo nuevo");
    expect(html).toContain("2 fuentes activas");
    expect(html).toContain("No toca la hoja de los aplicadores");
    expect(html).toContain("Actualizar ahora");
    expect(html).toContain("Recalcular sin leer");
  });

  it("corriendo marca el paso en curso y el tiempo que lleva", () => {
    const html = renderToStaticMarkup(<ActualizarCorriendo paso="recalcular" segundos={12.7} fuentes={1} leyendo />);
    expect(html).toContain("lleva 12 s");
    expect(html).toMatch(/data-tono="ok"[^>]*>.*Traer lo nuevo/);
    expect(html).toMatch(/data-en-curso="true"[^>]*>.*Recalcular/);
  });

  it("sin leer, el primer paso se salta y el recibo lo dice", () => {
    expect(detalleDelPaso("traer", 1, false)).toContain("Se salta");
    const r = construirRecibo(cifrasDe(antes), cifrasDe(antes), 3, 1, "", false);
    expect(r.pasos[0].detalle).toContain("No se leyó nada");
  });
});
