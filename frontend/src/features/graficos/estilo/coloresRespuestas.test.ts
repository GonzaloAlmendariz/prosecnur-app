import { describe, expect, it } from "vitest";
import { PULSO_PUCP_COLORS } from "../paletasSugeridas";
import {
  combinacionesPara,
  conColoresDelGrupo,
  esRespuestaResidual,
  textoSobre,
  estadoGrupo,
  grupoCoincide,
  gruposDeRespuestas,
  type ListaRespuestas,
} from "./modeloColoresRespuestas";

const sino = (n: string, vars: string[], fuentes: string[] = []): ListaRespuestas => ({
  list_name: n,
  choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }],
  variables: vars,
  fuentes,
});
const acuerdo: ListaRespuestas = {
  list_name: "lst_p8",
  choices: ["Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "No sabe"].map((label, i) => ({ name: String(i + 1), label })),
  variables: ["docentes$p8"],
  fuentes: ["docentes"],
};
const ETIQUETAS = new Map([["p1", "¿Trabaja actualmente?"], ["docentes$p8", "La facultad cumple lo que ofrece"]]);

describe("Colores de las respuestas", () => {
  it("las listas con las mismas opciones forman un grupo, con sus preguntas y bases", () => {
    const grupos = gruposDeRespuestas([sino("lst_p1", ["p1"]), { ...sino("lst_p2", ["p2"]), choices: [{ name: "a", label: "no" }, { name: "b", label: "SÍ" }] }, acuerdo], {}, {}, ETIQUETAS);
    expect(grupos).toHaveLength(2);
    const g = grupos.find((x) => x.listas.includes("lst_p1"))!;
    expect(g.listas).toEqual(["lst_p1", "lst_p2"]);
    expect(g.preguntas.map((p) => p.texto)).toEqual(["¿Trabaja actualmente?", "p2"]);
    expect(estadoGrupo(g)).toBe("sin-colores");
    const a = grupos.find((x) => x.listas.includes("lst_p8"))!;
    expect(a.preguntas[0]).toEqual({ ref: "docentes$p8", texto: "La facultad cumple lo que ofrece", base: "docentes" });
    expect(a.bases).toEqual(["docentes"]);
  });

  it("omite las columnas internas y las listas que ninguna pregunta usa", () => {
    const interna: ListaRespuestas = { list_name: "lst_d", choices: [{ name: "o", label: "Otros distritos" }], variables: ["__district"] };
    const grupos = gruposDeRespuestas([sino("lst_p1", ["p1"]), interna], {}, {}, ETIQUETAS);
    expect(grupos.map((g) => g.listas)).toEqual([["lst_p1"]]);
  });

  it("lee el color vigente, también el que llega por otra lista igual, y cuenta lo que falta", () => {
    const grupos = gruposDeRespuestas([sino("lst_p1", []), sino("lst_p2", [])], { lst_p2: { "Sí": "#081F5C" } }, {}, new Map());
    expect(grupos[0].colores).toEqual({ "Sí": "#081F5C" });
    expect(grupos[0].faltan).toBe(1);
    expect(estadoGrupo(grupos[0])).toBe("incompleto");
  });

  it("pinta todas las listas del grupo, cada una con su forma de escribir la opción, en un mapa nuevo", () => {
    const listas = [sino("lst_p1", []), { ...sino("lst_p2", []), choices: [{ name: "a", label: "SÍ" }, { name: "b", label: "no" }] }];
    const [g] = gruposDeRespuestas(listas, {}, {}, new Map());
    const antes = { otra: { X: "#000000" } };
    const despues = conColoresDelGrupo(antes, g, listas, { "Sí": "#081F5C", No: "#BFBFBF" });
    expect(despues).toEqual({ otra: { X: "#000000" }, lst_p1: { "Sí": "#081F5C", No: "#BFBFBF" }, lst_p2: { "SÍ": "#081F5C", no: "#BFBFBF" } });
    expect(antes).toEqual({ otra: { X: "#000000" } });
    // Quitar los colores deja la lista sin paleta, sin tocar las demás.
    expect(conColoresDelGrupo(despues, g, listas, { "Sí": null, No: null })).toEqual({ otra: { X: "#000000" } });
  });

  it("las combinaciones dan gris a las respuestas residuales y color a las demás", () => {
    expect(esRespuestaResidual("No sabe / No responde")).toBe(true);
    expect(esRespuestaResidual("Otro (especifique)")).toBe(true);
    expect(esRespuestaResidual("No")).toBe(false);
    expect(esRespuestaResidual("SIN INF")).toBe(true);
    const combos = combinacionesPara(acuerdo.choices.map((c) => c.label));
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(c.colores["No sabe"]).toBe(PULSO_PUCP_COLORS.gris);
      expect(Object.keys(c.colores)).toHaveLength(5);
      expect(c.nombre).not.toMatch(/Pulso/);
    }
  });

  it("el rótulo sobre un color oscuro va claro y sobre uno claro, oscuro", () => {
    expect(textoSobre("#081F5C")).toBe("claro");
    expect(textoSobre("#9DC3E6")).toBe("oscuro");
    expect(textoSobre("#EFD25E")).toBe("oscuro");
    expect(textoSobre(undefined)).toBe("oscuro");
  });

  it("busca por opción, pregunta o base sin importar tildes", () => {
    const [g] = gruposDeRespuestas([acuerdo], {}, {}, ETIQUETAS);
    expect(grupoCoincide(g, "facultad")).toBe(true);
    expect(grupoCoincide(g, "DESACUERDO")).toBe(true);
    expect(grupoCoincide(g, "docentes")).toBe(true);
    expect(grupoCoincide(g, "egresados")).toBe(false);
  });
});

describe("paletas con nombre", () => {
  const listas = [sino("lst_p1", ["p1"]), sino("lst_p2", ["p2"]), { ...sino("lst_p3", ["p3"]), choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }, { name: "9", label: "No sabe" }] }];
  const base = { paletas: { lst_p1: { "Sí": "#081F5C", No: "#CA5651" } }, vinculos: {} };
  const filasDe = async (m: { paletas: Record<string, Record<string, string>>; vinculos: Record<string, string> }) => {
    const { filasDePaletas } = await import("./modeloPaletasConNombre");
    return filasDePaletas(gruposDeRespuestas(listas, m.paletas, m.vinculos, new Map()), listas, m.paletas, m.vinculos);
  };

  it("sin nombre, cada grupo es una fila con nombre automático", async () => {
    const filas = await filasDe(base);
    expect(filas.map((f) => [f.nombre, f.clave])).toEqual([["Sí / No", null], ["Sí / No", null]]);
  });

  it("nombrar crea la paleta, vincula sus listas y conserva los colores", async () => {
    const { conNombre } = await import("./modeloPaletasConNombre");
    const [sn] = (await filasDe(base)).filter((f) => f.opciones.length === 2);
    const m = conNombre(sn, "Aceptación", listas, base);
    expect(m.paletas).toEqual({ "Aceptación": { "Sí": "#081F5C", No: "#CA5651" } });
    expect(m.vinculos).toEqual({ lst_p1: "Aceptación", lst_p2: "Aceptación" });
    const filas = await filasDe(m);
    expect(filas[0]).toMatchObject({ nombre: "Aceptación", clave: "Aceptación", faltan: 0 });
    // Renombrar mueve la paleta y sus vínculos.
    const r = conNombre(filas[0], "Acepta", listas, m);
    expect(Object.keys(r.paletas)).toEqual(["Acepta"]);
    expect(new Set(Object.values(r.vinculos))).toEqual(new Set(["Acepta"]));
  });

  it("agrupar junta grupos con respuestas en común bajo una paleta, y separar devuelve los colores", async () => {
    const { conAgrupado, conNombre, conSeparado, respuestasEnComun } = await import("./modeloPaletasConNombre");
    const filas = await filasDe(base);
    const sn = filas.find((f) => f.opciones.length === 2)!;
    const conNs = filas.find((f) => f.opciones.length === 3)!;
    expect(respuestasEnComun(conNs, sn)).toBe(2);
    const nombrada = conNombre(sn, "Aceptación", listas, base);
    const destino = (await filasDe(nombrada)).find((f) => f.clave)!;
    const junta = conAgrupado(conNs, destino, listas, nombrada);
    expect(junta.vinculos).toEqual({ lst_p1: "Aceptación", lst_p2: "Aceptación", lst_p3: "Aceptación" });
    const [unica] = (await filasDe(junta)).filter((f) => f.clave);
    expect(unica.grupos).toHaveLength(2);
    expect(unica.opciones).toEqual(["Sí", "No", "No sabe"]);
    expect(unica.faltan).toBe(1);
    const sep = conSeparado(unica, unica.grupos.find((g) => g.opciones.length === 3)!, listas, junta);
    expect(sep.vinculos).toEqual({ lst_p1: "Aceptación", lst_p2: "Aceptación" });
    expect(sep.paletas.lst_p3).toEqual({ "Sí": "#081F5C", No: "#CA5651" });
  });

  it("no acepta un nombre vacío, el de una lista ni uno repetido", async () => {
    const { errorNombre } = await import("./modeloPaletasConNombre");
    const filas = await filasDe(base);
    expect(errorNombre(" ", filas, listas, filas[0])).toMatch(/Escribe/);
    expect(errorNombre("lst_p2", filas, listas, filas[0])).toMatch(/lista/);
    expect(errorNombre("Aceptación", filas, listas, filas[0])).toBeNull();
  });
});

describe("paletas con nombre en varias bases", () => {
  it("una lista cuyo nombre aloja otra escala en otra base no se vincula: no arrastra preguntas ajenas", async () => {
    const { conNombre, filasDePaletas, conColoresDeFila } = await import("./modeloPaletasConNombre");
    const listas: ListaRespuestas[] = [
      sino("lst_p1", ["docentes$p1"], ["docentes"]),
      sino("lst_p6", ["docentes$p6"], ["docentes"]),
      { list_name: "lst_p6", choices: [{ name: "1", label: "Primaria" }, { name: "2", label: "Secundaria" }], variables: ["administrativos$p6"], fuentes: ["administrativos"] },
    ];
    const filas0 = filasDePaletas(gruposDeRespuestas(listas, {}, {}, new Map()), listas, {}, {});
    const sn = filas0.find((f) => f.opciones.includes("Sí"))!;
    const m = conNombre(sn, "Aceptación", listas, { paletas: {}, vinculos: {} });
    expect(m.vinculos).toEqual({ lst_p1: "Aceptación" });
    const filas = filasDePaletas(gruposDeRespuestas(listas, m.paletas, m.vinculos, new Map()), listas, m.paletas, m.vinculos);
    const nombrada = filas.find((f) => f.clave)!;
    expect(nombrada.preguntas.map((p) => p.ref)).toEqual(["docentes$p1", "docentes$p6"]);
    expect(filas.find((f) => f.opciones.includes("Primaria"))!.clave).toBeNull();
    // Pintar la paleta llega también a la lista compartida, en su propia paleta y sin tocar la otra escala.
    const p = conColoresDeFila(nombrada, { "Sí": "#081F5C" }, listas, m.paletas);
    expect(p["Aceptación"]).toEqual({ "Sí": "#081F5C" });
    expect(p.lst_p6).toEqual({ "Sí": "#081F5C" });
  });
});
