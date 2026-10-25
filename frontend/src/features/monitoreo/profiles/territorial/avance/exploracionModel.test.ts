import { describe, expect, it } from "vitest";
import type { CasoDeUmpConGps } from "../../../../../api/monitoreoCasosUmp";
import {
  casosDeLaVista,
  claseDelPunto,
  jornadas,
  recorridos,
  separarEnEspiral,
  textoDeDistancia,
  tiempoDesdeElAnterior,
  vistasDisponibles,
} from "./exploracionModel";

const caso = (extra: Partial<CasoDeUmpConGps>): CasoDeUmpConGps => ({
  id: "x", orden: 1, fechaIso: "2026-06-17", hora: "09:00:00", momento: "", duracionSegundos: 600,
  lat: -12.05, lon: -77.03, gpsEstado: "geo_ok", distanciaM: 30, idManzana: "m1", manzana: "0170",
  tipoManzana: "titular", aplicador: "P900 · Aplicador A", codigoPulso: "P900", sexo: "Mujer", edad: 40,
  consentimiento: true, motivos: [], anulado: false, estado: "cuenta",
  ...extra,
});

const CASOS = [
  caso({ id: "a1", orden: 1, hora: "09:00:00", anulado: true, estado: "anulado_efectiva" }),
  caso({ id: "a2", orden: 2, hora: "09:12:00", anulado: true, estado: "anulado_sin_consentimiento", sexo: "Hombre" }),
  caso({ id: "b1", orden: 3, fechaIso: "2026-06-28", hora: "11:00:00", tipoManzana: "reemplazo", aplicador: "P901 · Aplicador B", gpsEstado: "geo_no_defendible", distanciaM: 1820 }),
  caso({ id: "b2", orden: 4, fechaIso: "2026-06-28", hora: "", tipoManzana: "reemplazo", aplicador: "P901 · Aplicador B", lat: null, lon: null, distanciaM: null }),
];

describe("exploración de una UMP", () => {
  it("ofrece Ambas sólo si la UMP usó titular y reemplazo, y filtra por manzana", () => {
    expect(vistasDisponibles(CASOS)).toEqual(["titular", "reemplazo", "ambas"]);
    expect(vistasDisponibles(CASOS.slice(0, 2))).toEqual(["titular"]);
    expect(casosDeLaVista(CASOS, "reemplazo").map((item) => item.id)).toEqual(["b1", "b2"]);
    expect(casosDeLaVista(CASOS, "ambas")).toHaveLength(4);
  });

  it("colorea por capa: recorrido por aplicador, estado con anulados y GPS fuera, cuota por sexo", () => {
    expect(claseDelPunto(CASOS[0], "estado", 0)).toBe("is-anulado-efectiva");
    expect(claseDelPunto(CASOS[1], "estado", 0)).toBe("is-anulado-sin");
    expect(claseDelPunto(CASOS[2], "estado", 1)).toBe("is-gps-fuera");
    expect(claseDelPunto(CASOS[1], "cuota", 0)).toBe("is-hombre");
    expect(claseDelPunto(CASOS[0], "cuota", 0)).toBe("is-mujer");
    expect(claseDelPunto(CASOS[2], "recorrido", 5)).toBe("is-aplicador-1");
  });

  it("el recorrido de cada aplicador sólo une los casos con GPS", () => {
    expect(recorridos(CASOS).map((item) => [item.aplicador, item.casos.map((c) => c.id)])).toEqual([
      ["P900 · Aplicador A", ["a1", "a2"]],
      ["P901 · Aplicador B", ["b1"]],
    ]);
  });

  it("dice cuánto pasó desde el caso anterior del mismo aplicador ese día", () => {
    expect(tiempoDesdeElAnterior(CASOS[0], CASOS)).toBe("Primero del día");
    expect(tiempoDesdeElAnterior(CASOS[1], CASOS)).toBe("12 min después del anterior");
    expect(tiempoDesdeElAnterior(CASOS[3], CASOS)).toBe("Sin hora");
  });

  it("arma cada jornada con sus marcas en hora y con el ancho de lo que duró", () => {
    const dias = jornadas(CASOS);
    expect(dias.map((dia) => [dia.fecha, dia.marcas.map((marca) => marca.caso.id)])).toEqual([["17/06", ["a1", "a2"]], ["28/06", ["b1"]]]);
    expect(dias[0]).toMatchObject({ desde: 9 * 3600, hasta: 10 * 3600 });
    expect(dias[0].marcas[0]).toMatchObject({ inicio: 9 * 3600, ancho: 600 });
  });

  it("separa en espiral los puntos con el mismo GPS y deja quietos los demás", () => {
    const separados = separarEnEspiral([{ id: "a", x: 10, y: 10 }, { id: "b", x: 10, y: 10 }, { id: "c", x: 80, y: 80 }]);
    expect(separados.find((p) => p.id === "a")).toEqual({ id: "a", x: 10, y: 10 });
    const b = separados.find((p) => p.id === "b")!;
    expect(Math.hypot(b.x - 10, b.y - 10)).toBeCloseTo(9, 5);
    expect(separados.find((p) => p.id === "c")).toEqual({ id: "c", x: 80, y: 80 });
  });

  it("rotula la distancia a su manzana", () => {
    expect(textoDeDistancia(1820)).toBe("1.8 km de su manzana");
    expect(textoDeDistancia(35)).toBe("35 m de su manzana");
    expect(textoDeDistancia(null)).toBe("Sin GPS");
  });
});
