import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasCerteza } from "../../../../../api/client";
import { coberturaObjetivo } from "../coberturaObjetivoModel";

function certezaCon(filas: Array<{ label: string; brecha: number | null; agotado?: boolean }>) {
  return {
    schema: "calc_muestra_aulas_certeza_cobertura_v1",
    generado_en: "",
    nivel: 0.95,
    engine: "sistematico_pps",
    frame_hash: "h",
    corridas_solicitadas: 300,
    criterio: { pregunta: "", metodo: "", unidad: "", olas: "", no_cubre: "" },
    filas: filas.map((f, i) => ({
      key: `k${i}`,
      label: f.label,
      disponibles: 10,
      cuota: 100,
      tau: 0.8,
      aulas_formula: 5,
      probabilidad_formula: 0.5,
      aulas_certeza: f.brecha == null ? null : 5 + f.brecha,
      probabilidad_certeza: 0.96,
      brecha: f.brecha,
      alcanzable: f.brecha != null,
      agotado: Boolean(f.agotado),
      motivo: "",
      rendimiento_medio: 90,
      rendimiento_p05: 70,
      base_conteo: "estudiantes_unicos",
      corridas: 300,
      curva: [],
    })),
    total: {
      aulas_formula: 5,
      aulas_certeza: 5,
      brecha: 0,
      estratos_cortos: 0,
      estratos_agotados: 0,
      estratos_sin_ids: 0,
    },
  } as unknown as CalcMuestraAulasCerteza;
}

describe("coberturaObjetivo", () => {
  it("por debajo del objetivo la seleccion queda corta", () => {
    const out = coberturaObjetivo({ cubiertos: 2100, objetivo: 2500 });
    expect(out.estado).toBe("corta");
    expect(out.ratio).toBeCloseTo(0.84, 2);
  });

  it("llegar sin margen no es lo mismo que llegar: se nombra justa", () => {
    expect(coberturaObjetivo({ cubiertos: 2550, objetivo: 2500 }).estado).toBe("justa");
    expect(coberturaObjetivo({ cubiertos: 2500, objetivo: 2500 }).estado).toBe("justa");
    expect(coberturaObjetivo({ cubiertos: 2900, objetivo: 2500 }).estado).toBe("holgada");
  });

  it("sin cifra de estudiantes unicos no se afirma cobertura", () => {
    expect(coberturaObjetivo({ cubiertos: null, objetivo: 2500 }).estado).toBe("sin_datos");
    expect(coberturaObjetivo({ cubiertos: Number.NaN, objetivo: 2500 }).estado).toBe("sin_datos");
    expect(coberturaObjetivo({ cubiertos: 2500, objetivo: 0 }).estado).toBe("sin_datos");
    expect(coberturaObjetivo({ cubiertos: 2500, objetivo: 0 }).ratio).toBeNull();
  });

  it("nombra las facultades cortas y agotadas de la certeza medida", () => {
    const out = coberturaObjetivo({
      cubiertos: 2900,
      objetivo: 2500,
      certeza: certezaCon([
        { label: "DERECHO", brecha: 0 },
        { label: "EDUCACION", brecha: 2 },
        { label: "GASTRONOMIA", brecha: null, agotado: true },
        { label: "PSICOLOGIA", brecha: -1 },
      ]),
    });
    expect(out.facultadesCortas).toEqual(["EDUCACION", "GASTRONOMIA"]);
  });

  it("sin certeza medida no inventa facultades cortas", () => {
    expect(coberturaObjetivo({ cubiertos: 2900, objetivo: 2500 }).facultadesCortas).toEqual([]);
  });
});
