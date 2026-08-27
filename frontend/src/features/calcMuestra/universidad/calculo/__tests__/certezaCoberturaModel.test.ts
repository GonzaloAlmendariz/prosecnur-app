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
  curvaResumen,
  precisionVeredicto,
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

// El rendimiento de una facultad no puede quedarse quieto cuando se le suman
// aulas: cada aula agrega estudiantes, aunque sean pocos por el traslape. Una
// curva plana significa que el sorteo no esta evaluando el candidato que la
// fila nombra, y eso paso de verdad: con `faculty_targets` puestos, la certeza
// devolvia 392,7 con 40 aulas y 394,6 con 55, y la pantalla no lo delataba
// porque publicaba una sola cifra final. Es un invariante, no una opinion.
describe("curvaResumen", () => {
  const punto = (aulas: number, rendimiento: number) => ({
    aulas, probabilidad: 0.9, rendimiento_medio: rendimiento, rendimiento_p05: rendimiento * 0.95,
  });

  it("marca plana la curva cuya rendimiento no crece con el candidato", () => {
    const r = curvaResumen([punto(40, 392.7), punto(45, 393.3), punto(50, 394.8), punto(55, 394.6)]);
    expect(r.plana).toBe(true);
    expect(r.puntos).toHaveLength(4);
  });

  it("una curva que crece de verdad no se marca", () => {
    const r = curvaResumen([punto(16, 340.1), punto(17, 357.6), punto(18, 376.3)]);
    expect(r.plana).toBe(false);
  });

  it("con menos de dos puntos no hay invariante que juzgar", () => {
    expect(curvaResumen([punto(5, 100)]).plana).toBe(false);
    expect(curvaResumen([]).plana).toBe(false);
    expect(curvaResumen(undefined).puntos).toEqual([]);
  });
});

// El motor no corre las mil simulaciones que se le piden: las reduce en las
// facultades de marco grande porque cada sorteo cuesta mas. En HSVG2026 fueron
// de 144 (Ciencias e Ingenieria, 417 aulas) a 1 000, y eso invierte la
// precision justo donde mas pesa, porque las de mayor cuota son las de marco
// mas grande. Derecho paso con 195 sorteos de 205: su margen sobre el 0,95 es
// doce veces menor que el error de muestreo con el que se midio, asi que con
// esa evidencia no se puede distinguir si cumple. El panel publicaba el
// veredicto sin decir con cuantos sorteos se tomo.
describe("precisionVeredicto — mide si el ruido puede mover el MÍNIMO", () => {
  // Los tres casos son los de HSVG2026, con sus curvas reales. La vara vieja
  // comparaba el margen de p(n) sobre el nivel contra el error binomial y
  // marcaba los tres como ambiguos; ninguno lo era.
  const fila = (
    aulas_certeza: number,
    corridas: number,
    curva: Array<[number, number]>,
  ) =>
    ({
      aulas_certeza,
      corridas,
      probabilidad_certeza: curva.find(([a]) => a === aulas_certeza)?.[1] ?? null,
      curva: curva.map(([aulas, probabilidad]) => ({
        aulas,
        probabilidad,
        rendimiento_medio: 0,
        rendimiento_p05: 0,
      })),
    }) as Parameters<typeof precisionVeredicto>[0];

  it("DERECHO: la probabilidad roza el umbral y aun así el veredicto es firme", () => {
    // p(18) = 95,12 % contra un umbral de 95 %: margen 0,12pp, doce veces menor
    // que su error. La vara vieja lo marcaba. Pero para que el mínimo bajara a
    // 17, p(17) tendría que subir de 28,29 % a 95 %.
    const r = precisionVeredicto(fila(18, 205, [[16, 0], [17, 0.2829], [18, 0.9512]]), 0.95);
    expect(r.corridas).toBe(205);
    expect(r.distancia).toBeCloseTo(0.6671, 3);
    expect(r.erroresHastaVoltear).toBeGreaterThan(20);
    expect(r.dentroDelRuido).toBe(false);
  });

  it("EE.GG. CIENCIAS: mismo caso, 13 errores estándar de holgura", () => {
    const r = precisionVeredicto(fila(22, 420, [[21, 0.6333], [22, 0.9595]]), 0.95);
    expect(r.erroresHastaVoltear).toBeGreaterThan(13);
    expect(r.dentroDelRuido).toBe(false);
  });

  it("CIENCIAS E INGENIERÍA: la más apretada de las tres, y aun así aguanta", () => {
    const r = precisionVeredicto(fila(34, 144, [[33, 0.875], [34, 0.9722]]), 0.95);
    expect(r.erroresHastaVoltear).toBeGreaterThan(2);
    expect(r.dentroDelRuido).toBe(false);
  });

  it("marca frágil el veredicto cuyo candidato anterior roza el nivel", () => {
    // Aquí sí: con p(n−1) = 94 % y 200 sorteos, medio punto de distancia es
    // menos de dos errores estándar y otra corrida podría dejar el mínimo abajo.
    const r = precisionVeredicto(fila(10, 200, [[9, 0.945], [10, 0.97]]), 0.95);
    expect(r.erroresHastaVoltear).toBeLessThan(2);
    expect(r.dentroDelRuido).toBe(true);
  });

  it("sin punto anterior no hay juicio que emitir, y no se inventa una alarma", () => {
    expect(precisionVeredicto(fila(3, 1000, [[3, 1]]), 0.95).erroresHastaVoltear).toBeNull();
    expect(precisionVeredicto(fila(3, 1000, [[3, 1]]), 0.95).dentroDelRuido).toBe(false);
    expect(precisionVeredicto(fila(10, 0, [[9, 0.9], [10, 0.96]]), 0.95).dentroDelRuido).toBe(false);
    expect(precisionVeredicto(null, 0.95).corridas).toBeNull();
  });
});

describe("el total con la regla de la casa: sube y no baja", () => {
  // Las quince facultades de HSVG 2026, medidas el 2026-08-27 en la pestaña
  // ¿Alcanza? al 95%: seis piden mas (+8) y tres piden menos (-6). El neto que
  // publica R es +2 → 167, pero el diseño no le quita tres aulas a Ciencias e
  // Ingenieria: sube ocho y se queda en 173. Las 174 ejecutadas son esas mas
  // una agregacion operativa en Derecho.
  const HSVG2026: ReadonlyArray<readonly [string, number, number]> = [
    ["DERECHO", 16, 18],
    ["ESTUDIOS GENERALES LETRAS", 18, 20],
    ["CIENCIAS CONTABLES", 2, 3],
    ["GESTIÓN Y ALTA DIRECCIÓN", 6, 7],
    ["LETRAS Y CIENCIAS HUMANAS", 3, 4],
    ["PSICOLOGÍA", 5, 6],
    ["CIENCIAS E INGENIERIA", 37, 34],
    ["ARTE Y DISEÑO", 15, 13],
    ["ARQUITECTURA Y URBANISMO", 8, 7],
    ["ARTES ESCÉNICAS", 8, 8],
    ["CIENCIAS SOCIALES", 12, 12],
    ["CIENCIAS Y ARTES DE LA COMUN.", 7, 7],
    ["EDUCACION", 3, 3],
    ["ESTUDIOS GENERALES CIENCIAS", 22, 22],
    ["GASTRONOMÍA, HOTELERÍA Y TURISMO", 3, 3],
  ];

  const vistaHsvg = () => certezaVistaDesdeEstado(
    certeza(
      HSVG2026.map(([label, formula, conCerteza], i) => fila({
        key: `f${i}`,
        label,
        aulas_formula: formula,
        aulas_certeza: conCerteza,
        brecha: conCerteza - formula,
      })),
      { total: { aulas_formula: 165, aulas_certeza: 167, brecha: 2, estratos_cortos: 6, estratos_agotados: 0, estratos_sin_ids: 0 } },
    ),
    "hash-vigente",
  );

  it("no baja donde la certeza dice que sobra: 173 y no 167", () => {
    const vista = vistaHsvg();
    expect(vista).not.toBeNull();
    expect(vista!.aulasFormula).toBe(165);
    expect(vista!.aulasCerteza).toBe(167);
    expect(vista!.aulasSoloSubidas).toBe(173);
    expect(vista!.brechaSoloSubidas).toBe(8);
    expect(vista!.aulasQueNoSeBajan).toBe(6);
  });

  it("sin facultades que sobren, el total con la regla coincide con el neto", () => {
    const vista = certezaVistaDesdeEstado(
      certeza(
        [
          fila({ key: "a", aulas_formula: 10, aulas_certeza: 12, brecha: 2 }),
          fila({ key: "b", aulas_formula: 5, aulas_certeza: 5, brecha: 0 }),
        ],
        { total: { aulas_formula: 15, aulas_certeza: 17, brecha: 2, estratos_cortos: 1, estratos_agotados: 0, estratos_sin_ids: 0 } },
      ),
      "hash-vigente",
    );
    expect(vista!.aulasSoloSubidas).toBe(17);
    expect(vista!.aulasQueNoSeBajan).toBe(0);
  });

  it("una brecha que no es un numero no mueve el total", () => {
    const vista = certezaVistaDesdeEstado(
      certeza(
        [
          fila({ key: "a", aulas_formula: 10, aulas_certeza: 12, brecha: 2 }),
          fila({ key: "b", aulas_formula: 5, aulas_certeza: null, brecha: null, alcanzable: false }),
        ],
        { total: { aulas_formula: 15, aulas_certeza: 17, brecha: 2, estratos_cortos: 1, estratos_agotados: 0, estratos_sin_ids: 0 } },
      ),
      "hash-vigente",
    );
    expect(vista!.aulasSoloSubidas).toBe(17);
    expect(vista!.brechaSoloSubidas).toBe(2);
  });
});
