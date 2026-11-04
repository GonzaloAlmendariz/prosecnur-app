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
  modo: ["provincia_lima_areas"], minimo_rutas: [2], regla: ["n_h >= 2"],
  estratos: [
    { estrato: ["0701"], etiqueta: ["Callao"], n_distritos: [2], poblacion: [191257.07], rutas: [10] },
    { estrato: ["1501-lima_norte"], etiqueta: ["Lima Norte"], n_distritos: [1], poblacion: [363623.41], rutas: [16] },
  ],
};

describe("estrato del sorteo en la UI (ADR 0131 §1)", () => {
  it("normaliza la declaración de R y descarta lo roto", () => {
    const n = normalizeHojasRutaEstratoMuestral(crudo);
    expect(n?.modo).toBe("provincia_lima_areas");
    expect(n?.estratos.map((e) => [e.etiqueta, e.rutas])).toEqual([["Callao", 10], ["Lima Norte", 16]]);
    expect(normalizeHojasRutaEstratoMuestral({ modo: "distrito", estratos: crudo.estratos })).toBeNull();
    expect(normalizeHojasRutaEstratoMuestral({ modo: "provincia", estratos: [{ estrato: "0701" }] })).toBeNull();
    expect(normalizeHojasRutaEstratoMuestral(null)).toBeNull();
  });

  it("por defecto es por distrito y pasar a provincia pide el reemplazo pareado", () => {
    expect(estratoDe(ss())).toBe("distrito");
    expect(politicaAlCambiar("provincia")).toEqual({ replacement_policy: "paired_by_titular_zone" });
    expect(politicaAlCambiar("distrito")).toBeNull();
  });

  it("muestra el mínimo de 2 rutas y las rutas por estrato del último cálculo", () => {
    const html = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia_lima_areas")} rowVar="distrito" nPorDistrito={false} servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambio={() => undefined} />);
    expect(html).toContain("Mínimo 2 rutas por estrato");
    expect(html).toContain("Lima Norte");
    expect(html).toContain("16 rutas");
    expect(html).toContain("26 rutas");
    // Otro estrato que el calculado: no se muestran rutas viejas.
    const otro = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia")} rowVar="distrito" nPorDistrito={false} servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambio={() => undefined} />);
    expect(otro).toContain("se calculan al guardar");
    expect(otro).not.toContain("Lima Norte");
  });

  it("con N por distrito el estrato no se puede elegir y lo dice", () => {
    const html = renderToStaticMarkup(<EstratoMuestral sampleSize={ss("provincia")} rowVar="distrito" nPorDistrito servidor={null} deshabilitado={false} onCambio={() => undefined} />);
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
