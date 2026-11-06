import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirMetas, readinessDeMetas } from "./metasModelo";
import { MetasAulas } from "./MetasAulas";

// Ficha M1 (F5 del ADR 0121): la cuota se arma con las variables que el
// estudio declara, no con «facultad × sexo» cableado.

const hsvg = {
  representatividad_declarada: {
    schema: "representatividad_v1", origen: "traducida_v1",
    universo: { nivel: "universidad", etiqueta: "Universidad" },
    variables: [
      { clave: "facultad", etiqueta: "Facultad", atribucion: "aula", categorias: [{ valor: "DERECHO", etiqueta: "Derecho" }, { valor: "LETRAS", etiqueta: "Letras" }] },
      { clave: "sexo", etiqueta: "Sexo", atribucion: "respuesta", categorias: [{ valor: "F", etiqueta: "Mujeres" }, { valor: "M", etiqueta: "Hombres" }] },
    ],
    celdas: [
      { valores: { facultad: "DERECHO", sexo: "F" }, cuota: 190, tau: 0.57 },
      { valores: { facultad: "DERECHO", sexo: "M" }, cuota: 173, tau: 0.57 },
      { valores: { facultad: "LETRAS", sexo: "F" }, cuota: 60, tau: 0.5 },
      { valores: { facultad: "LETRAS", sexo: "M" }, cuota: 40, tau: 0.5 },
    ],
  },
  agenda: [
    { sample_role: "titular", faculty: "DERECHO", eligible_n: 100, expected_valid: 57 },
    { sample_role: "titular", faculty: "DERECHO", eligible_n: 60, expected_valid: 34.2 },
    { sample_role: "chain_reserve", faculty: "DERECHO", eligible_n: 80, expected_valid: 45 },
    { sample_role: "titular", faculty: "LETRAS", eligible_n: 40, expected_valid: 20 },
  ],
  efectividad_seguimiento: { total: { tau_previsto: 0.525 } },
  avance_cuota: { vigencia: "vigente" },
} as unknown as MonitoreoAulasDashboard;

const ccss = {
  representatividad_declarada: {
    schema: "representatividad_v1", origen: "planner",
    universo: { nivel: "facultad", etiqueta: "Ciencias Sociales" },
    variables: [{ clave: "nivel", etiqueta: "Nivel", atribucion: "persona", categorias: [{ valor: "6", etiqueta: "6" }, { valor: "7", etiqueta: "7" }] }],
    celdas: [{ valores: { nivel: "6" }, cuota: 119, tau: 0.5 }, { valores: { nivel: "7" }, cuota: 122, tau: 0.5 }],
  },
  agenda: [],
} as unknown as MonitoreoAulasDashboard;

describe("construirMetas", () => {
  it("HSVG: facultad × sexo; la suma por sexo de cada facultad iguala su cuota", () => {
    const m = construirMetas(hsvg);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.columnas.map((c) => c.etiqueta)).toEqual(["Mujeres", "Hombres"]);
    for (const f of m.filas) expect((f.porColumna[0] ?? 0) + (f.porColumna[1] ?? 0)).toBe(f.cuota);
    // Sólo titulares: la reserva no cuenta.
    expect(m.filas[0]).toMatchObject({ etiqueta: "Derecho", cuota: 363, titulares: 2, elegibles: 160, esperadas: 91, tasa: "57.0 %" });
    expect(m.total.cuota).toBe(463);
    expect(m.cobertura).toContain("111");
  });

  it("CCSS: nivel, sin sexo ni columnas del plan (la variable es de la persona)", () => {
    const m = construirMetas(ccss);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.columnas).toEqual([]);
    expect(m.filas.map((f) => [f.etiqueta, f.cuota, f.titulares])).toEqual([["6", 119, null], ["7", 122, null]]);
    expect(m.origen).toContain("Planner");
    expect(m.cobertura).toBeNull();
  });

  it("sin diseño, su vacío; el diseño desfasado se avisa", () => {
    expect(construirMetas({ agenda: [] } as unknown as MonitoreoAulasDashboard).estado).toBe("sin-diseno");
    const viejo = construirMetas({ ...hsvg, avance_cuota: { vigencia: "no_verificable" } } as unknown as MonitoreoAulasDashboard);
    if (viejo.estado !== "listo") throw new Error("esperaba listo");
    expect(viejo.desfasado).not.toBeNull();
    expect(readinessDeMetas(true, null)).toBe("false");
  });
});

describe("MetasAulas", () => {
  it("publica su marca y es de solo lectura", () => {
    const html = renderToStaticMarkup(<MemoryRouter><MetasAulas dashboard={hsvg} cargando={false} vacioSinTablero={null} /></MemoryRouter>);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-modelo-metas"');
    expect(html).toContain("Cuota por facultad y sexo");
    expect(html).toContain("Abrir el diseño");
    expect(html).not.toContain("<input");
  });
});
