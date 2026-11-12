// Reglas de fechas y horas: la frase en vivo (las mismas palabras que el
// catálogo del motor, test-validacion-regla-fechas.R), lo que se guarda, la
// validación del borrador (mismos límites que el esquema), lo leído por caso y
// la lectura del conteo previo, y las columnas de Hallazgos.
import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { normalizarPruebaDeRegla } from "../../../api/validacionAuditoria";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { tablaDeCasos } from "../hallazgos/modeloHallazgos";
import { formatoConteo } from "../../../lib/formatoNumero";
import { borradorInicial, cuerpoParaProbar, nombreDelBorrador, reducirBorrador, validarBorrador, variablesEfectivas } from "./borradorDeRegla";
import { fechaMostrada, paramsDeComparar, textoDeFechas, textoDeLectura, validarFechas, variablesDeComparar } from "./modeloFechas";
import { opcionesDeFormato } from "./panel/CamposDeFechas";
import { metaDeTipo, tiposDelGrupo } from "./tiposDeRegla";

const FIN_AMPM = { variables: ["h", "mi", "ampm"], partes: "hora_minutos_ampm", am: ["1"], pm: ["2"] };

function horas(patron: "orden" | "duracion", extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { unidad: "hora", patron, inicio: { variables: ["h_ini"], partes: "una", formato: "hh.mm" }, fin: FIN_AMPM, ...extra };
}

function frase(tipo: "rango_fecha" | "comparar_fechas", params: Record<string, unknown>, variables: readonly string[] = []): string | null {
  const vars = tipo === "comparar_fechas" ? variablesDeComparar(params) : variables;
  const piezas = fraseDeReglaPropia({ tipo, variables: vars, params });
  return piezas ? fraseEnTexto(piezas) : null;
}

const RANGO = { min: "2026-10-08", max: "2026-10-31" };

describe("frase en vivo de las reglas de fechas", () => {
  it("dice las mismas palabras que el catálogo del motor", () => {
    expect(frase("rango_fecha", { ...RANGO, formato: "dd.mm.aaaa" }, ["fecha"])).toBe(
      "Se marca cuando fecha es anterior al 08/10/2026 o es posterior al 31/10/2026. fecha se lee como dd.mm.aaaa. También se marca una fecha que no se puede leer.",
    );
    expect(frase("rango_fecha", { ...RANGO, marcar_ilegibles: false }, ["fecha"])).toBe(
      "Se marca cuando fecha es anterior al 08/10/2026 o es posterior al 31/10/2026.",
    );
    expect(frase("comparar_fechas", horas("orden"))).toBe(
      "Se marca cuando la hora armada con h, mi y ampm es anterior a h_ini. h_ini se lee como hh.mm. También se marca una hora incompleta o que no se puede leer.",
    );
    expect(frase("comparar_fechas", horas("duracion", { minimo: 11, maximo: 90, marcar_ilegibles: false }))).toBe(
      "Se marca cuando entre h_ini y la hora armada con h, mi y ampm pasan menos de 11 o más de 90 minutos. h_ini se lee como hh.mm.",
    );
  });

  it("una fecha repartida se nombra con sus tres preguntas", () => {
    expect(frase("rango_fecha", { min: "2026-10-08", partes: "dia_mes_anio", marcar_ilegibles: false }, ["dia", "mes", "anio"])).toBe(
      "Se marca cuando la fecha armada con dia, mes y anio es anterior al 08/10/2026.",
    );
  });

  it("sin todas sus preguntas o sin límites no hay frase todavía", () => {
    expect(frase("rango_fecha", { partes: "dia_mes_anio", min: "2026-10-08" }, ["dia", ""])).toBeNull();
    expect(frase("comparar_fechas", horas("duracion"))).toBeNull();
  });
});

describe("lo que se guarda y lo que falta", () => {
  it("las preguntas son las del inicio y luego las del fin, como exige el motor", () => {
    expect(variablesDeComparar(horas("orden"))).toEqual(["h_ini", "h", "mi", "ampm"]);
    expect(paramsDeComparar(horas("duracion", { minimo: "11" }))).toEqual({
      unidad: "hora",
      patron: "duracion",
      inicio: { variables: ["h_ini"], partes: "una", formato: "hh.mm" },
      fin: { variables: ["h", "mi", "ampm"], partes: "hora_minutos_ampm", am: ["1"], pm: ["2"] },
      minimo: 11,
      marcar_ilegibles: true,
    });
    // En orden no viaja la duración.
    expect(paramsDeComparar(horas("orden", { minimo: 11 }))).not.toHaveProperty("minimo");
  });

  it("valida con los mismos límites que el esquema del motor", () => {
    expect(validarFechas("comparar_fechas", horas("orden"), [])).toBe("");
    expect(validarFechas("comparar_fechas", horas("duracion"), [])).toBe("Define la duración mínima, la máxima o ambas.");
    expect(validarFechas("comparar_fechas", horas("duracion", { minimo: 90, maximo: 10 }), [])).toBe(
      "La duración mínima no puede ser mayor que la máxima.",
    );
    expect(validarFechas("comparar_fechas", horas("orden", { fin: { ...FIN_AMPM, variables: ["h", "", "ampm"] } }), [])).toBe(
      "Elige todas las preguntas del fin.",
    );
    expect(validarFechas("comparar_fechas", horas("orden", { fin: { ...FIN_AMPM, pm: ["1"] } }), [])).toBe(
      "Un código del fin no puede valer a.m. y p.m. a la vez.",
    );
    expect(validarFechas("rango_fecha", { partes: "dia_mes_anio" }, ["dia", "mes"])).toBe("Elige todas las preguntas de la fecha.");
  });

  it("el borrador cuenta las preguntas del inicio y del fin y se nombra con la primera de cada uno", () => {
    let b = borradorInicial({ inicial: null, tipo: "comparar_fechas", pregunta: "f_entrev" });
    expect(b.params.inicio).toEqual({ variables: ["f_entrev"], partes: "una", formato: "auto" });
    expect(validarBorrador(b)).toBe("Elige la pregunta del fin.");
    b = reducirBorrador(b, { tipo: "param", clave: "fin", valor: { variables: ["superv"], partes: "una", formato: "dd.mm.aa" } });
    expect(validarBorrador(b)).toBe("");
    expect(variablesEfectivas(b)).toEqual(["f_entrev", "superv"]);
    expect(cuerpoParaProbar(b)?.variables).toEqual(["f_entrev", "superv"]);
    expect(nombreDelBorrador(b, [{ name: "f_entrev", label: "Fecha de entrevista", tipo: "texto", n_validos: 1, n_nulos: 0 }])).toBe(
      "Dos fechas u horas que deben cuadrar: \"Fecha de entrevista\" y superv",
    );
  });

  it("la tesela vive con los rangos y fechas, y el formato se elige de la lista del motor", () => {
    expect(tiposDelGrupo("respuesta", null).map((t) => t.key)).toContain("comparar_fechas");
    expect(metaDeTipo("rango_fecha")?.nVars).toEqual([1, 3]);
    expect(opcionesDeFormato("fecha").map((o) => o.value)).toEqual([
      "auto", "aaaa-mm-dd", "dd/mm/aaaa", "dd.mm.aaaa", "dd-mm-aaaa", "dd/mm/aa", "dd.mm.aa", "dd-mm-aa", "mm/dd/aaaa",
    ]);
    expect(opcionesDeFormato("hora")[0]).toEqual({ value: "auto", label: "Detectar en cada respuesta" });
  });
});

describe("lo leído en el conteo previo", () => {
  const prueba = normalizarPruebaDeRegla({
    estado: "evaluada",
    evaluada: true,
    n_filas: 8,
    n_base: 8,
    n_casos: 2,
    lectura: [
      {
        momento: "fecha", variables: ["fecha"], partes: "una", formato: "dd.mm.aaaa",
        formatos: [{ formato: "dd.mm.aaaa", n: 995 }], n_leidas: 995, n_vacias: 4, n_incompletas: 0, n_ilegibles: 1, n_filas: 1000,
      },
      { momento: "otro" },
    ],
    ejemplos: [
      {
        id_caso: "c12",
        valores: [{ variable: "fecha", valor: "15.10.28", papel: "revisada", falla: true }],
        fechas: {
          unidad: "fecha", patron: "rango", motivo: "despues", diferencia: null,
          inicio: { texto: "2028-10-15", estado: "leida", formato: "dd.mm.aa", original: "15.10.28" },
        },
      },
      { id_caso: "c01", valores: [], fechas: { unidad: "fecha", patron: "rango", inicio: { estado: "raro" } } },
    ],
  });

  it("normaliza lo que llega y no inventa lo que no se entiende", () => {
    expect(prueba.lectura).toHaveLength(1);
    expect(prueba.ejemplos[0].fechas?.motivo).toBe("despues");
    expect(prueba.ejemplos[0].fechas?.fin).toBeNull();
    expect(prueba.ejemplos[1].fechas).toBeUndefined();
  });

  it("dice el formato con que se leyó y lo que no se pudo leer, con su base", () => {
    expect(textoDeLectura(prueba.lectura![0])).toBe(`se leyó como dd.mm.aaaa en 995 de ${formatoConteo(1000)} respuestas; 1 no se pudo leer y 4 vacías.`);
    expect(
      textoDeLectura({
        momento: "fin", variables: ["h", "mi", "ampm"], partes: "hora_minutos_ampm", formato: "auto", formatos: [{ formato: "hora_minutos_ampm", n: 988 }],
        n_leidas: 988, n_vacias: 2, n_incompletas: 9, n_ilegibles: 1, n_filas: 1000,
      }),
    ).toBe(`se armó con hora, minutos y a.m./p.m. en 988 de ${formatoConteo(1000)} respuestas; 9 incompletas, 1 no se pudo leer y 2 vacías.`);
    expect(
      textoDeLectura({
        momento: "fecha", variables: ["f"], partes: "una", formato: "auto",
        formatos: [{ formato: "dd.mm.aaaa", n: 995 }, { formato: "dd.mm.aa", n: 1 }],
        n_leidas: 996, n_vacias: 0, n_incompletas: 0, n_ilegibles: 0, n_filas: 996,
      }),
    ).toBe("se leyó como dd.mm.aaaa (995) y dd.mm.aa (1) en 996 de 996 respuestas.");
  });

  it("cada caso dice lo leído, con el texto original, y por qué marca", () => {
    expect(textoDeFechas(prueba.ejemplos[0].fechas!)).toBe("\"15.10.28\" (15/10/2028), después del cierre");
    const lado = (texto: string | null, original: string, estado: "leida" | "ilegible" | "incompleta" = "leida") => ({ texto, estado, formato: null, original });
    expect(textoDeFechas({ unidad: "hora", patron: "orden", motivo: "orden", diferencia: -15, inicio: lado("10:30", "10.3"), fin: lado("10:15", "10, 15, 1") })).toBe(
      "Fin 10:15, antes del inicio 10:30",
    );
    expect(textoDeFechas({ unidad: "hora", patron: "duracion", motivo: "larga", diferencia: 165, inicio: lado("13:45", "13.45"), fin: lado("16:30", "4, 30, 2") })).toBe(
      "165 minutos (13:45 a 16:30)",
    );
    expect(textoDeFechas({ unidad: "fecha", patron: "rango", motivo: "ilegible", diferencia: null, inicio: lado(null, "16.10.2", "ilegible"), fin: null })).toBe(
      "\"16.10.2\" no se puede leer",
    );
    expect(textoDeFechas({ unidad: "hora", patron: "orden", motivo: "ilegible", diferencia: null, inicio: lado("11:00", "11.00"), fin: lado(null, "1, 15, ", "incompleta") })).toBe(
      "Incompleta (\"1, 15, \")",
    );
    expect(fechaMostrada("2026-10-08")).toBe("08/10/2026");
  });
});

describe("Hallazgos", () => {
  it("muestra las preguntas con su texto original y al final lo leído por el motor", () => {
    const drill = {
      ok: true,
      regla: {
        id: "RC_FEC",
        familia: "comparar_fechas",
        variable_roles: { target: "h_ini", compare: ["h", "mi", "ampm"], labels: { h_ini: "Hora de inicio" } },
        value_labels: { ampm: { "1": "AM", "2": "PM" } },
      },
      casos: [{ h_ini: "10.3", h: 10, mi: 15, ampm: 1 }],
      case_ids: ["c12"],
      esperado: [{ subtipo: "fechas", hecho: "registró 10:15 en la hora armada con h, mi y ampm", choque: "anterior a \"10.3\" (10:30) en Hora de inicio" }],
    } as unknown as InstrumentoDrillResult;
    const t = tablaDeCasos(drill, null);
    expect(t.columnas.map((c) => [c.clave, c.tipo])).toEqual([
      ["h_ini", "pregunta"],
      ["h", "pregunta"],
      ["mi", "pregunta"],
      ["ampm", "pregunta"],
      ["fechas:lectura", "falla"],
    ]);
    expect(t.filas[0].id).toBe("c12");
    expect(t.filas[0].valores["h_ini"]).toBe("10.3");
    expect(t.filas[0].valores["ampm"]).toBe("AM (1)");
    expect(t.filas[0].valores["fechas:lectura"]).toBe(
      "registró 10:15 en la hora armada con h, mi y ampm, anterior a \"10.3\" (10:30) en Hora de inicio",
    );
  });
});
