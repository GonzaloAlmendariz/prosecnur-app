import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { decision } from "../caracterizacion/escenarios";
import {
  MARCA_FICHA_FISICA,
  casosEnFicha,
  causaDeFicha,
  csvDeFicha,
  esFichaFisica,
  formDeFicha,
  filasDeFicha,
  lineaDeFicha,
  nCasosEnFicha,
  ordenarPorEncuesta,
  payloadDeFicha,
} from "./fichaFisica";
import { tablaDeCasos } from "./modeloHallazgos";

const marca = { [MARCA_FICHA_FISICA]: true };

const DRILL = {
  ok: true,
  regla: {
    id: "R1", nombre: "\"Edad\" entre 18 y 80", tipo_observacion: "constraint", tabla: "principal", variables: ["edad"],
    variable_roles: { target: "edad", drivers: [], compare: [], gate: [], labels: { edad: "Edad" } },
    value_labels: {},
  },
  uuid_col: "response_id",
  case_ids: ["c-10", "c-2", "c-9"],
  casos: [{ edad: 17 }, { edad: 84 }, { edad: null }],
  esperado: [
    { anomalia_tipo: "valor_invalido", subtipo: "restriccion", sujeto: null, hecho: "respondió \"17\" en Edad", choque: "que no cumple Edad entre 18 y 80" },
    null,
    null,
  ],
  contexto: { numero_encuesta: "n" },
  contexto_por_caso: [
    { fecha_respuesta: null, recopilador: null, numero_encuesta: "112", digitador: null },
    { fecha_respuesta: null, recopilador: null, numero_encuesta: "9", digitador: null },
    { fecha_respuesta: null, recopilador: null, numero_encuesta: null, digitador: null },
  ],
  n_casos_total: 3,
} as unknown as InstrumentoDrillResult;

describe("la marca de la ficha física", () => {
  it("es un borrador de ignorar con la marca: no corrige, no excluye y no cubre al hallazgo", () => {
    expect(esFichaFisica(decision("D1", { status: "draft", action_params: marca }))).toBe(true);
    // Lista, la decisión de ignorar sí cubre la regla entera: no es la marca.
    expect(esFichaFisica(decision("D2", { status: "ready", action_params: marca }))).toBe(false);
    expect(esFichaFisica(decision("D3", { status: "draft" }))).toBe(false);
    expect(esFichaFisica(decision("D4", { status: "draft", action_type: "exclude_cases", action_params: marca }))).toBe(false);
    expect(esFichaFisica(null)).toBe(false);
  });

  it("el cuerpo a guardar es un borrador con los casos nombrados y sin variable", () => {
    const cuerpo = payloadDeFicha({ id: "D1", sourceId: "R1", sourceType: "instrument_rule", casos: ["c-1", "c-2"], motivo: " Revisar la hoja 3 " });
    expect(cuerpo).toMatchObject({
      id: "D1", source_id: "R1", source_type: "instrument_rule", scope: "case_subset", target_case_ids: ["c-1", "c-2"],
      action_type: "ignore_rule", action_params: marca, rationale: "Revisar la hoja 3", status: "draft",
    });
    expect("target_variable" in cuerpo).toBe(false);
    expect("id" in payloadDeFicha({ id: "", sourceId: "R1", sourceType: "instrument_rule", casos: ["c-1"], motivo: "" })).toBe(false);
  });

  it("cuenta los casos distintos de las marcas de un hallazgo", () => {
    const ds = [
      decision("D1", { status: "draft", action_params: marca, target_case_ids: ["a", "b"] }),
      decision("D2", { status: "draft", action_params: marca, target_case_ids: ["b", "c"] }),
      decision("D3", { status: "ready", action_type: "exclude_cases", target_case_ids: ["z"] }),
    ];
    expect(casosEnFicha(ds[0]!)).toEqual(["a", "b"]);
    expect(nCasosEnFicha(ds)).toBe(3);
    expect(nCasosEnFicha([])).toBe(0);
  });

  it("dice por qué no se puede guardar", () => {
    expect(causaDeFicha({ todos: false, marcados: 0, sinId: 0, total: 5 })).toBe("Marca al menos un caso de la tabla.");
    expect(causaDeFicha({ todos: true, marcados: 0, sinId: 0, total: 0 })).toBe("El hallazgo no tiene casos.");
    expect(causaDeFicha({ todos: true, marcados: 0, sinId: 2, total: 5 })).toBe("2 casos no tienen identificador en la auditoría y no se pueden dejar para la ficha. Marca solo los que sí lo tienen.");
    expect(causaDeFicha({ todos: false, marcados: 1, sinId: 0, total: 5 })).toBeNull();
    expect(causaDeFicha({ todos: true, marcados: 0, sinId: 0, total: 5 })).toBeNull();
  });

  it("al abrir una marca, \"todos\" es nombrar todos los casos del hallazgo; si no, los marcados", () => {
    const form = { target_case_ids: ["a", "b"], use_all_cases: true, scope_mode: "all" as const };
    expect(formDeFicha(form, ["a", "b"])).toMatchObject({ use_all_cases: true, scope_mode: "all", target_case_ids: [] });
    expect(formDeFicha(form, ["a", "b", "c"])).toMatchObject({ use_all_cases: false, scope_mode: "selected", target_case_ids: ["a", "b"] });
    // Sin los casos del hallazgo todavía no se puede afirmar "todos": se conservan los ids.
    expect(formDeFicha(form, [])).toMatchObject({ use_all_cases: false, target_case_ids: ["a", "b"] });
  });

  it("escribe la línea del efecto con la concordancia", () => {
    expect(lineaDeFicha(1)).toBe("1 caso queda pendiente de la ficha física. La base no cambia.");
    expect(lineaDeFicha(12)).toBe("12 casos quedan pendientes de la ficha física. La base no cambia.");
  });
});

describe("la lista para la ficha física", () => {
  const tabla = tablaDeCasos(DRILL, null);
  const d = decision("D1", { status: "draft", action_params: marca, target_case_ids: ["c-10", "c-9", "c-2"], rationale: "Hoja 3 ilegible" });

  it("lleva el número de encuesta, la pregunta, el valor de la base y el motivo del caso", () => {
    const filas = filasDeFicha({ hallazgoId: "R1", hallazgo: "\"Edad\" entre 18 y 80", decisiones: [d], tabla });
    const c10 = filas.find((f) => f.caso === "c-10");
    expect(c10).toMatchObject({
      encuesta: "112", pregunta: "Edad", valor: "17", motivo: "\"Edad\" entre 18 y 80", nota: "Hoja 3 ilegible",
    });
    // Sin número de encuesta declarado en el caso, la llave del estudio.
    const c9 = filas.find((f) => f.caso === "c-9");
    expect(c9).toMatchObject({ encuesta: "c-9", valor: "Vacía", motivo: "\"Edad\" entre 18 y 80" });
  });

  it("el valor es el de la pregunta revisada, con su etiqueta; en una batería, lo que el motor midió", () => {
    const marcaA = decision("D1", { status: "draft", action_params: marca, target_case_ids: ["c-1"] });
    const fila = (valores: Record<string, string>) => ({ id: "c-1", clave: "c-1", valores, contexto: null, esperado: null });
    const col = (clave: string, tipo: "pregunta" | "falla", rotulo: string) => ({ clave, rotulo, tipo, numerica: false });
    const contexto = tabla.contexto;
    const formato = { columnas: [col("formato:ubigeo", "pregunta", "Ubigeo"), col("formato:motivo", "falla", "Formato")], filas: [fila({ "formato:ubigeo": "80105", "formato:motivo": "no es un número de 6 dígitos" })], contexto };
    expect(filasDeFicha({ hallazgoId: "R2", hallazgo: "Ubigeo de 6 dígitos", decisiones: [marcaA], tabla: formato, pregunta: { variable: "ubigeo", etiqueta: "Ubigeo del hogar" } })[0])
      .toMatchObject({ pregunta: "Ubigeo del hogar", valor: "80105" });
    const bateria = { columnas: [col("p1", "pregunta", "Afirmación 1"), col("bateria:patron", "falla", "En la batería")], filas: [fila({ p1: "Mucho (4)", "bateria:patron": "respondió \"Mucho\" en las 14 preguntas" })], contexto };
    expect(filasDeFicha({ hallazgoId: "R3", hallazgo: "Patrón en una batería", decisiones: [marcaA], tabla: bateria, pregunta: { variable: "p1", etiqueta: "Afirmación 1" } })[0])
      .toMatchObject({ pregunta: "En la batería", valor: "respondió \"Mucho\" en las 14 preguntas" });
    // Sin pregunta conocida se usa la columna que falla, con su rótulo.
    expect(filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [marcaA], tabla: { ...tabla, filas: [{ ...tabla.filas[0]!, id: "c-1" }] } })[0]).toMatchObject({ pregunta: "Edad", valor: "17" });
  });

  it("solo entran los casos marcados", () => {
    const solo = decision("D2", { status: "draft", action_params: marca, target_case_ids: ["c-2"] });
    expect(filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [solo], tabla }).map((f) => f.caso)).toEqual(["c-2"]);
    expect(filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [decision("D3", { status: "ready" })], tabla })).toEqual([]);
  });

  it("un caso marcado dos veces sale una sola vez", () => {
    const otra = decision("D2", { status: "draft", action_params: marca, target_case_ids: ["c-2"] });
    expect(filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [d, otra], tabla }).filter((f) => f.caso === "c-2")).toHaveLength(1);
  });

  it("ordena por número de encuesta, con las cifras como cifras", () => {
    const filas = filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [d], tabla });
    expect(ordenarPorEncuesta(filas).map((f) => f.encuesta)).toEqual(["9", "112", "c-9"]);
  });

  it("el CSV lleva su cabecera, escapa las comillas y deja la nota solo si alguien la escribió", () => {
    const filas = ordenarPorEncuesta(filasDeFicha({ hallazgoId: "R1", hallazgo: "Motivo con \"comillas\"", decisiones: [d], tabla }));
    const csv = csvDeFicha(filas);
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe("N.º de encuesta,Pregunta,Valor en la base,Motivo,Nota");
    expect(lineas[1]).toBe("\"9\",\"Edad\",\"84\",\"Motivo con \"\"comillas\"\"\",\"Hoja 3 ilegible\"");
    const sinNota = filasDeFicha({ hallazgoId: "R1", hallazgo: "H", decisiones: [{ ...d, rationale: "" }], tabla });
    expect(csvDeFicha(sinNota).split("\n")[0]).toBe("N.º de encuesta,Pregunta,Valor en la base,Motivo");
  });
});
