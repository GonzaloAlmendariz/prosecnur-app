import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeHojasRutaEstratoMuestral, type HojasRutaSampleSizeConfig, type HojasRutaSampleSizeDistrictRow } from "../../../../api/hojasRuta";
import { conRepartoDelEstrato, EstratoMuestral, estratoDe, politicaAlCambiar } from "./EstratoMuestral";
import type { ResultadoTamano } from "./motorTamano";

const ss = (estrato?: HojasRutaSampleSizeConfig["estrato"]): HojasRutaSampleSizeConfig => ({
  confidence_level: 0.95, margin_total: 0.05, margin_district: 0.1, expected_proportion: 0.5, design_effect: 1,
  response_rate: 0.9, apply_fpc: true, estrato,
});

// Forma en que R serializa la vista previa: escalares en arreglos de largo 1.
const crudo = {
  modo: ["provincia_lima_areas"], rutas_minimas_ciudad: [6], regla: ["§1b"],
  estratos: [
    { estrato: ["0701"], etiqueta: ["Callao"], n_distritos: [2], poblacion: [191257.07], rutas: [10] },
    { estrato: ["1501-lima_norte"], etiqueta: ["Lima Norte"], n_distritos: [1], poblacion: [363623.41], rutas: [16] },
  ],
  // NA de R en la ciudad forzosa: el grupo llega vacío.
  ciudades: [
    { ciudad: ["0701"], etiqueta: ["Callao"], macrorregion: ["centro"], grupo: [], condicion: ["forzosa"], pi_ciudad: [1], rutas: [10] },
    { ciudad: ["1501"], etiqueta: ["Lima"], macrorregion: ["centro"], grupo: [], condicion: ["forzosa"], pi_ciudad: [1], rutas: [16] },
    { ciudad: ["1601"], etiqueta: ["Maynas"], macrorregion: ["oriente"], grupo: ["oriente"], condicion: ["sorteada"], pi_ciudad: [0.38], rutas: [9] },
    { ciudad: ["2501"], etiqueta: ["Coronel Portillo"], macrorregion: ["oriente"], grupo: ["oriente"], condicion: ["no_sorteada"], pi_ciudad: [0.37], rutas: [0] },
  ],
  grupos: [{ grupo: ["oriente"], reparto: [9.05], h: [1], rutas: [9], n_ciudades: [2] }],
};

describe("estrato del sorteo en la UI (ADR 0131 §1)", () => {
  it("normaliza la declaración de R y descarta lo roto", () => {
    const n = normalizeHojasRutaEstratoMuestral(crudo);
    expect(n?.modo).toBe("provincia_lima_areas");
    expect(n?.estratos.map((e) => [e.etiqueta, e.rutas])).toEqual([["Callao", 10], ["Lima Norte", 16]]);
    expect(n?.rutas_minimas_ciudad).toBe(6);
    expect(n?.ciudades.map((c) => [c.ciudad, c.grupo, c.condicion])).toEqual([["0701", null, "forzosa"], ["1501", null, "forzosa"], ["1601", "oriente", "sorteada"], ["2501", "oriente", "no_sorteada"]]);
    expect(n?.grupos).toEqual([{ grupo: "oriente", reparto: 9.05, h: 1, rutas: 9, n_ciudades: 2 }]);
    expect(normalizeHojasRutaEstratoMuestral({ modo: "distrito", estratos: crudo.estratos })).toBeNull();
    expect(normalizeHojasRutaEstratoMuestral({ modo: "provincia", estratos: [{ estrato: "0701" }] })).toBeNull();
    expect(normalizeHojasRutaEstratoMuestral(null)).toBeNull();
  });

  it("por defecto es por distrito y pasar a provincia pide el reemplazo pareado", () => {
    expect(estratoDe(ss())).toBe("distrito");
    expect(politicaAlCambiar("provincia")).toEqual({ replacement_policy: "paired_by_titular_zone" });
    expect(politicaAlCambiar("distrito")).toBeNull();
  });

  it("muestra el mínimo por ciudad, las ciudades fijas y los grupos con sus ciudades aleatorias y su π (§1b; «Fija/Aleatoria», maqueta 2026-11-05)", () => {
    const html = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia_lima_areas")} rowVar="distrito" nPorDistrito={false} servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambio={() => undefined} onCambioMinimo={() => undefined} />);
    expect(html).toContain("Rutas mínimas por ciudad visitada");
    expect(html).toContain('value="6"');
    expect(html).toContain("Ciudades fijas");
    expect(html).toContain("Lima por áreas");
    expect(html).toContain("Norte 16");
    expect(html).toContain("Oriente");
    expect(html).toContain("9 rutas en 1 de 2 ciudades");
    expect(html).toContain("aleatoria, 9 rutas (π 0.38)");
    expect(html).toContain("no sale (π 0.37)");
    expect(html).toContain("35 rutas");
    // Otro estrato u otro mínimo que el calculado: no se muestran cifras viejas.
    const otro = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia")} rowVar="distrito" nPorDistrito={false} servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambio={() => undefined} onCambioMinimo={() => undefined} />);
    expect(otro).toContain("se calculan al guardar");
    expect(otro).not.toContain("Maynas");
    const otroMinimo = renderToStaticMarkup(<EstratoMuestral sampleSize={{ ...ss("provincia_lima_areas"), rutas_minimas_ciudad: 8 }} rowVar="distrito" nPorDistrito={false} servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambio={() => undefined} onCambioMinimo={() => undefined} />);
    expect(otroMinimo).toContain("se calculan al guardar");
  });

  it("con N por distrito el estrato no se puede elegir y lo dice", () => {
    const html = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia")} rowVar="distrito" nPorDistrito servidor={null} deshabilitado={false} onCambio={() => undefined} onCambioMinimo={() => undefined} />);
    expect(html).toContain("cada distrito es su propio estrato");
    expect(html).toContain('data-estrato="distrito"');
  });

  it("el reparto por distrito sale de R con estrato provincia y sin borrador", () => {
    const r = { filas: [{ ubigeo: "070106", distrito: "X", poblacion: 1, nMinimo: 0, nUsado: 40, margen: 0.1, margenObjetivo: 0.1, deff: 1 }] } as ResultadoTamano;
    const filas = [{ ubigeo: "070106", n_used: 16, margin_estimated: 0.2 }] as HojasRutaSampleSizeDistrictRow[];
    const srv = normalizeHojasRutaEstratoMuestral(crudo);
    expect(conRepartoDelEstrato(r, filas, "provincia_lima_areas", srv, false).filas[0].nUsado).toBe(16);
    expect(conRepartoDelEstrato(r, filas, "provincia_lima_areas", srv, true)).toBe(r);
    expect(conRepartoDelEstrato(r, filas, "distrito", srv, false)).toBe(r);
    expect(conRepartoDelEstrato(r, filas, "provincia", srv, false)).toBe(r);
  });
});
