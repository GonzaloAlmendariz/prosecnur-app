import { describe, expect, it } from "vitest";
import type { EmparejamientoFila, EmparejamientoFuente } from "../../api/cargaFuentes";
import { parsearDireccion } from "../../lib/navegacion/direccion";
import {
  EMPAREJAMIENTO_ESTADOS,
  agruparPorSeccion,
  baseDeLaDireccion,
  focoDeFuente,
  leerFocoFuente,
  avisoExclusion,
  bloquesPorEnunciado,
  datoRespuestas,
  conteosDeFuente,
  filtrarFilas,
  filtroInicial,
  fuenteEnFoco,
  hrefSinFoco,
  nombreDifiere,
  searchConEmparejamiento,
  searchSinEmparejamiento,
} from "./fuentesEmparejamientoModel";

function fila(parcial: Partial<EmparejamientoFila>): EmparejamientoFila {
  return { seccion: "Perfil", enunciado: "", etiqueta: "Pregunta", variable_base: "p1", variable_fuente: "p1", estado: "emparejada", ...parcial };
}

function fuente(parcial: Partial<EmparejamientoFuente>): EmparejamientoFuente {
  return {
    survey_id: "1",
    titulo: "Telefónico",
    estado: "incorporada",
    n_emparejadas: 0,
    n_preguntas_base: 0,
    n_filas_incorporadas: 0,
    n_filas_excluidas: 0,
    detalle_disponible: true,
    filas: [],
    ...parcial,
  };
}

describe("fuentesEmparejamientoModel", () => {
  const mixta = fuente({
    filas: [
      fila({ variable_base: "p1", variable_fuente: "p1" }),
      fila({ variable_base: "p4", variable_fuente: "p3", estado: "otro_nombre" }),
      fila({ seccion: "Opinión", variable_base: "p9", variable_fuente: "", estado: "sin_respuesta" }),
      fila({ seccion: "Opinión", variable_base: "p10", variable_fuente: "", estado: "ambigua" }),
      fila({ seccion: "Solo en la fuente", variable_base: "", variable_fuente: "p2", estado: "no_entro" }),
      fila({ seccion: "Perfil", variable_base: "p5", variable_fuente: "p5" }),
    ],
  });

  it("cuenta por estado", () => {
    expect(conteosDeFuente(mixta)).toEqual({ emparejada: 2, otro_nombre: 1, no_entro: 1, sin_respuesta: 1, ambigua: 1 });
    expect(conteosDeFuente(fuente({}))).toEqual({ emparejada: 0, otro_nombre: 0, no_entro: 0, sin_respuesta: 0, ambigua: 0 });
  });

  it("filtra diferencias y elige el filtro por defecto", () => {
    expect(filtrarFilas(mixta.filas, "diferencias").map((f) => f.estado)).toEqual([
      "otro_nombre", "sin_respuesta", "ambigua", "no_entro",
    ]);
    expect(filtrarFilas(mixta.filas, "todas")).toHaveLength(6);
    expect(filtroInicial(mixta)).toBe("diferencias");
    expect(filtroInicial(fuente({ filas: [fila({})] }))).toBe("todas");
    expect(filtroInicial(null)).toBe("todas");
  });

  it("agrupa por sección en el orden del instrumento y deja «Solo en la fuente» al final", () => {
    const grupos = agruparPorSeccion([
      fila({ seccion: "Solo en la fuente", estado: "no_entro", variable_base: "" }),
      ...mixta.filas,
    ]);
    expect(grupos.map((g) => [g.seccion, g.filas.length])).toEqual([
      ["Perfil", 3],
      ["Opinión", 2],
      ["Solo en la fuente", 2],
    ]);
    // Sin sección: las que solo existen en la fuente caen en su grupo.
    expect(agruparPorSeccion([fila({ seccion: "", estado: "no_entro" })])[0].seccion).toBe("Solo en la fuente");
  });

  it("resalta solo cuando los dos nombres existen y difieren", () => {
    expect(nombreDifiere({ variable_base: "p4", variable_fuente: "p3" })).toBe(true);
    expect(nombreDifiere({ variable_base: "p4", variable_fuente: "p4" })).toBe(false);
    expect(nombreDifiere({ variable_base: "p4", variable_fuente: "" })).toBe(false);
  });

  it("el aviso de exclusión dice cuántas respuestas quedaron fuera", () => {
    expect(avisoExclusion(fuente({}))).toBeNull();
    expect(avisoExclusion(fuente({ estado: "excluida", n_filas_excluidas: 37, n_emparejadas: 12, n_preguntas_base: 80 })))
      .toBe("Esta fuente no entró a la base: 37 respuestas quedaron fuera porque solo coinciden 12 de 80 preguntas.");
    expect(avisoExclusion(fuente({ estado: "excluida", n_filas_excluidas: 1 })))
      .toBe("Esta fuente no entró a la base: 1 respuesta quedó fuera.");
  });

  it("la fuente en foco es la pedida; sin foco, la primera; un foco ajeno no inventa otra", () => {
    const datos = { fuentes: [fuente({ survey_id: "a" }), fuente({ survey_id: "b" })] };
    expect(fuenteEnFoco(datos, "b")?.survey_id).toBe("b");
    expect(fuenteEnFoco(datos, null)?.survey_id).toBe("a");
    expect(fuenteEnFoco(datos, "zzz")).toBeNull();
    expect(fuenteEnFoco({ fuentes: [] }, "a")).toBeNull();
  });

  it("abre y cierra con la dirección canónica, sin tocar el resto", () => {
    const abierto = searchConEmparejamiento("?seccion=carga&pestana=revision", "123");
    expect(abierto).toBe("?seccion=carga&pestana=revision&panel=emparejamiento&foco=123");
    expect(searchSinEmparejamiento(abierto)).toBe("?seccion=carga&pestana=revision");
    // No borra el panel de otro.
    expect(searchSinEmparejamiento("?panel=avisos&foco=x")).toBe("?panel=avisos&foco=x");
    expect(hrefSinFoco("/procesamiento?seccion=carga&pestana=equivalencias&foco=123"))
      .toBe("/procesamiento?seccion=carga&pestana=equivalencias");
    expect(hrefSinFoco("/procesamiento")).toBe("/procesamiento");
  });

  it("el foco lleva la base: `<base>:<survey_id>`, cortado en el último «:»", () => {
    expect(focoDeFuente("estudiantes", "423593924")).toBe("estudiantes:423593924");
    expect(focoDeFuente(null, "423593924")).toBe("423593924");
    expect(focoDeFuente("  ", "423593924")).toBe("423593924");
    expect(leerFocoFuente("estudiantes:423593924")).toEqual({ base: "estudiantes", surveyId: "423593924" });
    // Una base con «:» en el nombre no se parte mal: el survey_id nunca lo lleva.
    expect(leerFocoFuente("Ola 2: egresados:77")).toEqual({ base: "Ola 2: egresados", surveyId: "77" });
    // Enlaces anteriores, sin base: la fuente de la base que se esté revisando.
    expect(leerFocoFuente("423593924")).toEqual({ base: null, surveyId: "423593924" });
    expect(leerFocoFuente("estudiantes:")).toBeNull();
    expect(leerFocoFuente("")).toBeNull();
    expect(leerFocoFuente(null)).toBeNull();
  });

  it("recargar la dirección del panel devuelve la misma base y la misma fuente", () => {
    const search = searchConEmparejamiento("?seccion=carga&pestana=revision", "423593924", "estudiantes");
    expect(search).toBe("?seccion=carga&pestana=revision&panel=emparejamiento&foco=estudiantes%3A423593924");
    // Lo que lee la app al recargar: la gramática compartida, sin params nuevos.
    const direccion = parsearDireccion("/procesamiento", search);
    expect(direccion?.panel).toBe("emparejamiento");
    expect(direccion?.pestana).toBe("revision");
    expect(baseDeLaDireccion(direccion?.panel, direccion?.foco)).toBe("estudiantes");
    expect(leerFocoFuente(direccion?.foco)?.surveyId).toBe("423593924");
    // Con otro panel abierto, el foco no habla de una base de Revisión.
    expect(baseDeLaDireccion("avisos", "estudiantes:1")).toBeNull();
    expect(baseDeLaDireccion("emparejamiento", "423593924")).toBeNull();
  });

  it("la insignia nombra el estado con las palabras de su cifra", () => {
    expect(EMPAREJAMIENTO_ESTADOS.no_entro).toMatchObject({ insignia: "No entró", cifra: "No entraron" });
    expect(EMPAREJAMIENTO_ESTADOS.ambigua).toMatchObject({ insignia: "Ambigua", cifra: "Ambiguas" });
    expect(EMPAREJAMIENTO_ESTADOS.emparejada).toMatchObject({ insignia: "Emparejada", cifra: "Emparejadas" });
  });

  it("junta en un bloque las filas consecutivas de una misma matriz", () => {
    const madre = "¿Ha utilizado los siguientes servicios?";
    const bloques = bloquesPorEnunciado([
      fila({ etiqueta: "Edad" }),
      fila({ enunciado: madre, etiqueta: "Servicio de salud" }),
      fila({ enunciado: madre, etiqueta: "Comunicación visual" }),
      fila({ etiqueta: "Género" }),
      fila({ enunciado: madre, etiqueta: "Biblioteca" }),
    ]);
    expect(bloques.map((b) => [b.enunciado, b.filas.map((f) => f.etiqueta)])).toEqual([
      ["", ["Edad"]],
      [madre, ["Servicio de salud", "Comunicación visual"]],
      ["", ["Género"]],
      // Separada por otra pregunta: otro bloque, como en el instrumento.
      [madre, ["Biblioteca"]],
    ]);
    expect(agruparPorSeccion([fila({ enunciado: madre }), fila({ enunciado: madre })])[0].bloques).toHaveLength(1);
  });

  it("el dato de respuestas del encabezado", () => {
    expect(datoRespuestas(fuente({ n_filas_incorporadas: 0 }))).toBe("Todavía no tiene respuestas.");
    expect(datoRespuestas(fuente({ n_filas_incorporadas: 52 }))).toBe("52 respuestas de esta fuente están en la base.");
    expect(datoRespuestas(fuente({ n_filas_incorporadas: 1 }))).toBe("1 respuesta de esta fuente está en la base.");
    expect(datoRespuestas(fuente({ n_filas_incorporadas: null }))).toBeNull();
    expect(datoRespuestas(fuente({ estado: "excluida", n_filas_incorporadas: 0 }))).toBeNull();
  });
});
