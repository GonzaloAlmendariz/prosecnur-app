import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeHojasRutaEstratoMuestral } from "../../../../api/hojasRuta";
import { DistritosSorteados, distritosAplica } from "./DistritosSorteados";

const crudo = {
  modo: ["provincia"], rutas_minimas_ciudad: [6], regla: ["§1b"],
  estratos: [{ estrato: "1501", etiqueta: "Lima", n_distritos: 43, poblacion: 1, rutas: 122 }],
  ciudades: [{ ciudad: "1501", etiqueta: "Lima", macrorregion: "centro", grupo: null, condicion: "forzosa", pi_ciudad: 1, rutas: 122 }],
  grupos: [],
  rutas_minimas_distrito: [3],
  grupos_distritos: [
    { estrato: "1501", etiqueta: "Lima", rutas: 122, n_distritos: 43, n_forzosos: 15, n_candidatos: 28, h: 13, rutas_grupo: 39, regla: "ordinaria" },
    { estrato: "2301", etiqueta: "Tacna", rutas: 11, n_distritos: 5, n_forzosos: 2, n_candidatos: 3, h: 1, rutas_grupo: 3, regla: "minimo_descontado_de_forzosos" },
  ],
};
const ss = { estrato: "provincia" as const, base_reparto: "cpv2025_adultos_urbanos" as const };

describe("DistritosSorteados (ADR 0131 §1c)", () => {
  it("el normalizador lee el mínimo y los grupos por ciudad; sin ellos queda en null", () => {
    const n = normalizeHojasRutaEstratoMuestral(crudo);
    expect(n?.distritos?.rutas_minimas_distrito).toBe(3);
    expect(n?.distritos?.grupos.map((g) => [g.estrato, g.n_forzosos, g.h])).toEqual([["1501", 15, 13], ["2301", 2, 1]]);
    const { rutas_minimas_distrito: _m, grupos_distritos: _g, ...sin } = crudo;
    expect(normalizeHojasRutaEstratoMuestral(sin)?.distritos).toBeNull();
  });

  it("sólo aplica con estrato provincia, base 2025 y sin N por distrito", () => {
    expect(distritosAplica(ss, false)).toBe(true);
    expect(distritosAplica(ss, true)).toBe(false);
    expect(distritosAplica({ ...ss, base_reparto: "cpv2017" }, false)).toBe(false);
    expect(distritosAplica({ ...ss, estrato: "distrito" }, false)).toBe(false);
  });

  it("muestra el mínimo y, por ciudad, los distritos con certeza y los sorteados", () => {
    const html = renderToStaticMarkup(<DistritosSorteados sampleSize={ss} aplica servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambioMinimo={() => undefined} />);
    expect(html).toContain("Rutas mínimas por distrito visitado");
    expect(html).toContain('value="3"');
    expect(html).toContain("15 con certeza, 13 de 28 sorteados");
    expect(html).toContain("En Tacna el distrito sorteado recibe el mínimo");
    const otro = renderToStaticMarkup(<DistritosSorteados sampleSize={{ ...ss, rutas_minimas_distrito: 4 }} aplica servidor={normalizeHojasRutaEstratoMuestral(crudo)} deshabilitado={false} onCambioMinimo={() => undefined} />);
    expect(otro).toContain("Los distritos se calculan al guardar.");
    expect(renderToStaticMarkup(<DistritosSorteados sampleSize={ss} aplica={false} servidor={null} deshabilitado={false} onCambioMinimo={() => undefined} />)).toBe("");
  });
});
