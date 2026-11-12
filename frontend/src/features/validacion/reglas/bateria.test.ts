// "Patrón en una batería": la frase en vivo (las mismas palabras que el
// catálogo del motor, test-validacion-regla-bateria.R), lo que se guarda, la
// validación del borrador, la elección de preguntas por grupo, el resumen por
// caso del conteo previo y las columnas de Hallazgos.
import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { normalizarPruebaDeRegla } from "../../../api/validacionAuditoria";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { tablaDeCasos } from "../hallazgos/modeloHallazgos";
import type { ExploradorVariable } from "../types";
import { borradorInicial, cuerpoAGuardar, nombreDelBorrador, reducirBorrador, validarBorrador } from "./borradorDeRegla";
import { buscarPreguntas, enOrdenDelFormulario, gruposDeBateria, raizDelCodigo, type PreguntaConSeccion } from "./modeloBateria";
import { paramsDeBateria, validarBateria } from "./modeloRegla";
import { textoDeBateria } from "./panel/CasosQueMarca";
import { metaDeTipo, tiposDelGrupo } from "./tiposDeRegla";

const ITEMS = Array.from({ length: 14 }, (_, i) => `b${i + 1}`);

function frase(params: Record<string, unknown>, variables: readonly string[] = ITEMS): string | null {
  const piezas = fraseDeReglaPropia({ tipo: "bateria", variables, params });
  return piezas ? fraseEnTexto(piezas) : null;
}

describe("frase en vivo de una batería", () => {
  it("dice las mismas palabras que el catálogo del motor", () => {
    expect(frase({ patron: "iguales" })).toBe("Se marca cuando las 14 preguntas de la batería, de b1 a b14, tienen la misma respuesta.");
    expect(frase({ patron: "iguales", minimo: 12, no_cuentan: ["88"] })).toBe(
      "Se marca cuando todas las respuestas de la batería, de b1 a b14, son iguales y hay al menos 12 de 14 preguntas respondidas. 88 no cuenta como respuesta.",
    );
    expect(frase({ patron: "codigo", codigos: ["88"], minimo: 10 })).toBe(
      "Se marca cuando 88 aparece en al menos 10 de las 14 preguntas de la batería, de b1 a b14.",
    );
    expect(frase({ patron: "vacias" })).toBe("Se marca cuando las 14 preguntas de la batería, de b1 a b14, están vacías.");
  });

  it("lee el código con su etiqueta y nombra las preguntas como fichas", () => {
    const piezas = fraseDeReglaPropia(
      { tipo: "bateria", variables: ITEMS, params: { patron: "codigo", codigos: ["88"], minimo: 19 } },
      (_v, c) => (c === "88" ? "No aplica" : c),
    );
    expect(piezas?.filter((p) => p.tipo === "pregunta").map((p) => (p.tipo === "pregunta" ? p.variable : ""))).toEqual(["b1", "b14"]);
    expect(piezas?.some((p) => p.tipo === "valor" && p.texto === "No aplica")).toBe(true);
  });

  it("sin dos preguntas o sin código no hay frase todavía", () => {
    expect(frase({ patron: "iguales" }, ["b1"])).toBeNull();
    expect(frase({ patron: "codigo", minimo: 3 })).toBeNull();
  });
});

describe("lo que se guarda y lo que falta", () => {
  it("guarda solo los parámetros del patrón elegido", () => {
    expect(paramsDeBateria({ patron: "codigo", codigos: ["88"], minimo: "19", no_cuentan: ["99"] })).toEqual({
      patron: "codigo",
      minimo: 19,
      codigos: ["88"],
    });
    expect(paramsDeBateria({ patron: "iguales", vacias_cuentan: true })).toEqual({ patron: "iguales", no_cuentan: [], vacias_cuentan: true });
    expect(paramsDeBateria({})).toEqual({ patron: "iguales", no_cuentan: [], vacias_cuentan: false });
  });

  it("valida con los mismos límites que el esquema del motor", () => {
    expect(validarBateria({ patron: "iguales" }, 1)).toMatch(/al menos 2 preguntas/);
    expect(validarBateria({ patron: "iguales" }, 14)).toBe("");
    expect(validarBateria({ patron: "iguales", minimo: 1 }, 14)).toMatch(/entre 2 y 14/);
    expect(validarBateria({ patron: "vacias", minimo: 15 }, 14)).toMatch(/entre 1 y 14/);
    expect(validarBateria({ patron: "vacias", minimo: 2.5 }, 14)).toMatch(/entero/);
    expect(validarBateria({ patron: "codigo", minimo: 3 }, 14)).toMatch(/código/);
    expect(validarBateria({ patron: "codigo", codigos: ["88"] }, 14)).toMatch(/cuántas preguntas/);
  });

  it("el borrador se guarda con sus preguntas y se nombra por la primera y la última", () => {
    let b = borradorInicial({ inicial: null, tipo: "bateria" });
    expect(b.params).toEqual({ patron: "iguales" });
    expect(validarBorrador(b)).toMatch(/al menos 2/);
    b = reducirBorrador(b, { tipo: "variables", valor: ITEMS });
    expect(validarBorrador(b)).toBe("");
    expect(nombreDelBorrador(b)).toBe("Patrón en una batería: b1 a b14");
    const cuerpo = cuerpoAGuardar(b, null);
    expect(cuerpo?.tipo).toBe("bateria");
    expect(cuerpo?.variables).toEqual(ITEMS);
    expect(cuerpo?.params).toEqual({ patron: "iguales", no_cuentan: [], vacias_cuentan: false });
  });

  it("aparece en Nueva regla, en Coherencia de la encuesta", () => {
    expect(metaDeTipo("bateria")?.rotulo).toBe("Patrón en una batería");
    expect(tiposDelGrupo("coherencia", null).map((t) => t.key)).toContain("bateria");
  });
});

describe("elegir las preguntas de la batería", () => {
  const variables: PreguntaConSeccion[] = [
    { name: "edad", label: "Edad", tipo: "num", n_validos: 1, n_nulos: 0, seccion: "Datos" },
    ...[1, 2, 3].map((i) => ({ name: `p29_${i}`, label: `P29.${i}. Ítem`, tipo: "so" as const, n_validos: 1, n_nulos: 0, seccion: "Familia" })),
    ...[1, 2].map((i) => ({ name: `p30_${i}`, label: `P30.${i}. Ítem`, tipo: "so" as const, n_validos: 1, n_nulos: 0, seccion: "Familia" })),
  ];

  it("la raíz del código agrupa los ítems numerados", () => {
    expect(raizDelCodigo("p29_14")).toBe("p29");
    expect(raizDelCodigo("p9.3")).toBe("p9");
    expect(raizDelCodigo("edad")).toBeNull();
  });

  it("ofrece la raíz del código y la sección, sin repetir", () => {
    const grupos = gruposDeBateria(["p29_2"], variables);
    expect(grupos.map((g) => g.rotulo)).toEqual(["las que empiezan con p29", 'la sección "Familia"']);
    expect(grupos[0].preguntas).toEqual(["p29_1", "p29_2", "p29_3"]);
    expect(grupos[1].preguntas).toEqual(["p29_1", "p29_2", "p29_3", "p30_1", "p30_2"]);
  });

  it("mantiene el orden del formulario y no pierde una pregunta que ya no está en la base", () => {
    expect(enOrdenDelFormulario(["p29_3", "p29_1", "vieja"], variables)).toEqual(["vieja", "p29_1", "p29_3"]);
  });

  it("busca por código y por rótulo", () => {
    expect(buscarPreguntas("p30", variables).map((v) => v.name)).toEqual(["p30_1", "p30_2"]);
    expect(buscarPreguntas("edad", variables).map((v) => v.name)).toEqual(["edad"]);
    expect(buscarPreguntas("  ", variables)).toEqual([]);
  });
});

describe("el resumen de cada caso", () => {
  it("se lee del motor, con la etiqueta de la respuesta común", () => {
    const prueba = normalizarPruebaDeRegla({
      estado: "evaluada",
      evaluada: true,
      n_casos: 1,
      n_base: 8,
      ejemplos: [
        {
          id_caso: "u12",
          valores: [{ variable: "b1", valor: "1", papel: "revisada", falla: true }],
          bateria: { patron: "iguales", n_items: 14, n_contadas: 12, n_vacias: 2, n_codigo: 0, valor_comun: "1" },
        },
        { id_caso: "u13", valores: [], bateria: { patron: "otro", n_items: 14 } },
      ],
    });
    const r = prueba.ejemplos[0].bateria;
    expect(r).toBeDefined();
    expect(textoDeBateria(r!, (c) => (c === "1" ? "Nada" : c))).toBe("Nada en 12 de 14");
    // Un resumen que no se entiende no se inventa: no llega.
    expect(prueba.ejemplos[1].bateria).toBeUndefined();
    expect(textoDeBateria({ patron: "vacias", n_items: 14, n_contadas: 0, n_vacias: 14, n_codigo: 0, valor_comun: null }, String)).toBe("14 de 14 vacías");
    expect(textoDeBateria({ patron: "codigo", n_items: 22, n_contadas: 22, n_vacias: 0, n_codigo: 19, valor_comun: null }, String)).toBe(
      "Con el código en 19 de 22",
    );
  });

  it("Hallazgos muestra las preguntas de la batería en orden y lo medido al final", () => {
    const drill = {
      ok: true,
      regla: {
        id: "RC_BAT",
        familia: "bateria",
        variable_roles: { target: "b1", compare: ["b2", "b3"], labels: { b1: "P29.1", b2: "P29.2", b3: "P29.3" } },
        value_labels: { b1: { "4": "Mucho" } },
      },
      casos: [{ b1: 4, b2: 4, b3: 4 }],
      case_ids: ["u07"],
      esperado: [{ subtipo: "bateria", hecho: "respondió \"Mucho\" (4) en las 3 preguntas de la batería" }],
    } as unknown as InstrumentoDrillResult;
    const t = tablaDeCasos(drill, null);
    expect(t.columnas.map((c) => [c.clave, c.tipo])).toEqual([
      ["b1", "pregunta"],
      ["b2", "pregunta"],
      ["b3", "pregunta"],
      ["bateria:patron", "falla"],
    ]);
    expect(t.filas[0].id).toBe("u07");
    expect(t.filas[0].valores["b1"]).toBe("Mucho (4)");
    expect(t.filas[0].valores["bateria:patron"]).toBe("respondió \"Mucho\" (4) en las 3 preguntas de la batería");
  });
});
