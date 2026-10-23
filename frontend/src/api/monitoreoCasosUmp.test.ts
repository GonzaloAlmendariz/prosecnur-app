import { describe, expect, it } from "vitest";
import { normalizeCasosDeUmp } from "./monitoreoCasosUmp";

describe("casos de una UMP con GPS", () => {
  it("normaliza lo que serializa Plumber, con escalares como vector de uno", () => {
    const out = normalizeCasosDeUmp({
      ok: [true],
      ump: ["107"],
      phase: ["field"],
      casos: [
        {
          id: ["a1"], orden: [1], fecha_iso: ["2026-06-17"], hora: ["09:15:00"], momento: ["2026-06-17T09:15:00"],
          duracion_segundos: [720], lat: [-12.05], lon: [-77.03], gps_estado: ["geo_ok"], distancia_m: [35],
          id_manzana: ["150133022000170"], manzana: ["0170"], tipo_manzana: ["titular"], aplicador: ["P900 · Aplicador"],
          codigo_pulso: ["P900"], sexo: ["Mujer"], edad: [61], consentimiento: [false],
          motivos: ["gps_lejos;duracion_corta"], anulado: [true], estado: ["anulado_sin_consentimiento"],
        },
      ],
      resumen: { total: [1], anulados: [1], con_gps: [1] },
    });
    expect(out).toMatchObject({ ump: "107", fase: "field", resumen: { total: 1, anulados: 1, conGps: 1 } });
    expect(out.casos[0]).toMatchObject({
      id: "a1", orden: 1, hora: "09:15:00", lat: -12.05, lon: -77.03, duracionSegundos: 720,
      consentimiento: false, anulado: true, estado: "anulado_sin_consentimiento", motivos: ["gps_lejos", "duracion_corta"],
    });
  });

  it("un caso solo (lista de uno) y un GPS a medias no inventan coordenadas", () => {
    const out = normalizeCasosDeUmp({ casos: { id: "b2", lat: -12.05, lon: null, estado: "cuenta" } });
    expect(out.casos).toHaveLength(1);
    expect([out.casos[0].lat, out.casos[0].lon]).toEqual([null, null]);
    expect(out.resumen).toEqual({ total: 1, anulados: 0, conGps: 0 });
  });

  it("un estado desconocido no se pinta como si contara", () => {
    expect(normalizeCasosDeUmp({ casos: [{ id: "x", estado: "raro" }] }).casos[0].estado).toBe("no_cuenta");
    expect(normalizeCasosDeUmp({}).casos).toEqual([]);
  });
});
