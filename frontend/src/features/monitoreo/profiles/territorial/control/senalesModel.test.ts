import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirSenales } from "./senalesModel";

const fila = (distrito: string, geo: string, distancia: number | null, segundos: number | null) => ({
  distrito, geo_estado: geo, distance_m: distancia, duration_seconds: segundos,
});

const CORTE = {
  response_audit: [
    fila("SAN MARTIN DE PORRES", "geo_ok", 10, 800),
    fila("SAN MARTIN DE PORRES", "geo_cerca", 120, 90),
    fila("SAN MARTIN DE PORRES", "geo_revision", 220, 200),
    fila("ATE", "geo_no_defendible", 628, 895),
    fila("ATE", "geo_sin_gps", null, null),
    fila("ATE", "geo_sin_cruce", 40, 600),
    fila("", "geo_ok", 5, 700),
  ],
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Señales", () => {
  const modelo = construirSenales(CORTE);

  it("la distancia sólo cuenta los casos con GPS cruzable y marca los tramos de 150 y 300 m", () => {
    expect(modelo.distancia.base).toBe(5);
    expect(modelo.distancia.mediana).toBe(120);
    const conCasos = modelo.distancia.tramos.filter((tramo) => tramo.casos).map((tramo) => [tramo.rotulo, tramo.casos]);
    expect(conCasos).toEqual([["Menos de 25 m", 2], ["100 a 150 m", 1], ["200 a 300 m", 1], ["500 a 1,000 m", 1]]);
    expect(modelo.distancia.tramos.find((tramo) => tramo.desde === 150)?.marca).toBe("revision");
    expect(modelo.distancia.tramos.find((tramo) => tramo.desde === 300)?.marca).toBe("lejos");
  });

  it("la duración va en minutos con los cortes de 2 y 5", () => {
    expect(modelo.duracion.base).toBe(6);
    expect(modelo.duracion.tramos[0]).toMatchObject({ rotulo: "Menos de 2 min", casos: 1, marca: "muy-corta" });
    expect(modelo.duracion.tramos[1]).toMatchObject({ rotulo: "2 a 5 min", casos: 1, marca: "corta" });
  });

  it("las duraciones largas se muestran como dato neutro, sin marca de alerta", () => {
    const largos = modelo.duracion.tramos.filter((tramo) => tramo.desde >= 5);
    expect(largos.every((tramo) => tramo.marca === undefined)).toBe(true);
  });

  it("la matriz por distrito separa cada señal y declara los casos sin distrito", () => {
    expect(modelo.distritos.map((item) => item.distrito)).toEqual(["Ate", "San Martín de Porres"]);
    expect(modelo.distritos[1]).toMatchObject({ casos: 3, enManzana: 1, hasta150: 1, de150a300: 1, corta: 1, muyCorta: 1 });
    expect(modelo.distritos[0]).toMatchObject({ casos: 3, mas300: 1, sinGps: 1, sinCruce: 1 });
    expect(modelo.total.casos).toBe(6);
    expect(modelo.sinDistrito).toBe(1);
  });

  it("sin respuestas una a una no hay señales", () => {
    expect(construirSenales({ response_audit: [] } as unknown as MonitoreoTerritorialDashboard).disponible).toBe(false);
  });
});
