import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CasoDeUmpConGps } from "../../../../../api/monitoreoCasosUmp";
import type { EstadoDeCasosDeUmp } from "./useCasosDeUmp";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";
import { construirFichaDeUmp } from "./fichaUmpModel";
import { construirHistoriaDeUmp } from "./historiaUmpModel";

const caso = (extra: Partial<CasoDeUmpConGps>): CasoDeUmpConGps => ({
  id: "x", orden: 1, fechaIso: "2026-06-17", hora: "09:00:00", momento: "", duracionSegundos: 600,
  lat: -12.05, lon: -77.03, gpsEstado: "geo_ok", distanciaM: 30, idManzana: "150135063000590", manzana: "0590",
  tipoManzana: "titular", aplicador: "P132 · Aplicadora de Prueba", codigoPulso: "P132", sexo: "Mujer", edad: 40,
  consentimiento: true, motivos: [], anulado: false, estado: "cuenta",
  ...extra,
});

let estado: EstadoDeCasosDeUmp = { tipo: "cargando", ump: "143" };
vi.mock("./useCasosDeUmp", () => ({ useCasosDeUmp: () => estado }));

const { ExploracionUmp } = await import("./ExploracionUmp");

function pintar() {
  const ficha = construirFichaDeUmp(CORTE_DE_CUOTAS, null, "143")!;
  const historia = construirHistoriaDeUmp(CORTE_DE_CUOTAS, null, "143");
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/monitoreo?modo=territorial&seccion=avance&pestana=umps&panel=ump&foco=143"]}>
      <ExploracionUmp ficha={ficha} historia={historia} avance={CORTE_DE_CUOTAS} version="" onCerrar={() => undefined} onSugerencia={() => undefined} />
    </MemoryRouter>,
  );
}

describe("exploración de una UMP", () => {
  it("mientras llegan los casos la readiness espera y lo dice", () => {
    estado = { tipo: "cargando", ump: "143" };
    const html = pintar();
    expect(html).toContain('data-audit-ready="false"');
    expect(html).toContain("Trayendo los formularios de la UMP con su GPS");
  });

  it("con los casos pinta un punto numerado por formulario con GPS y la tarjeta del primero", () => {
    estado = {
      tipo: "listo",
      ump: "143",
      datos: {
        ump: "143",
        fase: "field",
        casos: [
          caso({ id: "a1", orden: 1, anulado: true, estado: "anulado_efectiva" }),
          caso({ id: "a2", orden: 2, hora: "09:20:00", lat: -12.05, lon: -77.03, motivos: ["gps_lejos"], estado: "observacion" }),
          caso({ id: "a3", orden: 3, lat: null, lon: null }),
        ],
        resumen: { total: 3, anulados: 1, conGps: 2 },
      },
    };
    const html = pintar();
    expect(html).toContain('data-audit-ready="monitoreo-territorial-avance-umps-exploracion"');
    expect(html).toContain("UMP 143, formulario por formulario");
    expect(html).toContain("1 sin GPS");
    expect(html).toContain("Caso 1");
    expect(html).toContain("Anulado, había aceptado");
    // El mismo GPS para dos casos no los apila: los dos puntos llevan su número.
    expect((html.match(/class="mon-exp-punto /g) ?? []).length).toBe(2);
  });

  it("si el endpoint falla, la exploración lo dice y publica su vacío", () => {
    estado = { tipo: "error", ump: "143", mensaje: "sin conexión" };
    const html = pintar();
    expect(html).toContain('data-audit-ready="vacio:sin-casos-de-ump"');
    expect(html).toContain("No se pudieron traer los casos de la UMP: sin conexión");
  });
});
