import { describe, expect, it } from "vitest";

import type { PlanPregunta } from "../../../api/dashboard";
import {
  AVISO_BASE_CAMBIO,
  AVISO_ORIGINALES,
  claveDePregunta,
  codigosDeDetalle,
  EFECTO_APLICAR,
  EFECTO_SIN_APLICAR,
  efectoDeAplicar,
  filaDeAplicar,
  filaTrasTecla,
  franjaDeAplicar,
  campoLegible,
  cambioDeLaBase,
  preguntaElegida,
  resumenDelPlan,
  ROTULO_DE_ORIGEN,
  tipoDeFicha,
  tipoEnPalabras,
} from "./modeloAplicar";

// Codificación, Aplicar: toda cifra de la pantalla sale del plan del motor y de una sola función.

function pregunta(parcial: Partial<PlanPregunta> & Pick<PlanPregunta, "parent">): PlanPregunta {
  return {
    parent_label: "",
    tipo: "select_one",
    modo_so: "hijo",
    text_col: `${parcial.parent}_otro`,
    nueva_variable: `${parcial.parent}_otro_recod`,
    n_grupos: 0,
    n_codigos_nuevos: 0,
    n_codigos_reutilizados: 0,
    n_respuestas_afectadas: 0,
    codigos_nuevos: [],
    codigos_reutilizados: [],
    bridge_soportado: true,
    ...parcial,
  };
}

const P9 = pregunta({ parent: "p9", parent_label: "Ocupación principal", tipo: "text", modo_so: "", nueva_variable: "p9_recod", n_codigos_nuevos: 6, n_codigos_reutilizados: 2, n_respuestas_afectadas: 1142 });
const P3 = pregunta({ parent: "p3", parent_label: "<b>Otra carrera</b>, especifique", tipo: "select_multiple", modo_so: "", nueva_variable: "p3/*_recod", n_codigos_nuevos: 1, n_codigos_reutilizados: 0, n_respuestas_afectadas: 1 });
const P20 = pregunta({ parent: "p20", parent_label: "¿Por qué no participó?", modo_so: "padre", nueva_variable: "p20_recod", n_codigos_nuevos: 0, n_codigos_reutilizados: 1, n_respuestas_afectadas: 64 });
const FUERA = pregunta({ parent: "p66", bridge_soportado: false, n_codigos_nuevos: 40, n_codigos_reutilizados: 9, motivo_omision: 'La columna de texto "p66_otro" no está en la base.' });

describe("resumenDelPlan", () => {
  it("cuenta solo las preguntas que se aplican: lo de las que quedan fuera no entra en ninguna cifra", () => {
    const r = resumenDelPlan({ preguntas: [P9, FUERA, P3, P20] });
    expect(r.aplicables.map((p) => p.parent)).toEqual(["p9", "p3", "p20"]);
    expect(r.fuera.map((p) => p.parent)).toEqual(["p66"]);
    // 6 + 1 + 0 y 2 + 0 + 1: los 40 y 9 de p66 no suman.
    expect(r.codigosNuevos).toBe(7);
    expect(r.codigosExistentes).toBe(3);
    expect(r.camposNuevos).toBe(3);
  });

  it("un campo nuevo solo cuenta si el plan lo declara, y una cifra ausente no rompe la suma", () => {
    const sinCampo = pregunta({ parent: "p1", nueva_variable: "  ", n_codigos_nuevos: undefined as unknown as number });
    const r = resumenDelPlan({ preguntas: [sinCampo, P9] });
    expect(r.aplicables).toHaveLength(2);
    expect(r.camposNuevos).toBe(1);
    expect(r.codigosNuevos).toBe(6);
  });

  it("un plan sin preguntas da ceros y listas vacías", () => {
    expect(resumenDelPlan({ preguntas: [] })).toEqual({ aplicables: [], fuera: [], codigosNuevos: 0, codigosExistentes: 0, camposNuevos: 0 });
  });
});

describe("franjaDeAplicar", () => {
  it("dice qué se agrega a la base (columnas, códigos nuevos, respuestas con código) y, aparte, lo que no entra", () => {
    const f = franjaDeAplicar(resumenDelPlan({ preguntas: [P9, FUERA, P3, P20] }));
    expect(f.etiqueta).toBe("Qué se agrega a la base");
    expect(f.grupos.map((g) => [g.rotulo, g.aparte ?? false])).toEqual([["Se agrega a la base", false], ["No entran todavía", true]]);
    // Con el avance leído aparece "Sin código propio" entre los dos.
    expect(franjaDeAplicar(resumenDelPlan({ preguntas: [P9, FUERA] }), { sinCodigo: 15 }).grupos.map((g) => `${g.rotulo}:${g.cifras.map((c) => `${c.cifra} ${c.texto}`).join("|")}`)).toEqual([
      "Se agrega a la base:1 columna|6 códigos nuevos|1,142 respuestas con código",
      "Sin código propio:15 respuestas quedan sin código",
      "No entran todavía:1 pregunta",
    ]);
    // Columnas: p9 y p20 una cada una; p3 es múltiple, una por código (1). Las 40 y 9 de p66 no suman.
    expect(f.grupos[0].cifras.map((c) => [c.cifra, c.texto])).toEqual([
      ["3", "columnas"],
      ["7", "códigos nuevos"],
      ["1,207", "respuestas con código"],
    ]);
    expect(f.grupos[1].cifras.map((c) => [c.cifra, c.texto])).toEqual([["1", "pregunta"]]);
    expect(f.destino).toBeUndefined();
    expect(f.avisos).toEqual([{ id: "originales", tono: "conforme", texto: AVISO_ORIGINALES }]);
  });

  it("concuerda en singular y sin preguntas fuera dice cero en el grupo aparte", () => {
    const f = franjaDeAplicar(resumenDelPlan({ preguntas: [pregunta({ parent: "p1", n_codigos_nuevos: 1, n_codigos_reutilizados: 1, n_respuestas_afectadas: 1 })] }));
    expect(f.grupos).toHaveLength(2);
    expect(f.grupos.flatMap((g) => g.cifras.map((c) => `${c.cifra} ${c.texto}`))).toEqual(["1 columna", "1 código nuevo", "1 respuesta con código", "0 preguntas"]);
  });

  it("si la base cambió después de la última aplicación, lo avisa con su causa", () => {
    const r = resumenDelPlan({ preguntas: [P9] });
    expect(franjaDeAplicar(r, { baseCambio: true }).avisos[0]).toEqual({ id: "base-cambio", tono: "aviso", texto: AVISO_BASE_CAMBIO });
    expect(franjaDeAplicar(r, { baseCambio: false }).avisos.map((a) => a.id)).toEqual(["originales"]);
    expect(AVISO_BASE_CAMBIO).not.toMatch(/adapta|_recod/);
  });
});

describe("campoLegible y cambioDeLaBase", () => {
  it("el campo de una múltiple se lee con su primer código en lugar del comodín; el patrón queda en el title", () => {
    const p = pregunta({ parent: "D1_information", tipo: "select_multiple", nueva_variable: "D1_information/*_recod", codigos_nuevos: [{ codigo: "9", etiqueta: "Trabajo", n_respuestas: 0 }], codigos_reutilizados: [{ codigo: "1", etiqueta: "Redes", n_respuestas: 3 }] });
    expect(campoLegible(p.nueva_variable, p)).toEqual({ nombre: "D1_information/9_recod", porCodigo: true, titulo: "Una columna por código: D1_information/código_recod" });
    expect(campoLegible("p9_recod", P9)).toEqual({ nombre: "p9_recod", porCodigo: false, titulo: "p9_recod" });
    expect(filaDeAplicar(p).campo).not.toContain("*");
  });

  it("antes y después: la columna de hoy y lo que se agrega", () => {
    expect(cambioDeLaBase(P9)).toEqual({ hoy: "p9_otro", hoyTipo: "Texto", agrega: "p9_recod", agregaTitulo: "p9_recod", agregaTipo: "Opción única" });
    expect(cambioDeLaBase(pregunta({ parent: "p1", nueva_variable: "" }))).toBeNull();
  });
});

describe("filaDeAplicar", () => {
  it("lleva la ficha, el campo que agrega, los códigos y las respuestas de su pregunta", () => {
    expect(filaDeAplicar(P9)).toEqual({
      id: "p9::p9_recod",
      codigo: "p9",
      etiqueta: "Ocupación principal",
      tipo: "texto",
      tipoEnPalabras: "Texto abierto",
      campo: "p9_recod",
      campoTitulo: "p9_recod",
      variosCampos: false,
      codigos: "6 códigos nuevos y 2 ya existentes",
      respuestas: "1,142 respuestas con código",
    });
  });

  it("una de opción múltiple agrega varios campos; la etiqueta sale sin marcado y las cifras concuerdan con 1", () => {
    const fila = filaDeAplicar(P3);
    expect(fila.etiqueta).toBe("Otra carrera, especifique");
    expect(fila.tipo).toBe("multiple");
    expect(fila.variosCampos).toBe(true);
    expect(fila.codigos).toBe("1 código nuevo");
    expect(fila.respuestas).toBe("1 respuesta con código");
  });

  it("solo códigos ya existentes se nombran completos; sin etiqueta, el código hace de etiqueta", () => {
    expect(filaDeAplicar(P20).codigos).toBe("1 código ya existente");
    expect(filaDeAplicar(pregunta({ parent: "p7", n_codigos_reutilizados: 4 })).codigos).toBe("4 códigos ya existentes");
    expect(filaDeAplicar(pregunta({ parent: "p7" })).etiqueta).toBe("p7");
  });

  it("si es la única pregunta que se aplica no repite sus conteos de códigos, que ya dice la franja; las respuestas sí", () => {
    const sola = filaDeAplicar(P9, { unica: true });
    expect(sola.codigos).toBe("");
    expect(sola.respuestas).toBe("1,142 respuestas con código");
    expect(filaDeAplicar(P9, { unica: false }).codigos).toBe("6 códigos nuevos y 2 ya existentes");
  });

  it("lo que el plan no trae queda vacío: no se inventa un cero ni una raya", () => {
    const fila = filaDeAplicar(pregunta({ parent: "p7", nueva_variable: "", n_respuestas_afectadas: undefined as unknown as number }));
    expect(fila.campo).toBe("");
    expect(fila.codigos).toBe("");
    expect(fila.respuestas).toBe("");
  });
});

describe("selección de la pregunta del detalle", () => {
  const AGRUPADA = pregunta({ parent: "p9", tipo: "agrupacion", modo_so: "", nueva_variable: "p9_agrup" });

  it("la clave distingue una pregunta de su agrupación, que comparten código", () => {
    expect(claveDePregunta(P9)).toBe("p9::p9_recod");
    expect(claveDePregunta(AGRUPADA)).toBe("p9::p9_agrup");
    expect(filaDeAplicar(AGRUPADA).id).toBe("p9::p9_agrup");
  });

  it("sin elegir vale la primera; con una clave, esa; si ya no está en el plan, la primera; sin preguntas, ninguna", () => {
    const aplicables = [P9, P3, P20];
    expect(preguntaElegida(aplicables, null)).toBe(P9);
    expect(preguntaElegida(aplicables, claveDePregunta(P20))).toBe(P20);
    expect(preguntaElegida(aplicables, "p99::p99_recod")).toBe(P9);
    expect(preguntaElegida([], claveDePregunta(P9))).toBeNull();
  });

  it("las flechas mueven una fila sin salirse; Inicio y Fin van a los extremos; otra tecla no mueve", () => {
    expect(filaTrasTecla("ArrowDown", 0, 3)).toBe(1);
    expect(filaTrasTecla("ArrowDown", 2, 3)).toBe(2);
    expect(filaTrasTecla("ArrowUp", 1, 3)).toBe(0);
    expect(filaTrasTecla("ArrowUp", 0, 3)).toBe(0);
    expect(filaTrasTecla("Home", 2, 3)).toBe(0);
    expect(filaTrasTecla("End", 0, 3)).toBe(2);
    expect(filaTrasTecla("Enter", 1, 3)).toBeNull();
    expect(filaTrasTecla("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("codigosDeDetalle", () => {
  it("lista cada código con su origen y sus respuestas: primero los nuevos, después los que ya existían", () => {
    const codigos = codigosDeDetalle({
      codigos_nuevos: [{ codigo: "08", etiqueta: "Educación <b>superior</b>", n_respuestas: 1024 }, { codigo: "12", etiqueta: "Minería", n_respuestas: 1 }],
      codigos_reutilizados: [{ codigo: "96", etiqueta: "Otro", n_respuestas: 9 }],
    });
    expect(codigos.map((c) => [c.codigo, c.etiqueta, c.origen, c.respuestas])).toEqual([
      ["08", "Educación superior", "nuevo", "1,024"],
      ["12", "Minería", "nuevo", "1"],
      ["96", "Otro", "existente", "9"],
    ]);
    expect(new Set(codigos.map((c) => c.id)).size).toBe(3);
  });

  it("el origen se nombra con palabras distintas", () => {
    expect(ROTULO_DE_ORIGEN).toEqual({ nuevo: "Nuevo", existente: "Ya existente" });
  });

  it("si para un código no viene el conteo o la etiqueta, quedan vacíos: no se inventa un cero", () => {
    const [sinDatos] = codigosDeDetalle({
      codigos_nuevos: [{ codigo: "7", etiqueta: "", n_respuestas: undefined as unknown as number }],
      codigos_reutilizados: [],
    });
    expect(sinDatos).toMatchObject({ codigo: "7", etiqueta: "", respuestas: "", proporcion: 0 });
    expect(codigosDeDetalle({ codigos_nuevos: undefined as unknown as [], codigos_reutilizados: [] })).toEqual([]);
  });

  it("un cero que sí viene se lee \"0\" y no lleva barra", () => {
    const [cero] = codigosDeDetalle({ codigos_nuevos: [{ codigo: "5", etiqueta: "Arte", n_respuestas: 0 }], codigos_reutilizados: [] });
    expect(cero.respuestas).toBe("0");
    expect(cero.proporcion).toBe(0);
  });

  it("la barra es proporcional al código con más respuestas de la pregunta, sea nuevo o ya existente", () => {
    const codigos = codigosDeDetalle({
      codigos_nuevos: [{ codigo: "1", etiqueta: "A", n_respuestas: 10 }, { codigo: "2", etiqueta: "B", n_respuestas: 0 }, { codigo: "3", etiqueta: "C", n_respuestas: undefined as unknown as number }],
      codigos_reutilizados: [{ codigo: "9", etiqueta: "Otro", n_respuestas: 40 }],
    });
    expect(codigos.map((c) => c.proporcion)).toEqual([0.25, 0, 0, 1]);
  });
});

describe("tipo de la pregunta", () => {
  it("cada tipo del formulario tiene su ficha y su nombre en palabras", () => {
    expect(["select_one", "select_multiple", "integer", "text"].map(tipoDeFicha)).toEqual(["unica", "multiple", "numerica", "texto"]);
    expect(tipoEnPalabras({ tipo: "select_one", modo_so: "hijo" })).toBe("Opción única, texto codificado aparte");
    expect(tipoEnPalabras({ tipo: "select_one", modo_so: "padre" })).toBe("Opción única, pregunta original codificada");
    expect(tipoEnPalabras({ tipo: "select_one", modo_so: "" })).toBe("Opción única");
    expect(tipoEnPalabras({ tipo: "integer", modo_so: "" })).toBe("Numérica por rangos");
    expect(tipoEnPalabras({ tipo: "select_multiple", modo_so: "" })).toBe("Opción múltiple");
  });

  it("una agrupación se nombra y no se colorea; un tipo desconocido no muestra el identificador del motor", () => {
    expect(tipoDeFicha("agrupacion")).toBeNull();
    expect(tipoEnPalabras({ tipo: "agrupacion", modo_so: "" })).toBe("Agrupación de categorías");
    expect(tipoDeFicha("geopoint")).toBeNull();
    expect(tipoEnPalabras({ tipo: "geopoint", modo_so: "" })).toBe("");
  });
});

describe("efectoDeAplicar", () => {
  it("dice qué se escribe y dónde; sin preguntas o con la base ya codificada, que no se escribe nada", () => {
    expect(efectoDeAplicar(3, false)).toBe(EFECTO_APLICAR);
    expect(EFECTO_APLICAR).toBe("Escribe los campos nuevos en la base y genera la base codificada y el formulario codificado.");
    expect(efectoDeAplicar(0, false)).toBe(EFECTO_SIN_APLICAR);
    expect(efectoDeAplicar(3, true)).toBe(EFECTO_SIN_APLICAR);
    expect(EFECTO_SIN_APLICAR).toBe("No se escribe nada en la base.");
  });
});
