/**
 * Escribir muchas reglas parecidas sin volver a armarlas (ítem 44 del checklist
 * del practicante): duplicar una regla, el operador "es una de", cambiar de tipo
 * sin perder lo escrito y el nombre corto de una regla nueva.
 */
import { describe, expect, it } from "vitest";
import type { ExploradorVariable, ReglaCustom } from "../types";
import {
  borradorComoNuevo,
  borradorInicial,
  cuerpoAGuardar,
  nombreDelBorrador,
  reducirBorrador,
  type Borrador,
} from "./borradorDeRegla";
import { conservarAlCambiarDeTipo } from "./cambioDeTipo";
import { copiaParaDuplicar, ORIGEN_COPIA } from "./duplicarRegla";
import { ordenarValoresPorEscala } from "./escalaDeOpciones";
import { leerOperador, leerOperadorNegado, opcionesDeOperador } from "./operadores";
import { operatorOptionsForVariable } from "./modeloRegla";
import type { ReglaPropia } from "./tiposDelMotor";

const aplicar = (b: Borrador, ...acciones: Parameters<typeof reducirBorrador>[1][]) => acciones.reduce(reducirBorrador, b);

const ENUNCIADO = "P10. ¿Con quiénes vives? (Marca todas las opciones que correspondan. Si vives solo/a, marca solo esa opción)";
const VARIABLES: ExploradorVariable[] = [
  { name: "P4", label: "P4. ¿Estudias o trabajas actualmente?", tipo: "so", n_validos: 10, n_nulos: 0 },
  { name: "P10", label: ENUNCIADO, tipo: "sm", n_validos: 10, n_nulos: 0 },
  { name: "P8_6", label: "P8. Siento que mi opinión importa: 6. En mi universidad", tipo: "so", n_validos: 10, n_nulos: 0 },
  { name: "P16_7", label: "P16. Confío en las instituciones: 7. En el municipio", tipo: "so", n_validos: 10, n_nulos: 0 },
];

function propia(cambios: Partial<ReglaCustom> = {}): ReglaCustom {
  return {
    id: "RC_007",
    created_at: "2026-11-12T10:00:00Z",
    activa: true,
    nombre: 'Condiciones combinadas: "P8_6" y "P16_7"',
    tipo: "condiciones" as ReglaCustom["tipo"],
    variables: ["P8_6", "P16_7"],
    params: {
      modo: "todas",
      condiciones: [
        { variable: "P8_6", op: "in", valor: ["6", "7"] },
        { variable: "P16_7", op: "in", valor: ["6", "7"] },
      ],
    },
    mensaje: 'Condiciones combinadas: "P8_6" y "P16_7"',
    severidad: "advertencia",
    hallazgo_kind: "caso_validar",
    planned_action_type: "ignore_rule",
    recommended_scope: "single",
    gate_conditions: [],
    ...cambios,
  };
}

describe("operador de opción única: es una de", () => {
  it("se lee 'es una de' y 'no es ninguna de', no 'está entre'", () => {
    expect(leerOperador("in")).toBe("es una de");
    expect(leerOperador("not_in")).toBe("no es ninguna de");
    expect(leerOperador("in", "esperado")).toBe("sea una de");
    expect(leerOperador("not_in", "esperado")).toBe("no sea ninguna de");
    expect(leerOperadorNegado("in")).toBe("no es ninguna de");
    expect(leerOperadorNegado("not_in")).toBe("es una de");
  });

  it("la lista de una pregunta de opción única ofrece los nombres nuevos y guarda los mismos valores", () => {
    const so: ExploradorVariable = { name: "P4", label: "P4", tipo: "so", n_validos: 1, n_nulos: 0 };
    const opciones = opcionesDeOperador(so);
    expect(opciones.find((o) => o.value === "in")?.label).toBe("es una de");
    expect(opciones.find((o) => o.value === "not_in")?.label).toBe("no es ninguna de");
    expect(operatorOptionsForVariable(so).map((o) => o.value)).toEqual(expect.arrayContaining(["in", "not_in"]));
  });

  it("una regla guardada con 'in' se abre y se guarda igual", () => {
    const inicial = propia() as unknown as ReglaPropia;
    const cuerpo = cuerpoAGuardar(borradorInicial({ inicial }), inicial);
    expect(cuerpo?.params).toEqual(inicial.params);
  });
});

describe("las opciones de la frase van en el orden de la escala", () => {
  const escala = [
    { code: "1", label: "Fuertemente en desacuerdo", n: 1 },
    { code: "5", label: "Neutral", n: 1 },
    { code: "6", label: "De acuerdo", n: 1 },
    { code: "7", label: "Fuertemente de acuerdo", n: 1 },
  ];

  it("ordena por la escala y deja al final lo que la escala no conoce", () => {
    const params = { condiciones: [{ variable: "P8_6", op: "in", valor: ["7", "99", "6"] }] };
    const { params: salida } = ordenarValoresPorEscala({ variables: [], params, gate_conditions: [] }, new Map([["P8_6", escala]]));
    expect(salida.condiciones).toEqual([{ variable: "P8_6", op: "in", valor: ["6", "7", "99"] }]);
  });

  it("ordena los dos lados de una coherencia y el filtro", () => {
    const mapa = new Map([["a", escala], ["b", escala], ["f", escala]]);
    const r = ordenarValoresPorEscala(
      { variables: ["a", "b"], params: { valor_x: ["7", "6"], valor_y: "5" }, gate_conditions: [{ variable: "f", op: "in", value: ["7", "1"] }] },
      mapa,
    );
    expect(r.params).toEqual({ valor_x: ["6", "7"], valor_y: "5" });
    expect(r.gate_conditions[0].value).toEqual(["1", "7"]);
  });

  it("no toca la regla original", () => {
    const params = { valor_x: ["7", "6"] };
    ordenarValoresPorEscala({ variables: ["a"], params, gate_conditions: [] }, new Map([["a", escala]]));
    expect(params.valor_x).toEqual(["7", "6"]);
  });
});

describe("duplicar una regla propia", () => {
  it("la copia llega llena, sin id, sin nombre y sin marca de sugerida", () => {
    const copia = copiaParaDuplicar(propia());
    expect(copia).not.toHaveProperty("id");
    expect(copia.nombre).toBe("");
    expect(copia.mensaje).toBe("");
    expect(copia.params).toEqual(propia().params);
    expect(copia.params).not.toBe(propia().params);
    expect(copia.semilla.origen).toBe(ORIGEN_COPIA);
  });

  it("el borrador de la copia es nuevo, se nombra solo y se guarda como regla manual", () => {
    const b = borradorInicial({ inicial: null, semilla: copiaParaDuplicar(propia()) });
    expect(b.nueva).toBe(true);
    expect(b.semilla).toBeNull();
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Condiciones combinadas: P8_6 y P16_7");
    const cuerpo = cuerpoAGuardar(b, null);
    expect(cuerpo).not.toHaveProperty("id", "RC_007");
    expect(cuerpo?.origen).toBeUndefined();
    expect(cuerpo?.hallazgo_kind).toBe("caso_validar");
  });

  it("cambiar una pregunta de la copia cambia el nombre automático", () => {
    let b = borradorInicial({ inicial: null, semilla: copiaParaDuplicar(propia()) });
    const condiciones = (b.params.condiciones as Array<Record<string, unknown>>).map((c, i) => (i === 1 ? { ...c, variable: "P4" } : c));
    b = aplicar(b, { tipo: "params", valor: { ...b.params, condiciones } });
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Condiciones combinadas: P8_6 y P4");
  });
});

describe("Guardar como nueva", () => {
  it("guarda lo que hay en pantalla como regla nueva y deja la original", () => {
    const inicial = propia() as unknown as ReglaPropia;
    let b = borradorInicial({ inicial });
    const condiciones = (b.params.condiciones as Array<Record<string, unknown>>).map((c, i) => (i === 1 ? { ...c, variable: "P4" } : c));
    b = aplicar(b, { tipo: "params", valor: { ...b.params, condiciones } });
    const nueva = borradorComoNuevo(b, inicial.nombre);
    const cuerpo = cuerpoAGuardar(nueva, null);
    expect(cuerpo?.id).toBeUndefined();
    expect(cuerpo?.nombre).toBe("Condiciones combinadas: P8_6 y P4");
    expect(cuerpo?.variables).toEqual(["P8_6", "P4"]);
    // La original no cambia.
    expect(cuerpoAGuardar(borradorInicial({ inicial }), inicial)?.nombre).toBe(inicial.nombre);
  });

  it("conserva el nombre que alguien escribió", () => {
    const inicial = propia() as unknown as ReglaPropia;
    const b = aplicar(borradorInicial({ inicial }), { tipo: "nombre", valor: "1.2.1" });
    expect(cuerpoAGuardar(borradorComoNuevo(b, inicial.nombre), null)?.nombre).toBe("1.2.1");
  });
});

describe("Cambiar de tipo conserva lo compatible", () => {
  const coherencia: ReglaPropia = {
    ...(propia() as unknown as ReglaPropia),
    tipo: "coherencia_2v",
    variables: ["P4", "P21"],
    params: { op_x: "==", valor_x: "1", op_y: "not_in", valor_y: ["4", "5", "6", "8"] },
  };

  it("de dos respuestas a condiciones combinadas: la primera condición y la segunda, negada", () => {
    const b = aplicar(borradorInicial({ inicial: coherencia }), { tipo: "elegir-tipo", valor: "condiciones" });
    expect(b.tipo).toBe("condiciones");
    expect(b.params).toEqual({
      modo: "todas",
      condiciones: [
        { variable: "P4", op: "==", valor: "1" },
        { variable: "P21", op: "in", valor: ["4", "5", "6", "8"] },
      ],
    });
  });

  it("de condiciones a dos respuestas: las dos primeras, la segunda vuelve a negarse", () => {
    const origen = borradorInicial({ inicial: propia({
      params: { modo: "todas", condiciones: [
        { variable: "P4", op: "==", valor: "1" },
        { variable: "P21", op: "in", valor: ["4", "5"] },
      ] },
    }) as unknown as ReglaPropia });
    const b = aplicar(origen, { tipo: "elegir-tipo", valor: "coherencia_2v" });
    expect(b.variables).toEqual(["P4", "P21"]);
    expect(b.params).toMatchObject({ op_x: "==", valor_x: "1", op_y: "not_in", valor_y: ["4", "5"] });
  });

  it("compara con otra pregunta: la conserva con el operador negado", () => {
    const r = conservarAlCambiarDeTipo(
      { tipo: "coherencia_2v", variables: ["a", "b"], params: { op_x: "==", valor_x: "1", op_y: ">=", valor_y_variable: "c" } },
      "condiciones",
    );
    expect(r?.params).toEqual({
      modo: "todas",
      condiciones: [
        { variable: "a", op: "==", valor: "1" },
        { variable: "b", op: "<", variable_comparada: "c" },
      ],
    });
  });

  it("sin operador en el segundo lado, deja la fila con su pregunta para completarla", () => {
    const r = conservarAlCambiarDeTipo({ tipo: "coherencia_2v", variables: ["a", "b"], params: { op_x: "==", valor_x: "1" } }, "condiciones");
    expect(r?.params).toEqual({
      modo: "todas",
      condiciones: [
        { variable: "a", op: "==", valor: "1" },
        { variable: "b", op: "", valor: "" },
      ],
    });
  });

  it("entre tipos de una pregunta se conservan las preguntas hasta el máximo del nuevo", () => {
    const b = aplicar(
      borradorInicial({ inicial: { ...coherencia, tipo: "duplicados", variables: ["P4", "P21"], params: {} } }),
      { tipo: "elegir-tipo", valor: "rango_num" },
    );
    expect(b.variables).toEqual(["P4"]);
    const c = aplicar(
      borradorInicial({ inicial: { ...coherencia, tipo: "rango_num", variables: ["P4"], params: {} } }),
      { tipo: "elegir-tipo", valor: "duplicados" },
    );
    expect(c.variables).toEqual(["P4"]);
  });

  it("el nombre, el detalle y la clase no se pierden al cambiar", () => {
    const origen = aplicar(borradorInicial({ inicial: coherencia }), { tipo: "nombre", valor: "1.2.1" }, { tipo: "mensaje", valor: "Detalle" });
    const b = aplicar(origen, { tipo: "elegir-tipo", valor: "condiciones" });
    expect(b.nombre).toBe("1.2.1");
    expect(b.mensaje).toBe("Detalle");
    expect(b.hallazgoKind).toBe(coherencia.hallazgo_kind);
  });
});

describe("nombre automático corto", () => {
  it("usa el tipo y el código de la pregunta, no el enunciado", () => {
    const b = borradorInicial({ inicial: null, tipo: "rango_num", pregunta: "P4" });
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Valor fuera de rango: P4");
  });

  it("dos preguntas: sus códigos unidos con 'y'", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "duplicados", pregunta: "P10" }), { tipo: "variables", valor: ["P10", "P4"] });
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Respuestas repetidas: P10 y P4");
  });

  it("una pregunta de batería se nombra por su código", () => {
    const b = borradorInicial({ inicial: null, tipo: "no_nulo", pregunta: "P8_6" });
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Respuesta obligatoria: P8_6");
  });
});
