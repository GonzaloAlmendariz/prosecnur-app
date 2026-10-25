import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress } from "../../../../../api/client";
import { CORTE_DE_CUOTAS } from "../avance/fixtures/corteDeCuotas";
import { encuadrar, manzanasDelMapa, reemplazosEnUso, trazoDe } from "./mapaDeLaMuestraModel";

const bloque = (id_manzana: string, tipo_manzana: string): TerritorialBlockProgress => ({ id_manzana, tipo_manzana, ubigeo: "150103", distrito: "ATE", zona: "00700", manzana: id_manzana.slice(-4) } as TerritorialBlockProgress);

describe("Modelo › Manzanas de la muestra", () => {
  const cuota = CORTE_DE_CUOTAS.route_quota_progress!;
  const reemplazo7 = (cuota.blocks ?? []).find((item) => item.ump === "7")!;
  const titular7 = { ...reemplazo7, id_manzana: "150103007000090", manzana: "0090", tipo_manzana: "titular", operational_group_selected: false };
  const avance = { ...CORTE_DE_CUOTAS, route_quota_progress: { ...cuota, blocks: [...(cuota.blocks ?? []), titular7] } } as MonitoreoTerritorialDashboard;

  it("el reemplazo en uso es el que la cuota de la UMP marca vigente y tiene su titular", () => {
    expect([...(reemplazosEnUso(avance) ?? [])]).toEqual(["150103007000100"]);
    // Sin la titular en la ruta, el reemplazo no reemplaza a nada que se vea.
    expect([...(reemplazosEnUso(CORTE_DE_CUOTAS) ?? [])]).toEqual([]);
    expect(reemplazosEnUso(null)).toBeNull();
  });

  it("pinta titulares y reemplazos en uso; la reserva sólo se cuenta", () => {
    const bloques = [bloque("150103007000090", "titular"), bloque("150103007000100", "reemplazo"), bloque("150103007000200", "reemplazo")];
    const mapa = manzanasDelMapa(bloques, new Set(["150103007000100"]));
    expect(mapa.visibles.map((item) => item.id_manzana)).toEqual(["150103007000090", "150103007000100"]);
    expect(mapa).toMatchObject({ titulares: 1, enUso: 1, reserva: 1, sinDatoDeUso: false });
    expect(manzanasDelMapa(bloques, null)).toMatchObject({ enUso: 0, sinDatoDeUso: true });
  });

  it("el encuadre llena la caja con margen parejo en el eje que manda", () => {
    const encuadre = encuadrar([[0, 0], [2, 1]], 1000, 1000, 50);
    expect(encuadre.proyectar(0, 1)).toEqual({ x: 50, y: 275 });
    expect(encuadre.proyectar(2, 0)).toEqual({ x: 950, y: 725 });
    expect(trazoDe({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 1], [0, 0]]] }, encuadre.proyectar)).toBe("M50.0 725.0L950.0 725.0L950.0 275.0L50.0 725.0Z");
  });
});
