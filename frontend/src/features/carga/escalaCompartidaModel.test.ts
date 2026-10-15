// G3: armonizar una escala una vez y llevarla a las preguntas que la comparten.
import { describe, expect, test } from "vitest";
import type { Armonizacion, EquivalenciaFila, OpcionDeEscala, VariableDeBase } from "../../api/equivalencias";
import { aFilasEditor } from "./equivalenciasEditorModel";
import {
  candidatosDeEscala,
  etiquetaTolerante,
  filasConEscalaAplicada,
  firmaTolerante,
  marcadosPorDefecto,
  textoAplicarA,
  traducirEntrada,
} from "./escalaCompartidaModel";

const op = (codigo: string, etiqueta: string): OpcionDeEscala => ({ codigo, etiqueta });

// 2024 rotula con tildes y signos; 2025 escribe en mayúsculas, sin tildes, y su «No sé» es 98.
const FREC_2024 = [op("1", "Nunca"), op("2", "Una vez"), op("3", "Dos a tres veces"), op("88", "No sé / Prefiero no decir")];
const FREC_2024_SUCIA = [op("1", "nunca."), op("2", "Una vez"), op("3", "Dos a tres veces"), op("88", "No se, prefiero no decir")];
const FREC_2025 = [op("1", "NUNCA"), op("2", "UNA VEZ"), op("3", "DOS A TRES VECES"), op("98", "NO SE / PREFIERO NO DECIR")];
const FREC_2025_99 = [op("1", "NUNCA"), op("2", "UNA VEZ"), op("3", "DOS A TRES VECES"), op("99", "NO SE / PREFIERO NO DECIR")];

const v = (name: string, opciones: OpcionDeEscala[]): VariableDeBase => ({ name, label: name, seccion: "", opciones });
const variablesPorBase: Record<string, VariableDeBase[]> = {
  "2024": [v("p1", FREC_2024), v("p2", FREC_2024_SUCIA), v("p3", FREC_2024), v("p4", FREC_2024), v("p5", FREC_2024), v("p6", FREC_2024), v("p7", FREC_2024)],
  "2025": [v("q1", FREC_2025), v("q2", FREC_2025), v("q3", FREC_2025_99), v("q4", FREC_2025), v("q5", FREC_2025), v("q6", FREC_2025), v("q7", FREC_2025)],
};
const bases = ["2024", "2025"];
const fila = (etiqueta: string, variables: Record<string, string>, extra: Partial<EquivalenciaFila> = {}): EquivalenciaFila => ({
  seccion: "", etiqueta_estandar: etiqueta, variables, cantidad: Object.keys(variables).length, ...extra,
});

const ESCALA = [
  { codigo: "1", etiqueta: "Nunca" },
  { codigo: "2", etiqueta: "Alguna vez" },
  { codigo: "9", etiqueta: "No sabe / No responde" },
];
// La fila de origen agrupa «Una vez» y «Dos a tres veces» y lleva el especial a 9.
const ORIGEN: Armonizacion = {
  escala: ESCALA,
  por_base: {
    "2024": { comparable: true, mapa: { "1": "1", "2": "2", "3": "2", "88": "9" } },
    "2025": { comparable: true, mapa: { "1": "1", "2": "2", "3": "2", "98": "9" } },
  },
};

const GUARDADAS: EquivalenciaFila[] = [
  fila("Origen", { "2024": "p1", "2025": "q1" }),
  fila("Tilde y puntuación", { "2024": "p2", "2025": "q2" }),
  fila("Otro especial en 2025", { "2024": "p3", "2025": "q3" }),
  fila("Ya armonizada distinta", { "2024": "p4", "2025": "q4" }, {
    armonizacion: { escala: [{ codigo: "1", etiqueta: "Nunca" }], por_base: { "2024": { comparable: true, mapa: {} } } },
  }),
  fila("Heredada", { "2024": "p5", "2025": "q5" }, { sugerida: true }),
  fila("Compuesta", { "2024": "p6", "2025": "q6" }, {
    derivada: { regla: "alguna", por_base: { "2024": { variables: ["p6"], codigos: ["1"] }, "2025": { variables: ["q6"], codigos: ["1"] } } },
  }),
  fila("Una sola base", { "2024": "p7" }),
  fila("Ya con esta", { "2024": "p5", "2025": "q7" }),
];
GUARDADAS[7] = { ...GUARDADAS[7], armonizacion: ORIGEN };

const calcular = (extra: { editor?: ReturnType<typeof aFilasEditor> | null; origen?: Armonizacion | null } = {}) =>
  candidatosDeEscala({
    indiceOrigen: 0,
    origen: extra.origen === undefined ? ORIGEN : extra.origen,
    guardadas: GUARDADAS,
    editor: extra.editor ?? null,
    bases,
    variablesPorBase,
  });

describe("firma tolerante", () => {
  test("ignora tildes, puntuación, mayúsculas, espacios y orden", () => {
    expect(etiquetaTolerante("  ¿No sé / *Prefiero*   no decir?")).toBe("no se prefiero no decir");
    expect(firmaTolerante(FREC_2024)).toBe(firmaTolerante(FREC_2024_SUCIA));
    expect(firmaTolerante([...FREC_2024].reverse())).toBe(firmaTolerante(FREC_2024));
  });

  test("el código cuenta, también el de los especiales", () => {
    expect(firmaTolerante(FREC_2025)).not.toBe(firmaTolerante(FREC_2025_99));
    expect(firmaTolerante([op("1", "Sí")])).not.toBe(firmaTolerante([op("2", "Sí")]));
  });

  test("sin lista no hay firma", () => {
    expect(firmaTolerante([])).toBe("");
    expect(firmaTolerante(undefined)).toBe("");
  });
});

describe("traducción del mapa", () => {
  test("cada código destino va a donde iba la opción del origen con su misma etiqueta", () => {
    const fuera = traducirEntrada(ORIGEN.por_base["2024"], FREC_2024, FREC_2024_SUCIA);
    expect(fuera).toEqual({ comparable: true, mapa: { "1": "1", "2": "2", "3": "2", "88": "9" } });
  });

  test("identidad se queda identidad y no comparable se copia con su nota", () => {
    expect(traducirEntrada({ comparable: true, mapa: {} }, FREC_2024, FREC_2024)).toEqual({ comparable: true, mapa: {} });
    expect(traducirEntrada({ comparable: false, nota: " Otra redacción ", mapa: { "1": "1" } }, FREC_2024, FREC_2024))
      .toEqual({ comparable: false, nota: "Otra redacción", mapa: {} });
  });

  test("una base sin declarar en el origen no se traduce", () => {
    expect(traducirEntrada(undefined, FREC_2024, FREC_2024)).toBeNull();
  });
});

describe("candidatos", () => {
  test("ofrece las que casan en todas sus bases y cuenta aparte las parciales", () => {
    const { candidatos, parciales } = calcular();
    expect(candidatos.map((c) => c.etiqueta)).toEqual(["Tilde y puntuación", "Ya armonizada distinta"]);
    expect(parciales).toBe(1); // «Otro especial en 2025»: 2024 casa, 2025 usa 99.
    expect(candidatos[0].armonizacion).toEqual(ORIGEN);
  });

  test("la que ya tiene armonización propia se ofrece, pero desmarcada", () => {
    const { candidatos } = calcular();
    expect(candidatos.find((c) => c.etiqueta === "Ya armonizada distinta")?.reemplaza).toBe(true);
    expect([...marcadosPorDefecto(candidatos)]).toEqual([1]);
  });

  test("no toca filas con cambios sin guardar", () => {
    const conCambio = aFilasEditor(GUARDADAS).map((f, i) => (i === 1 ? { ...f, variables: { ...f.variables, "2025": "q9" } } : f));
    expect(calcular({ editor: conCambio }).candidatos.map((c) => c.etiqueta)).toEqual(["Ya armonizada distinta"]);
    const sinLaFila = aFilasEditor(GUARDADAS).filter((f) => f.indice_declarado !== 1);
    expect(calcular({ editor: sinLaFila }).candidatos.map((c) => c.etiqueta)).toEqual(["Ya armonizada distinta"]);
  });

  test("sin escala en el origen, o con un origen compuesto, no hay nada que ofrecer", () => {
    expect(calcular({ origen: null }).candidatos).toEqual([]);
    expect(calcular({ origen: { escala: [], por_base: {} } }).candidatos).toEqual([]);
    expect(candidatosDeEscala({ indiceOrigen: 5, origen: ORIGEN, guardadas: GUARDADAS, editor: null, bases, variablesPorBase }).candidatos).toEqual([]);
  });

  test("guarda sólo las elegidas y deja las demás como estaban", () => {
    const { candidatos } = calcular();
    const out = filasConEscalaAplicada(GUARDADAS, candidatos, new Set([1]));
    expect(out[1].armonizacion).toEqual(ORIGEN);
    expect(out[3]).toBe(GUARDADAS[3]);
    expect(out.filter((f, i) => f !== GUARDADAS[i])).toHaveLength(1);
  });

  test("texto del botón", () => {
    expect(textoAplicarA(1)).toBe("Aplicar a 1 pregunta");
    expect(textoAplicarA(18)).toBe("Aplicar a 18 preguntas");
  });
});
