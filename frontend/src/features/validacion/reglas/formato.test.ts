// "Formato de la respuesta": la frase en vivo (las mismas palabras que el
// catálogo del motor, test-validacion-regla-formato.R), lo que se guarda, la
// validación del borrador, lo que dice el conteo previo y Hallazgos.
import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { normalizarPruebaDeRegla } from "../../../api/validacionAuditoria";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { tablaDeCasos } from "../hallazgos/modeloHallazgos";
import { borradorInicial, cuerpoAGuardar, nombreDelBorrador, reducirBorrador, validarBorrador } from "./borradorDeRegla";
import { descripcionDeFormato, paramsDeFormato, textoDeFormato, textoDeLecturaDeFormato, validarFormato } from "./modeloFormato";
import { cantidadDe } from "./panel/CamposDeFormato";
import { metaDeTipo, tiposDelGrupo } from "./tiposDeRegla";

const COMO_TEXTO = " La respuesta se revisa como texto, así que un cero inicial cuenta como dígito.";

function frase(variable: string, params: Record<string, unknown>): string | null {
  const piezas = fraseDeReglaPropia({ tipo: "formato", variables: [variable], params });
  return piezas ? fraseEnTexto(piezas) : null;
}

describe("frase en vivo del formato", () => {
  it("dice las mismas palabras que el catálogo del motor", () => {
    expect(frase("telefono", { modo: "digitos", largo_min: 9, largo_max: 9, empieza_con: ["9"] })).toBe(
      `Se marca cuando telefono no es un número de 9 dígitos que empieza con 9.${COMO_TEXTO}`,
    );
    expect(frase("ubigeo", { modo: "digitos", largo_min: 5, largo_max: 6 })).toBe(`Se marca cuando ubigeo no es un número de 5 a 6 dígitos.${COMO_TEXTO}`);
    expect(frase("telefono", { modo: "digitos", sin_separadores: true })).toBe(
      `Se marca cuando telefono no es un número escrito solo con dígitos. Antes se quitan espacios, guiones, puntos y paréntesis.${COMO_TEXTO}`,
    );
    expect(frase("correo", { modo: "correo" })).toBe(`Se marca cuando correo no es un correo electrónico, como nombre@dominio.pe.${COMO_TEXTO}`);
  });

  it("sin pregunta o sin patrón no hay frase todavía", () => {
    expect(frase("", { modo: "digitos" })).toBeNull();
    expect(frase("codigo", { modo: "expresion", expresion: " " })).toBeNull();
  });

  it("describe cantidades de un dígito, mínimos y varios inicios", () => {
    expect(descripcionDeFormato({ modo: "digitos", largo_min: 1, largo_max: 1 })).toBe("un número de 1 dígito");
    expect(descripcionDeFormato({ modo: "digitos", largo_min: 6 })).toBe("un número de al menos 6 dígitos");
    expect(descripcionDeFormato({ modo: "digitos", largo_max: 9, empieza_con: ["9", "01", "054"] })).toBe(
      "un número de hasta 9 dígitos que empieza con 9, 01 o 054",
    );
  });
});

describe("lo que se guarda y lo que falta", () => {
  it("guarda solo los parámetros del modo elegido, sin la cantidad del panel", () => {
    expect(paramsDeFormato({ modo: "digitos", cantidad: "exacta", largo_min: "9", largo_max: "9", empieza_con: "9, 01", expresion: "x" })).toEqual({
      modo: "digitos",
      largo_min: 9,
      largo_max: 9,
      empieza_con: ["9", "01"],
      sin_separadores: false,
    });
    expect(paramsDeFormato({ modo: "correo", largo_min: 9 })).toEqual({ modo: "correo" });
    expect(paramsDeFormato({ modo: "expresion", expresion: "[0-9]{6}" })).toEqual({ modo: "expresion", expresion: "[0-9]{6}" });
  });

  it("valida con los mismos límites que el esquema del motor", () => {
    expect(validarFormato({ modo: "digitos" }, 0)).toMatch(/pregunta/);
    expect(validarFormato({ modo: "digitos" }, 1)).toBe("");
    expect(validarFormato({ modo: "digitos", largo_min: 0 }, 1)).toMatch(/desde 1/);
    expect(validarFormato({ modo: "digitos", largo_min: 2.5 }, 1)).toMatch(/entero/);
    expect(validarFormato({ modo: "digitos", largo_min: "nueve" }, 1)).toMatch(/entero/);
    expect(validarFormato({ modo: "digitos", largo_min: 9, largo_max: 8 }, 1)).toMatch(/mayor que la máxima/);
    expect(validarFormato({ modo: "digitos", empieza_con: ["+51"] }, 1)).toMatch(/con dígitos/);
    expect(validarFormato({ modo: "digitos", largo_max: 2, empieza_con: ["051"] }, 1)).toMatch(/más dígitos/);
    expect(validarFormato({ modo: "expresion" }, 1)).toMatch(/Escribe el patrón/);
    expect(validarFormato({ modo: "expresion", expresion: "([0-9]" }, 1)).toMatch(/no se puede leer/);
    expect(validarFormato({ modo: "expresion", expresion: "(08|15)[0-9]{4}" }, 1)).toBe("");
  });

  it("la cantidad del panel se lee de lo guardado", () => {
    expect(cantidadDe({ largo_min: 9, largo_max: 9 })).toBe("exacta");
    expect(cantidadDe({ largo_min: 5, largo_max: 6 })).toBe("rango");
    expect(cantidadDe({ largo_max: 6 })).toBe("rango");
    expect(cantidadDe({})).toBe("cualquiera");
  });

  it("el borrador arranca en dígitos, se valida y se nombra por su pregunta", () => {
    let b = borradorInicial({ inicial: null, tipo: "formato" });
    expect(b.params).toEqual({ modo: "digitos" });
    expect(validarBorrador(b)).toMatch(/al menos 1 pregunta/);
    b = reducirBorrador(b, { tipo: "variables", valor: ["telefono"] });
    b = reducirBorrador(b, { tipo: "params", valor: { modo: "digitos", cantidad: "exacta", largo_min: "9", largo_max: "9", empieza_con: "9" } });
    expect(validarBorrador(b)).toBe("");
    expect(nombreDelBorrador(b, [{ name: "telefono", label: "Teléfono", tipo: "texto", n_validos: 1, n_nulos: 0 }])).toBe(
      'Formato de la respuesta: "Teléfono"',
    );
    const cuerpo = cuerpoAGuardar(b, null);
    expect(cuerpo?.tipo).toBe("formato");
    expect(cuerpo?.params).toEqual({ modo: "digitos", largo_min: 9, largo_max: 9, empieza_con: ["9"], sin_separadores: false });
  });

  it("aparece en Nueva regla, con los rangos y fechas", () => {
    expect(metaDeTipo("formato")?.rotulo).toBe("Formato de la respuesta");
    expect(tiposDelGrupo("respuesta", null).map((t) => t.key)).toContain("formato");
  });
});

describe("el conteo previo", () => {
  const prueba = normalizarPruebaDeRegla({
    estado: "evaluada",
    n_casos: 98,
    n_base: 1000,
    formato: {
      variable: "ubigeo",
      n_filas: 1000,
      n_vacias: 6,
      n_pasan: 896,
      n_no_pasan: 98,
      como_numero: false,
      pasan: [{ valor: "150128", n: 51 }],
      no_pasan: [{ valor: "80105", n: 12, motivo: "largo", n_digitos: 5 }, { valor: "x", n: 1, motivo: "otro" }],
    },
    ejemplos: [{ id_caso: "u03", valores: [], formato: { texto: "80105", revisado: "80105", n_digitos: 5, motivo: "largo" } }],
  });

  it("normaliza lo que llega y no inventa un motivo que no entiende", () => {
    expect(prueba.formato?.n_pasan).toBe(896);
    expect(prueba.formato?.no_pasan[1].motivo).toBeNull();
    expect(normalizarPruebaDeRegla({ estado: "evaluada", formato: { variable: "x" } }).formato).toBeUndefined();
  });

  it("dice cuántas pasan sobre las respondidas, las vacías aparte, y avisa si la columna llegó como número", () => {
    expect(textoDeLecturaDeFormato(prueba.formato!)).toEqual(["896 de 994 respuestas pasan; 6 vacías, que esta regla no marca."]);
    expect(textoDeLecturaDeFormato({ ...prueba.formato!, como_numero: true, n_vacias: 0 })).toEqual([
      "896 de 994 respuestas pasan.",
      "La base trae esta pregunta como número: un cero inicial que se perdió al cargar ya no se puede ver.",
    ]);
  });

  it("cada caso dice su respuesta y por qué no pasa", () => {
    expect(textoDeFormato(prueba.ejemplos[0].formato!)).toBe('"80105" (5 dígitos)');
    expect(textoDeFormato({ texto: "NO QUISO DAR", revisado: "NO QUISO DAR", n_digitos: 0, motivo: "sin_digitos" })).toBe('"NO QUISO DAR" (sin dígitos)');
  });
});

describe("Hallazgos", () => {
  it("muestra la respuesta tal cual, sin separador de miles, y al final el enunciado del motor", () => {
    const drill = {
      ok: true,
      regla: { id: "RC_FMT", familia: "formato", variable_roles: { target: "ubigeo", labels: { ubigeo: "Ubigeo" } } },
      casos: [{ ubigeo: 80105 }],
      case_ids: ["u03"],
      esperado: [{ subtipo: "formato", hecho: 'respondió "80105" en Ubigeo (5 dígitos)', choque: "que no es un número de 6 dígitos" }],
    } as unknown as InstrumentoDrillResult;
    const t = tablaDeCasos(drill, null);
    expect(t.columnas.map((c) => [c.clave, c.tipo])).toEqual([
      ["formato:ubigeo", "pregunta"],
      ["formato:motivo", "falla"],
    ]);
    expect(t.filas[0].valores["formato:ubigeo"]).toBe("80105");
    expect(t.filas[0].valores["formato:motivo"]).toBe('respondió "80105" en Ubigeo (5 dígitos), que no es un número de 6 dígitos');
  });
});
