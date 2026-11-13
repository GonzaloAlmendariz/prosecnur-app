import { describe, expect, it } from "vitest";
import type { ExploradorVariable } from "../types";
import {
  borradorInicial,
  cuerpoAGuardar,
  cuerpoParaProbar,
  lectorDeTipos,
  nombreDelBorrador,
  reducirBorrador,
  validarBorrador,
  type Borrador,
} from "./borradorDeRegla";
import type { ReglaPropia } from "./tiposDelMotor";

const VARIABLES: ExploradorVariable[] = [
  { name: "p4", label: "Año de egreso", tipo: "num", n_validos: 10, n_nulos: 0 },
  { name: "p3a", label: "Año de ingreso", tipo: "num", n_validos: 10, n_nulos: 0 },
  { name: "sexo", label: "Sexo", tipo: "so", n_validos: 10, n_nulos: 0 },
];
const tipos = lectorDeTipos(VARIABLES);

function regla(cambios: Partial<ReglaPropia> = {}): ReglaPropia {
  return {
    id: "RC_001",
    created_at: "2026-03-01T10:00:00Z",
    activa: true,
    nombre: "Edad entre 16 y 25",
    tipo: "rango_num",
    variables: ["edad"],
    params: { min: "16", max: "25" },
    mensaje: "Edad fuera del rango del estudio",
    severidad: "error",
    hallazgo_kind: "inconsistencia_usuario",
    planned_action_type: "ignore_rule",
    recommended_scope: "single",
    gate_conditions: [],
    ...cambios,
  };
}

const aplicar = (b: Borrador, ...acciones: Parameters<typeof reducirBorrador>[1][]) => acciones.reduce(reducirBorrador, b);

describe("lo que se guarda", () => {
  it("abrir y guardar sin tocar entrega el cuerpo del asistente, con sus claves en orden", () => {
    const inicial = regla();
    const cuerpo = cuerpoAGuardar(borradorInicial({ inicial }), inicial, tipos);
    expect(JSON.stringify(cuerpo)).toBe(
      '{"id":"RC_001","activa":true,"nombre":"Edad entre 16 y 25","tipo":"rango_num","variables":["edad"],"params":{"min":"16","max":"25"},"mensaje":"Edad fuera del rango del estudio","severidad":"error","hallazgo_kind":"inconsistencia_usuario","planned_action_type":"ignore_rule","recommended_scope":"single","gate_expr":"","gate_conditions":[]}',
    );
  });

  it("una regla nueva no lleva id y se nombra sola si nadie la nombra", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "rango_num", pregunta: "p4" }), { tipo: "param", clave: "min", valor: "2000" });
    const cuerpo = cuerpoAGuardar(b, null, tipos);
    expect(cuerpo?.id).toBeUndefined();
    expect(cuerpo?.nombre).toBe("Valor fuera de rango: p4");
    expect(cuerpo?.mensaje).toBe("Valor fuera de rango: p4");
    expect(nombreDelBorrador(b)).toBe("Valor fuera de rango: p4");
  });

  it("elegir una clase cambia la severidad; no elegirla conserva la que traía", () => {
    const inicial = regla({ severidad: "error", hallazgo_kind: "caso_validar" });
    expect(cuerpoAGuardar(borradorInicial({ inicial }), inicial)?.severidad).toBe("error");
    const cambiada = aplicar(borradorInicial({ inicial }), { tipo: "clase", valor: "caso_validar" });
    expect(cuerpoAGuardar(cambiada, inicial)?.severidad).toBe("advertencia");
  });

  it("un tratamiento que no vale para el tipo se guarda como el primero que sí", () => {
    const inicial = regla({ tipo: "duplicados", variables: ["dni"], params: {}, planned_action_type: "replace_value" });
    expect(cuerpoAGuardar(borradorInicial({ inicial }), inicial)?.planned_action_type).toBe("exclude_cases");
  });

  it("Condiciones combinadas: modo, condiciones contra valor y contra otra pregunta, y sus preguntas", () => {
    const b = aplicar(
      borradorInicial({ inicial: null, tipo: "condiciones" }),
      {
        tipo: "params",
        valor: {
          modo: "alguna",
          condiciones: [
            { variable: "p4", op: "<", variable_comparada: "p3a" },
            { variable: "p4", op: ">", valor: "2026" },
            { variable: "sexo", op: "in", valor: ["1", "2"] },
          ],
        },
      },
    );
    expect(validarBorrador(b)).toBe("");
    const cuerpo = cuerpoAGuardar(b, null, tipos);
    expect(cuerpo?.params).toEqual({
      modo: "alguna",
      condiciones: [
        { variable: "p4", op: "<", variable_comparada: "p3a" },
        // Número en una pregunta numérica: con texto, R compararía letra por letra.
        { variable: "p4", op: ">", valor: 2026 },
        { variable: "sexo", op: "in", valor: ["1", "2"] },
      ],
    });
    expect(cuerpo?.variables).toEqual(["p4", "p3a", "sexo"]);
    expect(cuerpo?.planned_action_type).toBe("ignore_rule");
    expect(cuerpo?.recommended_scope).toBe("single");
  });

  it("Condiciones combinadas: valida cada condición por su número", () => {
    const base = borradorInicial({ inicial: null, tipo: "condiciones" });
    const con = (condiciones: unknown[]) => aplicar(base, { tipo: "params", valor: { modo: "todas", condiciones } });
    expect(validarBorrador(con([]))).toBe("Agrega al menos una condición.");
    expect(validarBorrador(con([{ variable: "p4", op: ">", valor: "1" }, { variable: "p4", op: "==", valor: "" }]))).toBe(
      "La condición 2 no tiene valor.",
    );
    expect(validarBorrador(con([{ variable: "p4", op: ">", variable_comparada: "p4" }]))).toBe(
      "La condición 1 compara una pregunta consigo misma.",
    );
    expect(validarBorrador(con([{ variable: "p4", op: "in", variable_comparada: "p3a" }]))).toBe(
      "La condición 1 compara con otra pregunta: usa es, no es, mayor o menor.",
    );
  });

  it("Dos respuestas que deben cuadrar contra otra pregunta: valor_y_variable reemplaza a valor_y", () => {
    const inicial = regla({
      tipo: "coherencia_2v",
      variables: ["p4", "p3a"],
      params: { op_x: "==", valor_x: "1", op_y: "<", valor_y: "3" },
    });
    const b = aplicar(borradorInicial({ inicial }), { tipo: "params", valor: { ...inicial.params, valor_y_variable: "p3a" } });
    expect(validarBorrador(b)).toBe("La segunda pregunta no se puede comparar consigo misma.");
    const otra = aplicar(b, { tipo: "param", clave: "valor_y_variable", valor: "sexo" });
    expect(validarBorrador(otra)).toBe("");
    expect(cuerpoAGuardar(otra, inicial)?.params).toEqual({ op_x: "==", valor_x: "1", op_y: "<", valor_y_variable: "sexo" });
    const lista = aplicar(otra, { tipo: "param", clave: "op_y", valor: "in" });
    expect(validarBorrador(lista)).toBe("Con otra pregunta solo se compara con es, no es, mayor o menor.");
  });

  it("cambiar de tipo descarta los parámetros del anterior y conserva la primera pregunta", () => {
    const inicial = regla();
    const b = aplicar(borradorInicial({ inicial }), { tipo: "elegir-tipo", valor: "rango_fecha" });
    expect(b.params).toEqual({});
    expect(b.variables).toEqual(["edad"]);
    const igual = aplicar(borradorInicial({ inicial }), { tipo: "elegir-tipo", valor: "rango_num" });
    expect(igual.params).toEqual({ min: "16", max: "25" });
  });

  it("una sugerida que se usa viaja con su procedencia", () => {
    const b = borradorInicial({
      inicial: null,
      semilla: {
        activa: true,
        nombre: "Duplicados por documento",
        tipo: "duplicados",
        variables: ["dni"],
        params: {},
        mensaje: "Documento repetido",
        severidad: "advertencia",
        hallazgo_kind: "caso_validar",
        semilla: { origen: "procedencia", porque: "Tiene 3 repetidos.", n_casos_afectados: 3 },
      },
    });
    expect(cuerpoAGuardar(b, null)?.semilla).toEqual({ origen: "procedencia", porque: "Tiene 3 repetidos.", n_casos_afectados: 3 });
    expect(cuerpoParaProbar(b)).not.toHaveProperty("semilla");
  });
});

describe("lo que se manda a contar", () => {
  it("una regla incompleta no se cuenta", () => {
    expect(cuerpoParaProbar(borradorInicial({ inicial: null, tipo: "rango_num", pregunta: "p4" }))).toBeNull();
  });

  it("una completa se cuenta como se guardaría, sin id", () => {
    const inicial = regla();
    const cuerpo = cuerpoParaProbar(borradorInicial({ inicial }), tipos);
    expect(cuerpo).not.toHaveProperty("id");
    expect(cuerpo).toMatchObject({ tipo: "rango_num", variables: ["edad"], params: { min: "16", max: "25" } });
  });
});

describe("revisión dentro de la app (QA del panel de regla)", () => {
  it("A2: Opciones esperadas o prohibidas arranca con el operador que se ve, y valida con él", () => {
    const nueva = borradorInicial({ inicial: null, tipo: "select_multiple_selection", pregunta: "q7" });
    expect(nueva.params.op).toBe("contains_any");
    const elegida = aplicar(borradorInicial({ inicial: null }), { tipo: "elegir-tipo", valor: "select_multiple_selection" });
    expect(elegida.params.op).toBe("contains_any");
    const conCodigos = aplicar(elegida, { tipo: "variables", valor: ["q7"] }, { tipo: "param", clave: "codes", valor: ["1"] });
    expect(validarBorrador(conCodigos)).toBe("");
  });

  it("Condiciones combinadas arranca con una fila vacía", () => {
    const b = aplicar(borradorInicial({ inicial: null }), { tipo: "elegir-tipo", valor: "condiciones" });
    expect(b.params.condiciones).toEqual([{ variable: "", op: "", valor: "" }]);
    expect(borradorInicial({ inicial: null, tipo: "condiciones" }).params.condiciones).toEqual([{ variable: "", op: "", valor: "" }]);
  });

  it("una regla nueva se nombra con la etiqueta corta de sus preguntas o su código, no con su enunciado", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "rango_num", pregunta: "p4" }), { tipo: "param", clave: "min", valor: "1" });
    expect(nombreDelBorrador(b, VARIABLES)).toBe("Valor fuera de rango: Año de egreso");
    const sinEtiqueta = aplicar(borradorInicial({ inicial: null, tipo: "rango_num", pregunta: "x9" }), { tipo: "param", clave: "min", valor: "1" });
    expect(nombreDelBorrador(sinEtiqueta, VARIABLES)).toBe("Valor fuera de rango: x9");
  });

  it("una pregunta de batería se nombra por su código, sin el enunciado ni el ítem", () => {
    const enunciado = "P29. Indica qué tan de acuerdo estás con las siguientes frases sobre tu colegio:";
    const bateria: ExploradorVariable[] = [
      { name: "p29_2", label: `${enunciado} Mis profesores me escuchan`, tipo: "so", n_validos: 10, n_nulos: 0 },
      { name: "p29_3", label: `${enunciado} Me siento seguro en mi colegio`, tipo: "so", n_validos: 10, n_nulos: 0 },
      { name: "p29_4", label: `${enunciado} Tengo amigos en mi salón`, tipo: "so", n_validos: 10, n_nulos: 0 },
    ];
    const b = borradorInicial({ inicial: null, tipo: "no_nulo", pregunta: "p29_3" });
    expect(nombreDelBorrador(b, bateria)).toBe("Respuesta obligatoria: p29_3");
  });

  it("una regla existente sin nombre conserva el nombre de siempre (lo guardado no cambia)", () => {
    const inicial = regla({ nombre: "", mensaje: "" });
    expect(cuerpoAGuardar(borradorInicial({ inicial }), inicial, tipos, VARIABLES)?.nombre).toBe("Valor fuera de rango: edad");
  });

  it("Detalle no muestra el nombre que nadie escribió, y lo guardado no cambia", () => {
    const inicial = regla({ nombre: "Edad", mensaje: "Edad" });
    const b = borradorInicial({ inicial });
    expect(b.mensaje).toBe("");
    expect(cuerpoAGuardar(b, inicial)?.mensaje).toBe("Edad");
  });

  it("una sugerida que se usa se guarda como sugerida", () => {
    const b = borradorInicial({
      inicial: null,
      semilla: {
        activa: true, nombre: "Duplicados", tipo: "duplicados", variables: ["dni"], params: {}, mensaje: "", severidad: "advertencia",
        hallazgo_kind: "caso_validar", origen: "sembrado", semilla: { origen: "procedencia", porque: "x" },
      },
    });
    expect(cuerpoAGuardar(b, null)?.origen).toBe("sembrado");
  });

  it("el mensaje de pocas preguntas dice pregunta", () => {
    expect(validarBorrador(borradorInicial({ inicial: null, tipo: "rango_num" }))).toBe("Elige al menos 1 pregunta.");
    expect(validarBorrador(borradorInicial({ inicial: null, tipo: "coherencia_2v", pregunta: "p4" }))).toBe("Elige al menos 2 preguntas.");
  });
});

describe("segunda revisión: abrir y guardar no altera lo guardado", () => {
  it("un gate_expr vacío con filtro se conserva vacío si el filtro no se tocó", () => {
    const inicial = regla({ tipo: "outliers_z", params: { k: 3 }, gate_conditions: [{ variable: "E2_sex", op: "==", value: "1" }], gate_expr: "" });
    expect(cuerpoAGuardar(borradorInicial({ inicial }), inicial)?.gate_expr).toBe("");
    const tocado = aplicar(borradorInicial({ inicial }), { tipo: "filtro", valor: [{ variable: "E2_sex", op: "==", value: "2" }] });
    expect(cuerpoAGuardar(tocado, inicial)?.gate_expr).toBe('${E2_sex} = "2"');
  });
});


describe("ítem 45.4: nombres automáticos", () => {
  const LUGAR: ExploradorVariable[] = [
    { name: "p1_1", label: "P1. Lugar de nacimiento: región", tipo: "texto", n_validos: 10, n_nulos: 0 },
    { name: "p1_2", label: "P1. Lugar de nacimiento: provincia", tipo: "texto", n_validos: 10, n_nulos: 0 },
    { name: "p1_3", label: "P1. Lugar de nacimiento: distrito", tipo: "texto", n_validos: 10, n_nulos: 0 },
    { name: "distrito", label: "", tipo: "texto", n_validos: 10, n_nulos: 0 },
    { name: "ubigeo", label: "Ubigeo del distrito", tipo: "texto", n_validos: 10, n_nulos: 0 },
  ];

  it("la combinación fuera de catálogo se nombra en el orden de sus papeles, con etiquetas", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "combinacion_catalogo" }), {
      tipo: "param",
      clave: "roles",
      valor: { distrito: "p1_3", departamento: "p1_1", provincia: "p1_2" },
    });
    expect(nombreDelBorrador(b, LUGAR)).toBe("Combinación fuera de catálogo: región, provincia y distrito");
    // Sin inventario, los códigos, en el mismo orden.
    expect(nombreDelBorrador(b)).toBe("Combinación fuera de catálogo: p1_1, p1_2 y p1_3");
  });

  it("el valor distinto al habitual nombra primero el grupo y luego el valor", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "moda_en_grupo" }), {
      tipo: "params",
      valor: { grupo: "ubigeo", valor: "distrito", apoyo_min: 60, n_min: 5 },
    });
    expect(nombreDelBorrador(b, LUGAR)).toBe("Valor distinto al habitual en su grupo: Ubigeo del distrito y distrito");
  });

  it("una etiqueta que se lee igual que el código de otra pregunta de la regla va por su código", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "moda_en_grupo" }), {
      tipo: "params",
      valor: { grupo: "p1_3", valor: "distrito", apoyo_min: 60, n_min: 5 },
    });
    expect(nombreDelBorrador(b, LUGAR)).toBe("Valor distinto al habitual en su grupo: p1_3 y distrito");
  });

  it("dos preguntas con la misma etiqueta corta van por su código", () => {
    const b = aplicar(borradorInicial({ inicial: null, tipo: "duplicados" }), { tipo: "variables", valor: ["p1_3", "distrito"] });
    const otras: ExploradorVariable[] = [...LUGAR.slice(0, 3), { name: "distrito", label: "Distrito", tipo: "texto", n_validos: 1, n_nulos: 0 }];
    expect(nombreDelBorrador(b, otras)).toBe("Respuestas repetidas: p1_3 y distrito");
  });
});

describe("ítem 45.10: cambiar de tipo y volver conserva lo del tipo anterior", () => {
  const CONDICIONES = [
    { variable: "p21", op: "in", valor: ["1", "2"] },
    { variable: "p4", op: "==", valor: "3" },
  ];

  it("Condiciones combinadas a Respuestas repetidas y de vuelta recupera las condiciones", () => {
    let b = aplicar(borradorInicial({ inicial: null, tipo: "condiciones" }), { tipo: "param", clave: "condiciones", valor: CONDICIONES });
    b = aplicar(b, { tipo: "elegir-tipo", valor: "duplicados" });
    expect(b.params).toEqual({});
    b = aplicar(b, { tipo: "variables", valor: ["dni"] });
    b = aplicar(b, { tipo: "elegir-tipo", valor: "condiciones" });
    expect(b.params.condiciones).toEqual(CONDICIONES);
    // Y Respuestas repetidas también recupera su pregunta.
    b = aplicar(b, { tipo: "elegir-tipo", valor: "duplicados" });
    expect(b.variables).toEqual(["dni"]);
  });

  it("lo recordado no viaja al cuerpo que se guarda", () => {
    let b = aplicar(borradorInicial({ inicial: null, tipo: "condiciones" }), { tipo: "param", clave: "condiciones", valor: CONDICIONES });
    b = aplicar(b, { tipo: "elegir-tipo", valor: "duplicados" }, { tipo: "variables", valor: ["dni"] });
    expect(JSON.stringify(cuerpoAGuardar(b, null))).not.toContain("p21");
  });
});
