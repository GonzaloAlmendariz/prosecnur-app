import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasEstrato } from "../../../../../api/calcMuestra";
import { construirSustento, nombreEstadistico } from "../sustentoDimensionamientoModel";

function fila(over: Record<string, unknown>): CalcMuestraAulasEstrato {
  return {
    estrato: "CIENCIAS E INGENIERIA",
    N: 4512,
    cuota: 530,
    avg_conglomerado: 24,
    estadistico_usado: "p25",
    tau: 0.53,
    aulas_base: 42,
    aulas_reemplazo: 21,
    aulas_total: 63,
    ...over,
  } as unknown as CalcMuestraAulasEstrato;
}

describe("construirSustento", () => {
  it("reproduce la fórmula del motor y separa sus dos factores", () => {
    // La cifra medida en HSVG2026: 530 ÷ (24 × 0.53) = 41.7 → 42.
    const s = construirSustento([fila({})]);
    expect(s!.filas[0]).toMatchObject({
      cuota: 530,
      estadisticoValor: 24,
      estadisticoNombre: "primer cuartil (p25)",
      tau: 0.53,
      aulasFormula: 42,
      aulasBase: 42,
      ajustadaAMano: false,
      aCoordinar: 63,
    });
  });

  it("una fila fijada a mano se marca con la cifra de la fórmula", () => {
    // El botón «¿un aula más?» fija aulas_base_fijas: lo publicado (16) deja
    // de coincidir con la fórmula (42). Nada manual queda sin registrar.
    const s = construirSustento([fila({ aulas_base: 16 })]);
    expect(s!.filas[0]).toMatchObject({ aulasBase: 16, aulasFormula: 42, ajustadaAMano: true });
    expect(s!.ajustadasAMano).toBe(1);
  });

  it("declara el τ GLOBAL cuando todas las facultades comparten uno (hallazgo J2)", () => {
    const global = construirSustento([
      fila({}),
      fila({ estrato: "DERECHO", cuota: 347, avg_conglomerado: 37, aulas_base: 18, aulas_reemplazo: 9, aulas_total: 27 }),
    ]);
    expect(global!.tauGlobal).toBe(0.53);

    const porFacultad = construirSustento([
      fila({}),
      fila({ estrato: "DERECHO", tau: 0.61, aulas_base: 24 }),
    ]);
    expect(porFacultad!.tauGlobal).toBeNull();
  });

  it("suma los totales y ordena por cuota descendente", () => {
    const s = construirSustento([
      fila({ estrato: "GASTRONOMÍA", cuota: 15, avg_conglomerado: 17, aulas_base: 2, aulas_reemplazo: 1, aulas_total: 3 }),
      fila({}),
    ]);
    expect(s!.filas.map((f) => f.facultad)).toEqual(["CIENCIAS E INGENIERIA", "GASTRONOMÍA"]);
    expect(s!.totales).toMatchObject({ cuota: 545, aulasBase: 44, reservas: 22, aCoordinar: 66 });
  });

  it("sin filas o sin cifras devuelve null y no finge una cuenta", () => {
    expect(construirSustento(null)).toBeNull();
    expect(construirSustento([])).toBeNull();
    expect(construirSustento([fila({ cuota: null, aulas_base: null })])).toBeNull();
  });

  it("nombra el estadístico en lenguaje del analista", () => {
    expect(nombreEstadistico("p25")).toBe("primer cuartil (p25)");
    expect(nombreEstadistico("mediana")).toBe("mediana");
    expect(nombreEstadistico("")).toBe("estadístico del diseño");
  });
});

describe("τ propio referencial (decisión de Gonzalo: mostrar, no redimensionar)", () => {
  const escalon = (curso: string, efectivas: number, elegibles: number) => ({
    posicion: 1, semana: 1, rol: "Titular", curso_horario: curso,
    estado: "aplicado", efectivas, efectivas_mujeres: null, efectivas_hombres: null,
    elegibles, rendimiento: efectivas / elegibles, motivo: null, motivo_codigo: null,
  });
  const cadenaDe = (facultad: string, n: number, efectivas: number, elegibles: number) =>
    Array.from({ length: n }, (_, i) => ({
      cadena: i + 1, facultad, titular: `CH-${i}`, nombre_curso: "X", horario: "0101",
      efectivas_mujeres: null, efectivas_hombres: null,
      escalones: [escalon(`CH-${facultad}-${i}`, efectivas, elegibles)],
      escalones_trabajados: 1, aplicados: 1, resuelta_en: 1,
      semana_inicio: 1, semana_fin: 1, efectivas, elegibles,
      rendimiento: efectivas / elegibles,
    })) as never;

  it("con k>=12 publica el τ propio y la cifra referencial; con menos, null declarado", () => {
    const cadenas = [
      ...cadenaDe("CIENCIAS E INGENIERIA", 12, 15, 30), // τ propio 0.5, k=12
      ...cadenaDe("GASTRONOMÍA", 2, 20, 20),            // k=2: insuficiente
    ];
    const s = construirSustento(
      [
        fila({}),
        fila({ estrato: "GASTRONOMÍA", cuota: 15, avg_conglomerado: 17, aulas_base: 2, aulas_reemplazo: 1, aulas_total: 3 }),
      ],
      cadenas,
    );
    const ci = s!.filas.find((f) => f.facultad === "CIENCIAS E INGENIERIA")!;
    expect(ci.tauPropio).toBeCloseTo(0.5, 9);
    expect(ci.kPropio).toBe(12);
    // ceil(530 / (24 × 0.5)) = 45 — referencial: el diseño sigue en 42.
    expect(ci.aulasConTauPropio).toBe(45);
    expect(ci.aulasBase).toBe(42);
    const gas = s!.filas.find((f) => f.facultad === "GASTRONOMÍA")!;
    expect(gas.tauPropio).toBeNull();
    expect(gas.aulasConTauPropio).toBeNull();
  });

  it("el join tolera acentos y puntuación de la facultad", () => {
    const s = construirSustento(
      [fila({ estrato: "GASTRONOMÍA, HOTELERÍA Y TURISMO", cuota: 15, avg_conglomerado: 17, aulas_base: 2, aulas_reemplazo: 1, aulas_total: 3 })],
      cadenaDe("GASTRONOMIA HOTELERIA Y TURISMO", 12, 10, 20),
    );
    expect(s!.filas[0]!.tauPropio).toBeCloseTo(0.5, 9);
  });

  it("sin cadenas, las columnas referenciales quedan nulas y nada revienta", () => {
    const s = construirSustento([fila({})], null);
    expect(s!.filas[0]!.tauPropio).toBeNull();
  });
});

describe("cumplimiento por sexo 2025 (D2, referencial)", () => {
  it("lee las cuotas de la referencia con clave tolerante y nulls honestos", async () => {
    const { cumplimientoSexo2025 } = await import("../CertificacionFacultadCard");
    const ref = {
      cuotas: {
        filas: [
          { facultad: "ESTUDIOS GENERALES LETRAS", cumplimiento_mujeres: 1.08, cumplimiento_hombres: 0.922 },
          { facultad: "GESTIÓN Y ALTA DIRECCIÓN", cumplimiento_mujeres: null, cumplimiento_hombres: 1.1 },
        ],
      },
    } as never;
    const m = cumplimientoSexo2025(ref);
    expect(m.get("estudios_generales_letras")).toEqual({ F: 1.08, M: 0.922 });
    expect(m.get("gestion_y_alta_direccion")).toEqual({ F: null, M: 1.1 });
    expect(cumplimientoSexo2025(null).size).toBe(0);
  });
});

describe("aporte de los titulares (K3)", () => {
  it("binnea, mide concentración y cuenta scores negativos", async () => {
    const { construirAporteTitulares } = await import("../aporteTitularesModel");
    const filas = [10, 10, 10, 10, 20, 20, 20, 20, 80, 80].map((v, i) => ({
      aporte_neto: v,
      selector_score: i === 0 ? -5 : 10,
    }));
    const a = construirAporteTitulares(filas, 7)!;
    expect(a.titulares).toBe(10);
    expect(a.total).toBe(280);
    // top 20% = 2 titulares (80+80) => 160/280
    expect(a.concentracionTop20).toBeCloseTo(160 / 280, 9);
    expect(a.mediana).toBe(20);
    expect(a.scoreNegativo).toBe(1);
    expect(a.bins.reduce((s, b) => s + b.n, 0)).toBe(10);
  });

  it("sin señal (constante o pocas filas) devuelve null — un histograma de una constante es decoración", async () => {
    const { construirAporteTitulares } = await import("../aporteTitularesModel");
    expect(construirAporteTitulares([{ aporte_neto: 5 }, { aporte_neto: 5 }, { aporte_neto: 5 }, { aporte_neto: 5 }])).toBeNull();
    expect(construirAporteTitulares([{ aporte_neto: 1 }])).toBeNull();
    expect(construirAporteTitulares(null)).toBeNull();
  });
});
