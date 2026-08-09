import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasCerteza,
  CalcMuestraAulasCertezaFila,
  CalcMuestraAulasEstrato,
} from "../../../../../api/client";
import {
  certezaEstadoDeFila,
  certezaEstratosDesdeResultado,
  certezaVistaDesdeEstado,
} from "../certezaCoberturaModel";

function fila(patch: Partial<CalcMuestraAulasCertezaFila> = {}): CalcMuestraAulasCertezaFila {
  return {
    key: "fac1",
    label: "FACULTAD 1",
    disponibles: 30,
    cuota: 100,
    tau: 0.8,
    aulas_formula: 5,
    probabilidad_formula: 0.62,
    aulas_certeza: 7,
    probabilidad_certeza: 0.96,
    brecha: 2,
    alcanzable: true,
    agotado: false,
    motivo: "",
    rendimiento_medio: 96,
    rendimiento_p05: 81,
    base_conteo: "estudiantes_unicos",
    corridas: 300,
    curva: [],
    ...patch,
  };
}

function certeza(filas: CalcMuestraAulasCertezaFila[], patch: Partial<CalcMuestraAulasCerteza> = {}): CalcMuestraAulasCerteza {
  return {
    schema: "calc_muestra_aulas_certeza_cobertura_v1",
    generado_en: "2026-08-09T12:00:00Z",
    nivel: 0.95,
    engine: "sistematico_pps",
    frame_hash: "hash-vigente",
    corridas_solicitadas: 300,
    criterio: { pregunta: "", metodo: "", unidad: "", olas: "", no_cubre: "" },
    filas,
    total: {
      aulas_formula: 5,
      aulas_certeza: 7,
      brecha: 2,
      estratos_cortos: 1,
      estratos_agotados: 0,
      estratos_sin_ids: 0,
    },
    ...patch,
  };
}

describe("certezaEstadoDeFila", () => {
  it("separa marco agotado de faltan aulas: son dos problemas distintos", () => {
    expect(certezaEstadoDeFila(fila({ agotado: true, alcanzable: false, brecha: null }))).toBe("agotado");
    expect(certezaEstadoDeFila(fila({ brecha: 3 }))).toBe("corta");
  });

  it("nombra el caso en que la formula pide de mas", () => {
    expect(certezaEstadoDeFila(fila({ brecha: -2 }))).toBe("sobra");
    expect(certezaEstadoDeFila(fila({ brecha: 0 }))).toBe("ajustada");
  });

  it("una fila sin minimo alcanzable y sin agotamiento queda sin datos, no en verde", () => {
    expect(certezaEstadoDeFila(fila({ alcanzable: false, agotado: false, brecha: null }))).toBe("sin_datos");
  });
});

describe("certezaVistaDesdeEstado", () => {
  it("rechaza un payload con schema ajeno en vez de proyectarlo a medias", () => {
    const ajeno = { ...certeza([fila()]), schema: "otro_schema" } as unknown as CalcMuestraAulasCerteza;
    expect(certezaVistaDesdeEstado(ajeno, "hash-vigente")).toBeNull();
    expect(certezaVistaDesdeEstado(null, "hash-vigente")).toBeNull();
    expect(certezaVistaDesdeEstado(certeza([]), "hash-vigente")).toBeNull();
  });

  it("ordena por urgencia: agotados primero, luego cortos por tamano de brecha", () => {
    const vista = certezaVistaDesdeEstado(
      certeza([
        fila({ key: "a", label: "AJUSTADA", brecha: 0 }),
        fila({ key: "b", label: "CORTA CHICA", brecha: 1 }),
        fila({ key: "c", label: "AGOTADA", agotado: true, alcanzable: false, brecha: null }),
        fila({ key: "d", label: "CORTA GRANDE", brecha: 6 }),
      ]),
      "hash-vigente",
    );

    expect(vista?.filas.map((row) => row.label)).toEqual([
      "AGOTADA",
      "CORTA GRANDE",
      "CORTA CHICA",
      "AJUSTADA",
    ]);
    expect(vista?.criticos.map((row) => row.label)).toEqual(["AGOTADA", "CORTA GRANDE", "CORTA CHICA"]);
  });

  it("marca como no vigente una medicion hecha sobre otro marco", () => {
    expect(certezaVistaDesdeEstado(certeza([fila()]), "hash-vigente")?.vigente).toBe(true);
    expect(certezaVistaDesdeEstado(certeza([fila()]), "otro-hash")?.vigente).toBe(false);
    // Sin hash vigente no se puede afirmar frescura: se declara no vigente.
    expect(certezaVistaDesdeEstado(certeza([fila()]), null)?.vigente).toBe(false);
  });

  it("propaga que el rendimiento es una cota superior cuando el marco no trae padrones", () => {
    const vista = certezaVistaDesdeEstado(
      certeza([fila({ base_conteo: "suma_elegibles" })]),
      "hash-vigente",
    );
    expect(vista?.hayCotaSuperior).toBe(true);
    expect(vista?.filas[0]?.cotaSuperior).toBe(true);
  });
});

describe("certezaEstratosDesdeResultado", () => {
  function estrato(patch: Partial<CalcMuestraAulasEstrato> = {}): CalcMuestraAulasEstrato {
    return {
      estrato: "FACULTAD 1",
      N: 1000,
      cuota: 120,
      avg_conglomerado: 24,
      tau: 0.8,
      aulas_base: 7,
      aulas_reemplazo: 4,
      aulas_total: 11,
      tipo_aula: "G2 (20-29)",
      precision_e: 0.05,
      ...patch,
    };
  }

  it("manda los titulares, no el total con reservas", () => {
    const [payload] = certezaEstratosDesdeResultado([estrato()]);
    expect(payload.aulas_formula).toBe(7);
    expect(payload.cuota).toBe(120);
    expect(payload.tau).toBe(0.8);
  });

  it("descarta estratos sin cuota y conserva la llave de facultad cuando existe", () => {
    const filas = certezaEstratosDesdeResultado([
      estrato({ cuota: 0 }),
      estrato({
        estrato: "FACULTAD 2",
        alumnos_por_ch: {
          referencia: "marco_ejecutado",
          frame_hash: "hash",
          denominador: "elegible",
          faculty_key: "facultad2",
          estadistico: "mediana",
          valor: 24,
        },
      }),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].faculty_key).toBe("facultad2");
  });

  it("un tau invalido viaja como null para que R aplique su respaldo", () => {
    expect(certezaEstratosDesdeResultado([estrato({ tau: 0 })])[0].tau).toBeNull();
  });
});
